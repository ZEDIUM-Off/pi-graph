Voici un plan d’implémentation complet pour `pi-graph`, basé sur :

- les docs Pi : extensions, packages, custom tools, commands, UI, persistence ;
- les docs LangGraph.js : `StateGraph`, state schema, checkpoints, interrupts, subgraphs, time-travel ;
- l’architecture de `pi-subagents` : tool unique, stockage user/project, foreground/background, status, resume, rendu workflow, configs sauvegardables.

---

# Plan d’implémentation `pi-graph`

## 1. Objectif produit

`pi-graph` sera une extension Pi installable qui permet de :

1. créer des graphes agentiques en JSON ;
2. les valider ;
3. les prévisualiser ;
4. les sauvegarder ;
5. les exécuter via LangGraph.js ;
6. orchestrer la session Pi courante ou des sub-agents `pi-subagents` ;
7. gérer des subgraphs réutilisables ;
8. supporter human-in-the-loop ;
9. optionnellement sauvegarder les runs ;
10. à terme remplacer/compléter le thinking par des flows Graph of Thoughts.

---

# 2. Structure du package

Structure recommandée :

```text
pi-graph/
  package.json
  README.md
  CHANGELOG.md
  install.mjs

  src/
    extension/
      index.ts
      schemas.ts
      tool-description.ts
      config.ts
      doctor.ts

    graphs/
      graph-store.ts
      graph-loader.ts
      graph-validator.ts
      graph-normalizer.ts
      graph-serializer.ts
      graph-preview.ts
      graph-mermaid.ts

    runtime/
      compile.ts
      runner.ts
      state.ts
      context-policy.ts
      node-handlers/
        agent-node.ts
        current-session-node.ts
        subagent-node.ts
        subagent-chain-node.ts
        tool-node.ts
        human-node.ts
        condition-node.ts
        transform-node.ts
        subgraph-node.ts
        thought-graph-node.ts
      checkpoints.ts
      run-store.ts
      run-status.ts
      interrupts.ts

    integrations/
      pi-subagents.ts
      pi-tools.ts
      pi-session.ts

    tui/
      render.ts
      graph-status-widget.ts
      preview-dialog.ts

    shared/
      types.ts
      ids.ts
      paths.ts
      json.ts
      errors.ts
      formatters.ts

  graphs/
    review-loop.json
    graph-of-thoughts-basic.json

  skills/
    pi-graph/
      SKILL.md

  prompts/
    design-graph.md
    review-graph.md
```

---

# 3. `package.json`

Inspiré de `pi-subagents`.

```json
{
  "name": "pi-graph",
  "version": "0.1.0",
  "description": "LangGraph-powered reusable agentic workflows for Pi",
  "type": "module",
  "keywords": ["pi-package", "pi", "langgraph", "agents", "workflows"],
  "pi": {
    "extensions": ["./src/extension/index.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  },
  "dependencies": {
    "@langchain/langgraph": "^1.0.0",
    "@langchain/core": "^1.0.0",
    "typebox": "^1.1.24",
    "zod": "^4.0.0"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-agent-core": "*",
    "@earendil-works/pi-tui": "*"
  }
}
```

À vérifier selon la version exacte de LangGraph.js disponible.

---

# 4. Tool principal : `graph`

Comme `pi-subagents`, je recommande **un tool central unique**.

## Actions v1

```ts
graph({ action: "list" })
graph({ action: "get", name: "review-loop" })
graph({ action: "create", config: {...} })
graph({ action: "update", name: "review-loop", config: {...} })
graph({ action: "delete", name: "review-loop" })
graph({ action: "validate", config: {...} })
graph({ action: "preview", config: {...} })
graph({ action: "render", name: "review-loop" })
graph({ action: "run", name: "review-loop", input: {...} })
graph({ action: "status", id: "..." })
graph({ action: "resume", id: "...", input: {...} })
graph({ action: "interrupt", id: "..." })
graph({ action: "history", id: "..." })
graph({ action: "doctor" })
```

## Règle importante

Comme `pi-subagents` :

> Avant d’exécuter un graph sauvegardé, l’agent doit faire `graph({ action: "list" })`.

Ça évite d’inventer des graphes inexistants.

---

# 5. Stockage des graphes

## Emplacements

```text
~/.pi/agent/graphs/
.pi/graphs/
```

Priorité :

1. `.pi/graphs/`
2. `~/.pi/agent/graphs/`
3. graphes packagés dans `graphs/`

## Format fichier

```text
.pi/graphs/review-loop.json
```

Le nom runtime peut être :

```text
review-loop
```

Ou avec namespace package :

```text
builtin.review-loop
user.review-loop
project.review-loop
```

---

