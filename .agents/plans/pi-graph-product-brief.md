# Vision produit : pi-graph

## 1. Définition courte

**pi-graph est un runtime de graphes qui pilote le comportement d’une ou plusieurs sessions Pi.**

Pi continue d’exécuter ses turns normalement, mais pi-graph décide :

- quel nœud est actif ;
- quel contexte est visible pour ce turn ;
- quels tools sont exposés ou interdits ;
- si l’agent agit dans la session courante, un subagent, une session forkée ou un sous-graphe ;
- si le flow continue automatiquement ou attend une entrée humaine ;
- comment le state évolue sans polluer la context window ;
- comment les transitions, traces et résultats de nodes sont visualisés dans la TUI.

Formule :

```text
Pi exécute les turns.
pi-graph contrôle les conditions du turn.
LangGraph fournit la sémantique de state, routing, interrupt, subgraph, branching.
```

## 2. Principe fondamental

Il ne faut pas remplacer Pi par un “mini-agent loop” bricolé.

Il faut faire de pi-graph une couche de contrôle autour du runtime Pi existant :

```text
graph node active
  -> build state frame
  -> configure visible context
  -> configure available tools
  -> let Pi run its normal turn
  -> observe result
  -> update graph state
  -> route next node
```

Donc un nœud `agent` n’est pas forcément “un appel LLM brut”.  
C’est plutôt :

```text
un turn Pi contrôlé par un node graph
```

## 3. Les deux plans : graph et session

Il faut distinguer :

### Graph runtime

Le graph connaît :

```text
nodes
edges
state
interrupts
subgraphs
branches
composition
routing
traces
transition limits
```

### Pi session runtime

La session Pi connaît :

```text
messages
model
tools
streaming
tool execution
steering
follow-up
UI/TUI
events
session tree
```

pi-graph fait le pont.

```text
Graph state décide.
Pi session exécute.
```

## 4. Node agent

Un `agent node` représente une phase où un modèle peut raisonner et agir.

```json
{
  "id": "research_query",
  "type": "agent",
  "config": {
    "target": "current-session",
    "tools": ["web_search", "fetch_content"],
    "toolPolicy": "allow-listed",
    "autoContinue": true
  }
}
```

Ce node peut choisir :

```text
target = current-session
target = subagent
target = fork
target = dedicated-session
```

Même logique de graph, cible différente.

## 5. Node tool

Un `tool node` est différent d’un tool exposé à l’agent.

### Tool exposé à l’agent

L’agent décide s’il l’appelle :

```text
agent node sees tools: web_search, read, bash
model chooses tool call
Pi executes normal tool path
```

### Tool node déterministe

Le graph appelle le tool sans demander au modèle :

```text
node: run_tests
type: tool
tool: bash
input: npm test
```

Donc :

```text
agent-visible tools = affordances du modèle pendant un turn
tool nodes = étapes déterministes du flow
```

## 6. Tool exposure par node

Chaque `agent node` devrait pouvoir définir :

```json
{
  "tools": {
    "allow": ["read", "find", "web_search"],
    "deny": ["bash", "edit"],
    "mode": "allow-list"
  }
}
```

Ou :

```json
{
  "tools": {
    "profile": "research-only"
  }
}
```

Donc pi-graph contrôle avant le turn :

```text
ce que l’agent sait
ce que l’agent peut faire
ce que l’agent ne peut pas faire
```

## 7. TUI graph inspector

Il faut un élément TUI dédié pour voir précisément :

```text
current node
previous node
next candidate routes
transition just taken
node input frame
node output summary
state patch
state diff
tool calls
interrupt payload
auto-step counters
shortest paths to human input
run artifacts path
```

Vue utile :

```text
pi-graph run graph_123
composition: dev
current: research.query
path: start -> split -> research.query

last transition:
  split -> research.query
  reason: branch "research" selected

state diff:
  + work.focus = "research"
  + traces[3] = "research.query entered"

auto:
  steps: 3/8
  shortest human path: research.query -> synthesize -> approve_plan (2)
```

Actions TUI :

```text
open node result
open state diff
open trace file
choose route
pause auto-run
resume
jump to human node if allowed
```

## 8. State frame

Le state complet ne doit pas être injecté.

Chaque node produit une **state frame** : la vue minimale utile pour ce turn.

```text
full graph state      -> checkpoint/store
node state frame      -> visible to model
old frames            -> removed from active context
tool outputs          -> receipts, not state storage
```

Exemple frame enrichie :

```text
pi-graph frame
run: graph_123
composition: dev
node: research_query
goal: clarify graph kernel runtime

run trace:
- nodes visited: 4
- current path: start -> split -> research_query
- last transition: split -> research_query
- trace artifact: .pi/graph-runs/graph_123/trace.json
- use graph_trace/read tools if details are needed

known branches:
- agent-node-semantics: active
- interrupt-model: parked

allowed tools:
- web_search
- fetch_content
- graph_trace.read
- graph_route.list

auto:
- auto steps: 4/8
- shortest path to human input: research_query -> synthesis -> approve_plan
- transitions to human input: 2

instruction:
Generate research queries. Do not edit files.
```