# 6. JSON Schema v1

Le format doit être strictement validé.

## Structure de base

```json
{
  "name": "review-loop",
  "version": 1,
  "description": "Implement, review, fix until approved",
  "scope": "project",
  "inputSchema": {},
  "stateSchema": {},
  "outputSchema": {},
  "nodes": {},
  "edges": {},
  "start": "implement",
  "config": {}
}
```

## Node commun

Chaque nœud :

```json
{
  "type": "agent",
  "label": "Implementation",
  "description": "Implement the requested change",
  "context": {
    "mode": "fork"
  },
  "inputs": {},
  "outputs": {},
  "timeoutMs": 600000,
  "retry": {
    "max": 1
  }
}
```

---

# 7. Types de nœuds MVP

## 7.1 `agent`

Deux modes :

```json
{
  "type": "agent",
  "agentMode": "current-session",
  "prompt": "Continue the flow..."
}
```

ou :

```json
{
  "type": "agent",
  "agentMode": "subagent",
  "agent": "worker",
  "task": "Implement {{state.task}}"
}
```

## 7.2 `subagent-chain`

Permet de réutiliser la puissance de `pi-subagents`.

```json
{
  "type": "subagent-chain",
  "chain": [
    {
      "agent": "scout",
      "task": "Understand {{state.area}}"
    },
    {
      "agent": "planner",
      "task": "Plan based on {{previous}}"
    }
  ]
}
```

## 7.3 `tool`

Appelle un tool Pi.

```json
{
  "type": "tool",
  "tool": "bash",
  "input": {
    "command": "npm test"
  }
}
```

## 7.4 `human`

Utilise LangGraph `interrupt()` + Pi `ctx.ui`.

```json
{
  "type": "human",
  "mode": "select",
  "question": "Approve this implementation?",
  "options": ["approve", "revise", "abort"]
}
```

## 7.5 `condition`

```json
{
  "type": "condition",
  "expression": "state.review.approved === true",
  "routes": {
    "true": "end",
    "false": "implement"
  }
}
```

Pour sécurité, éviter `eval`. Préférer un mini langage contrôlé ou JSONLogic.

## 7.6 `transform`

```json
{
  "type": "transform",
  "set": {
    "approved": "{{outputs.review.approved}}"
  }
}
```

## 7.7 `subgraph`

Référence ou inline.

```json
{
  "type": "subgraph",
  "graph": "review-loop"
}
```

ou :

```json
{
  "type": "subgraph",
  "graph": {
    "name": "inline-review",
    "nodes": {},
    "edges": {}
  }
}
```

## 7.8 `thought-graph`

Pour Graph of Thoughts.

```json
{
  "type": "thought-graph",
  "strategy": "got",
  "operations": [
    { "op": "generate", "n": 5 },
    { "op": "score", "criteria": "correctness" },
    { "op": "keepBest", "n": 2 },
    { "op": "aggregate" }
  ]
}
```

---

# 8. Gestion du contexte par nœud

C’est central.

```json
"context": {
  "mode": "current"
}
```

Modes :

```text
current   utilise la session Pi courante
fork      fork de la session avant le run
fresh     session vierge
selected  messages précis de la session
none      aucun contexte conversationnel
```

Exemple :

```json
"context": {
  "mode": "selected",
  "messages": ["entry-id-a", "entry-id-b"]
}
```

Pour les sub-agents, on mappe vers `pi-subagents` :

```text
fresh → context: "fresh"
fork  → context: "fork"
none  → context fresh + task construit uniquement depuis inputs
```

Pour `current-session`, il faudra être prudent : le graph pilote la session active, mais Pi reste le parent.

---

# 9. Compilation vers LangGraph.js

Le module `runtime/compile.ts` transforme le JSON en `StateGraph`.

Pseudo-code :

```ts
const builder = new StateGraph(GraphState)

for (const [nodeId, nodeConfig] of Object.entries(graph.nodes)) {
  builder.addNode(nodeId, createNodeHandler(nodeConfig), {
    ends: dynamicEndsIfNeeded
  })
}

builder.addEdge(START, graph.start)

for (const edge of graph.edges) {
  if (edge.type === "static") {
    builder.addEdge(edge.from, edge.to)
  }

  if (edge.type === "conditional") {
    builder.addConditionalEdges(edge.from, router, edge.routes)
  }
}

return builder.compile({ checkpointer })
```

LangGraph impose :

- compilation obligatoire avant exécution ;
- `thread_id` pour checkpoints ;
- `Command({ resume })` pour reprise après interrupt ;
- `interrupt()` uniquement avec payload JSON sérialisable ;
- attention à l’idempotence des nœuds.

---

# 10. Checkpoints et runs

## Priorité

La sauvegarde concerne d’abord les graphes.

Les runs sauvegardés sont optionnels.

```json
{
  "saveRun": true
}
```

## Emplacement

```text
~/.pi/agent/graph-runs/
.pi/graph-runs/
```

Ou, mieux, sous la session Pi courante :

```text
~/.pi/agent/sessions/<session-id>/graph-runs/<run-id>/
```

## Contenu

```text
run.json
state.json
events.jsonl
checkpoints.sqlite
outputs/
preview.md
```

## Checkpointer

MVP :

```ts
MemorySaver
```

V0.2 :

```text
SQLite checkpointer
```

Dépendance possible :

```text
@langchain/langgraph-checkpoint-sqlite
```

---

# 11. Human-in-the-loop

LangGraph :

```ts
interrupt(payload)
```

Pi :

```ts
ctx.ui.select(...)
ctx.ui.confirm(...)
ctx.ui.input(...)
```

Flow recommandé :

1. nœud `human` appelle `interrupt(payload)` ;
2. runner détecte `__interrupt__` ;
3. affiche UI Pi ;
4. reprend avec :

```ts
new Command({ resume: userResponse })
```

Important : les payloads doivent être JSON-serializable.

---

# 12. Intégration `pi-subagents`

Je recommande d’en faire une dépendance logique, mais pas forcément une dépendance npm dure dès le début.

## Option MVP

`pi-graph` appelle le tool `subagent` s’il est disponible.

Node :

```json
{
  "type": "agent",
  "agentMode": "subagent",
  "agent": "reviewer",
  "task": "Review {{state.diff}}"
}
```

Devient :

```ts
subagent({
  agent: "reviewer",
  task,
  context: "fresh" | "fork"
})
```

## Node chain

```json
{
  "type": "subagent-chain",
  "chain": [...]
}
```

Devient :

```ts
subagent({
  chain: [...]
})
```

## Attention

Il faudra prévoir :

- absence de `pi-subagents` ;
- version incompatible ;
- statut des sub-runs ;
- propagation des erreurs ;
- mapping des outputs vers `state`.

---

# 13. Preview et validation

Lors d’un `create` ou `update`, on impose :

1. validation JSON Schema ;
2. validation sémantique :
   - start existe ;
   - tous les nodes référencés existent ;
   - pas d’edge orphelin ;
   - subgraphs résolubles ;
   - condition routes valides ;
   - contexte valide ;
3. preview :
   - résumé texte ;
   - Mermaid ;
   - liste des risques ;
4. confirmation utilisateur si UI disponible.

Exemple de retour :

```md
Graph: review-loop
Nodes: 4
Edges: 5
Subgraphs: 0
Human gates: 1
Cycles: implement -> review -> implement

Mermaid:
graph TD
  START --> implement
  implement --> review
  review --> decide
  decide -->|approved| END
  decide -->|revise| implement
```

---

# 14. Rendu TUI

S’inspirer de `pi-subagents`.

MVP :

- rendu tool result en Markdown ;
- statut compact ;
- graph Mermaid texte ;
- liste nodes avec statuts.

Statuts :

```text
pending
running
completed
failed
interrupted
waiting-human
skipped
```

V0.2 :

- widget persistant ;
- rendu arborescent ;
- affichage subgraph ;
- expand/collapse ;
- notifications de run terminé.

---

# 15. Graph of Thoughts

À implémenter après le moteur de base.

Concepts à reprendre :

- `Generate`
- `Score`
- `ValidateAndImprove`
- `Improve`
- `Aggregate`
- `KeepBestN`
- `KeepValid`
- `Selector`
- `GroundTruth`

Dans `pi-graph`, ça devient des nœuds ou opérations spécialisées.

Exemple :

```json
{
  "type": "thought-graph",
  "replaceThinking": true,
  "operations": [
    {
      "op": "generate",
      "branches": 5,
      "prompt": "Propose solution strategies for {{state.problem}}"
    },
    {
      "op": "score",
      "criteria": ["correctness", "simplicity", "risk"]
    },
    {
      "op": "keepBest",
      "n": 2
    },
    {
      "op": "aggregate",
      "prompt": "Merge the best strategies into one plan"
    }
  ]
}
```

Objectif long terme :

> remplacer un thinking linéaire invisible par un raisonnement graphé, explicite et inspectable.

---

# 16. Phases d’implémentation

## Phase 0 — Scaffold package

- créer `package.json`;
- extension Pi minimale ;
- tool `graph`;
- action `doctor`;
- tests unitaires setup.

Livrable :

```text
graph({ action: "doctor" })
```

---

## Phase 1 — Graph store

Implémenter :