Important : la frame donne des **pointeurs** vers les traces, pas tout le contenu.

## 9. Trace access tools

Le main agent doit pouvoir consulter le run concretement sans tout avoir en contexte.

Tools possibles :

```text
graph_trace.status(runId)
graph_trace.read(runId, nodeId?)
graph_trace.diff(runId, transitionId?)
graph_route.list(runId)
graph_route.shortestTo(runId, targetKind="human")
graph_node.result(runId, nodeId)
```

Ça permet :

```text
frame courte
trace complète hors contexte
lecture ciblée si besoin
```

## 10. Sliding minimal

Même sans moteur d’injection avancé :

```text
before turn:
  remove previous pi-graph-frame messages from LLM context
  inject current frame only

after turn:
  extract graph-relevant result
  write state/checkpoint/trace
  do not persist full state as visible transcript
```

Le transcript Pi peut garder une trace humaine, mais le modèle ne doit pas revoir toutes les anciennes frames à chaque turn.

## 11. Continuation automatique

Si un flow entre dans une suite de nodes sans input humain, pi-graph peut continuer via steering Pi.

```text
node A done
graph routes to node B
node B does not require human input
pi-graph schedules steering:
  "continue graph run X at node B"
```

Tant qu’on n’atteint pas :

```text
wait_for_input
interrupt
human node
ambiguous route
budget exceeded
error
max transition before human input
```

le graph peut continuer.

## 12. Garde-fous d’auto-run

Garde-fous :

```text
maxAutoSteps
maxAutoTurns
maxWallTime
maxToolCalls
maxContextRatio
maxTransitionsBeforeHumanInput
stopOnAmbiguousRoute
stopOnFailedValidation
```

`maxTransitionsBeforeHumanInput` est différent de `maxAutoSteps`.

```text
maxAutoSteps = limite générale de continuation auto
maxTransitionsBeforeHumanInput = oblige à rencontrer un node human/input dans N transitions
```

Exemple :

```json
{
  "auto": {
    "maxAutoSteps": 8,
    "maxTransitionsBeforeHumanInput": 5
  }
}
```

Si le chemin courant ne peut pas atteindre de human/input dans la limite :

```text
pi-graph stoppe et demande une décision
```

## 13. Shortest path to human input

À chaque node, pi-graph devrait calculer :

```text
chemins les plus courts vers:
- human node
- interrupt node
- wait_for_input node
```

Dans la frame :

```text
auto:
- auto steps: 4/8
- transitions before human required: 3/5 remaining
- nearest human input:
  1. approve_plan in 2 transitions
  2. clarify_scope in 4 transitions
```

Dans la TUI :

```text
nearest HITL:
  research_query -> synthesis -> approve_plan (2)
  research_query -> clarify_scope (4)
```

Si aucun chemin humain connu :

```text
warning: no reachable human/input node from current node
```

## 14. Steering / follow-up

Pi sait déjà gérer :

```text
steering
followUp
pending messages
turn timing
```

Donc pi-graph peut s’appuyer dessus.

```text
graph continuation intent -> Pi steering queue
human/user follow-up -> Pi normal queue
graph waits only at explicit wait node / interrupt
```

## 15. Interrupts

`interrupt()` est la primitive correcte pour pause contrôlée.

À respecter :

```text
interrupt sauvegarde le state via checkpointer
resume se fait avec Command({ resume })
le node reprend depuis le début du node
tout code avant interrupt est rejoué
```

Donc :

```text
pas d’effet externe avant interrupt
ou effet idempotent
ou action placée après resume
```

Types utiles :

```text
wait_user_clarification
approve_tool_call
edit_state
choose_branch
resolve_ambiguity
approve_plan
```

## 16. Node human vs interrupt

Un node `human` est une abstraction pi-graph.

Sous le capot :

```text
human node = UX / schema / payload
interrupt = primitive runtime
```

Exemple :

```json
{
  "id": "choose_focus",
  "type": "human",
  "config": {
    "prompt": "Which branch should continue?",
    "resumeSchema": {
      "branch": "string"
    }
  }
}
```

## 17. Subagents

Il faut distinguer plusieurs concepts.

### Agent node ciblant un subagent

```text
node agent
target: subagent
await: true
```

Le parent attend le résultat.

### Agent node parallèle

```text
node agent
target: subagent
parallel: true
await: false
```

Le parent continue, et le state tracke :

```text
job id
status
result path
callback route
```

### Subgraph node

Un sous-graphe est un graph utilisé comme node.

Il peut :

```text
partager le state parent
ou avoir son state privé
ou transformer input/output
```

### Sous-graphes parallèles avec subagents dédiés

```text
parent graph
  -> split task
  -> launch subgraph A in subagent 1
  -> launch subgraph B in subagent 2
  -> continue or await join
```

À modéliser :

```text
executionTarget: current-session | subagent | fork | remote
executionMode: inline | parallel | async
stateMode: shared | mapped | private
awaitPolicy: wait | detach | join-later
```

## 18. Branches

Les branches sont produites par des nodes spécialisés :

```text
split
branch
map
fork
research_fanout
parallel_review
```

Un node `split` peut écrire :

```json
{
  "work.items": {
    "kernel": { "status": "active" },
    "composition": { "status": "parked" },
    "interrupts": { "status": "parked" }
  },
  "work.focus": "kernel"
}
```

Le kernel sait seulement :

```text
appliquer un state patch
router
checkpoint
reprendre
```

## 19. Subgraphs

Deux modes utiles :

### Shared state

Le sous-graphe lit/écrit certains channels du parent.

Bon pour :

```text
review loop
verification loop
research loop simple
```

### Mapped/private state

Le parent transforme son state vers le subgraph, puis récupère un output.

Bon pour :

```text
subagent spécialisé
recherche isolée
expérimentation parallèle
branche async
```

## 20. Graph definitions vs compositions

### Graph file

Petit, local, réutilisable.

```json
{
  "id": "research",
  "defaultEntry": "question",
  "nodes": {
    "question": {},
    "search": {},
    "synthesis": {}
  }
}
```

Pas de `research.question`.

### Composition file

Lie plusieurs graphes.

```json
{
  "graphs": ["kernel", "research", "implementation"],
  "links": [
    { "from": "kernel.split", "to": "research.question" },
    { "from": "research.synthesis", "to": "implementation.plan" }
  ]
}
```

## 21. Modes d’activation

Même runtime, plusieurs cibles :

```text
pi-graph activate --composition dev
  -> controls current Pi session

pi-graph run --composition review --target subagent
  -> controls a subagent session

pi-graph launch --graph research --parallel 3
  -> launches graph-controlled subagent sessions
```

## 22. Architecture runtime cible

```text
PiGraphRuntime
  - loads graph definitions
  - loads composition
  - resolves graph.node links
  - owns checkpointer
  - owns graph state
  - owns trace store
  - selects active node
  - builds node state frame
  - computes shortest human paths
  - configures Pi session turn
  - observes Pi result
  - applies state patch
  - records state diff
  - routes next node
```

```text
PiSessionAdapter
  - current session
  - subagent session
  - forked session
  - dedicated session
```

```text
NodeExecutors
  - agent node
  - tool node
  - human node
  - subgraph node
  - split/branch node
  - join node
  - store node
```

```text
TuiGraphInspector
  - current node
  - path
  - transitions
  - node results
  - state diffs
  - shortest paths
  - auto-run counters
```

## 23. Ce que pi-graph contrôle par turn

Pour un `agent node` :

```text
context frame
trace summary
system additions
visible messages
tool allowlist
model override optional
thinking level optional
cwd optional
auto-continue policy
expected output contract
```

Pi exécute ensuite normalement :

```text
turn_start
context transform
model stream
tool calls
tool execution
turn_end
```

## 24. Ce qu’il ne faut pas faire

Ne pas mettre tout dans les tool outputs.

Ne pas transformer le graph en énorme pipeline figée.

Ne pas faire du state global trop typé trop tôt.

Ne pas cacher les traces hors d’accès : il faut des tools/routes pour les lire.

Ne pas oublier le chemin vers input humain : l’agent doit savoir quand il approche d’une pause.

## 25. MVP réaliste

```text
1. graph definitions sans namespace interne
2. composition files avec graph.node
3. active graph session state
4. agent node controlling current session context + tools
5. tool node déterministe
6. human node via interrupt-like waiting
7. state frame sliding minimal
8. auto-continue via Pi steering
9. run traces + trace read tools
10. TUI graph inspector
11. shortest path to human/input
12. maxTransitionsBeforeHumanInput
```

Pas encore :

```text
auto self-improvement
context-tree integration complète
complex memory vectorielle
remote distributed runtime
```

## Résumé

```text
pi-graph n’est pas un outil appelé par l’agent.
pi-graph est le contrôleur de comportement d’une session Pi.
```

Pi reste excellent pour :

```text
streaming
tools
session UX
steering
subagents
messages
```

pi-graph ajoute :

```text
state machine
composition de graphes
node-level context/tool policy
branching
subgraphs
interrupts
async subagent flows
sliding state frame
trace inspector
shortest HITL paths
auto-run limits
```

Phrase clé :

```text
Pi fait le turn. pi-graph décide dans quel état, avec quel contexte, quels tools, quelle cible, quelle trace visible, quelle limite d’autonomie, et quelle suite.
```