- `list`;
- `get`;
- `create`;
- `update`;
- `delete`;
- scopes user/project/package ;
- résolution des conflits.

Livrable :

```text
graph({ action: "list" })
graph({ action: "create", config })
graph({ action: "get", name })
```

---

## Phase 2 — Schema + validation

Implémenter :

- TypeBox schemas ;
- validation structurelle ;
- validation sémantique ;
- normalisation ;
- messages d’erreur lisibles.

Livrable :

```text
graph({ action: "validate", config })
```

---

## Phase 3 — Preview

Implémenter :

- preview Markdown ;
- Mermaid ;
- analyse cycles ;
- liste nodes/edges ;
- risques.

Livrable :

```text
graph({ action: "preview", config })
graph({ action: "render", name })
```

---

## Phase 4 — LangGraph runner minimal

Implémenter :

- compilation JSON → `StateGraph`;
- `start`;
- static edges ;
- conditions simples ;
- state générique ;
- `transform`;
- `end`.

Livrable :

```text
graph({ action: "run", name, input })
```

sur un graph sans agents.

---

## Phase 5 — Human node

Implémenter :

- `interrupt()`;
- reprise avec `Command({ resume })`;
- UI Pi ;
- mode non-UI avec retour interrupt.

Livrable :

```text
graph({ action: "run", name: "approval-flow" })
graph({ action: "resume", id, input })
```

---

## Phase 6 — Intégration subagents

Implémenter :

- node `agentMode: subagent`;
- node `subagent-chain`;
- context `fresh/fork/none`;
- récupération output ;
- gestion erreurs.

Livrable :

```text
review-loop.json
```

avec :

```text
worker → reviewer → human approval → condition → worker/end
```

---

## Phase 7 — Current-session agent mode

Implémenter avec prudence :

- injection de message dans la session courante ;
- contrainte système temporaire ;
- attente de résultat ;
- mapping vers state.

C’est plus complexe que subagent. À faire après.

---

## Phase 8 — Runs sauvegardés

Implémenter :

- `saveRun`;
- `status`;
- `history`;
- `resume`;
- stockage JSONL ;
- checkpoint SQLite si possible.

Livrable :

```text
graph({ action: "status", id })
graph({ action: "history", id })
```

---

## Phase 9 — TUI avancé

Implémenter :

- widget ;
- renderer custom ;
- preview dialog ;
- confirmation create/update ;
- statut live.

---

## Phase 10 — Graph of Thoughts

Implémenter :

- node `thought-graph`;
- ops `generate/score/keepBest/aggregate/improve`;
- preview du reasoning graph ;
- option `replaceThinking`.

---

# 17. Tests

## Unitaires

- graph schema ;
- graph validation ;
- store scopes ;
- edge validation ;
- context policy ;
- graph compiler ;
- condition router ;
- template rendering.

## Intégration

- run simple ;
- run avec condition ;
- run avec human interrupt ;
- resume ;
- subgraph reference ;
- subgraph inline ;
- subagent node mocké ;
- sauvegarde run optionnelle.

## Golden tests

Des graphes exemples dans :

```text
test/fixtures/graphs/
```

---

# 18. Premier graph exemple à livrer

`graphs/review-loop.json`

```json
{
  "name": "review-loop",
  "version": 1,
  "description": "Implement, review, ask approval, revise until accepted",
  "start": "implement",
  "nodes": {
    "implement": {
      "type": "agent",
      "agentMode": "subagent",
      "agent": "worker",
      "context": { "mode": "fork" },
      "task": "Implement: {{state.task}}"
    },
    "review": {
      "type": "agent",
      "agentMode": "subagent",
      "agent": "reviewer",
      "context": { "mode": "fresh" },
      "task": "Review implementation output: {{outputs.implement}}"
    },
    "approval": {
      "type": "human",
      "mode": "select",
      "question": "Approve this implementation?",
      "options": ["approve", "revise", "abort"]
    },
    "decide": {
      "type": "condition",
      "routes": {
        "approve": "end",
        "revise": "implement",
        "abort": "end"
      },
      "from": "outputs.approval"
    }
  },
  "edges": {
    "implement": "review",
    "review": "approval",
    "approval": "decide"
  }
}
```

---

# 19. Recommandation d’ordre réel

Je ferais exactement ceci :

1. scaffold extension ;
2. tool `graph`;
3. JSON Schema ;
4. store user/project ;
5. preview Mermaid ;
6. compile LangGraph minimal ;
7. human interrupt ;
8. subagent node ;
9. subagent-chain node ;
10. run save/status/resume ;
11. TUI ;
12. Graph of Thoughts.

Ça donne rapidement un MVP utile sans bloquer sur les parties les plus complexes.