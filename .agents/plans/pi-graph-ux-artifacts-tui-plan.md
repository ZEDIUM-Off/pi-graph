# Plan consolidé — pi-graph UX, artefacts et TUI interactif

## Objectif

Améliorer `pi-graph` avec :

- artefacts par graphe : `graph.json`, `graph.mmd`, `graph.svg`, `manifest.json` ;
- génération Mermaid/SVG robuste avec fallback ;
- widget TUI persistant en session courante pendant `graph run/resume` ;
- dashboard compact affichant run, état, nœud courant, routes, prompt et artefacts ;
- raccourcis clavier pour choisir les routes sans re-prompter ;
- picker pour beaucoup de chemins ;
- reset state sécurisé avec confirmation.

## Décisions principales

### Artefacts

- Garder la compatibilité avec le stockage plat actuel : `.pi/graphs/<name>.json`.
- Ajouter un dossier d’artefacts en parallèle :
  - graphes project/user : `.pi/graphs/<name>/`
  - graphes builtin : `.pi/graph-artifacts/builtin/<name>/`
- Ne jamais écrire dans `graphs/` pour les builtins.
- Écrire :
  - `graph.json`
  - `graph.mmd`
  - `graph.svg`
  - `manifest.json`
- `manifest.json` contient hash JSON/MMD/version renderer pour éviter les rendus inutiles.
- Si SVG échoue : warning lisible, `graph.mmd` conservé, flow non cassé.

### Mermaid

- Ajouter `@mermaid-js/mermaid-cli`.
- Utiliser une abstraction `GraphSvgRenderer` testable.
- Implémentation par défaut : `mmdc -i graph.mmd -o graph.svg` ou import dynamique `run()` si fiable.
- Tests avec renderer fake.
- Timeout + fallback obligatoire.

### TUI

Le widget doit être un dashboard compact, pas une liste brute.

Exemple cible :

```text
╭─ pi-graph ─ understand ─ waitingRoute ────────────────╮
│ run   graph-2026...                                   │
│ node  hub                                             │
│ state waiting for route                               │
├─ routes 1-6/24 ───────────────────────────────────────┤
│ 1 auth-flow        2 checkout-page     3 dashboard     │
│ 4 settings-form    5 data-table        6 search        │
│ … 18 more · ctrl+g picker                              │
├─ actions ─────────────────────────────────────────────┤
│ alt+1..9 choose visible · ctrl+g picker · ctrl+r reset │
│ svg file:///.../.pi/graph-artifacts/builtin/...svg     │
╰───────────────────────────────────────────────────────╯
```

États à rendre distinctement :

- `running`
- `waitingRoute`
- `waitingInput`
- `completed`
- `failed`
- `interrupted`
- `stale`

Règles :

- toujours respecter la largeur terminal ;
- tronquer proprement ;
- routes peu nombreuses : grille compacte ;
- nombreuses routes : sous-ensemble visible + `+ X more` + `ctrl+g picker` ;
- ne pas afficher de raccourcis route sur un `waitingInput` structuré.

### Raccourcis et picker

- `setWidget` sert à afficher.
- Pour capter les touches, ajouter un `CustomEditor` wrapper optionnel.
- Intercepter seulement :
  - `alt+1..alt+9` : choisir une route visible ;
  - `ctrl+g` : ouvrir le picker de routes ;
  - `ctrl+r` : reset avec confirmation.
- Toutes les autres touches sont déléguées à l’éditeur Pi normal.
- `shortcuts:false` désactive l’interception clavier mais garde le widget.
- Sans UI, comportement texte classique inchangé.

### Reset state

`ctrl+r` ne doit jamais être destructif directement.

Il ouvre une confirmation :

```text
╭─ reset pi-graph run ─────────────────╮
│ 1 restart from initial input          │
│ 2 abandon run and clear widget        │
│ 3 keep run, clear selection state     │
│ esc cancel                            │
╰──────────────────────────────────────╯
```

## Implémentation par étapes

1. Ajouter chemins d’artefacts dans `src/shared/paths.ts`.
2. Créer `src/graphs/graph-artifacts.ts` avec `ensureGraphArtifacts(...)`.
3. Ajouter `@mermaid-js/mermaid-cli` dans `package.json`.
4. Brancher artefacts dans `createGraph`, `updateGraph`, `preview`, `render`, `run`.
5. Enrichir `RunRecord` / `publicRecord` :
   - `graphName`
   - `currentNode`
   - `nextRoutes`
   - `interrupt prompt`
   - `artifacts`
6. Modifier `runGraph` / `resumeGraph` pour accepter :
   - `artifacts?`
   - `onUpdate?`
   - `graph?`
7. Créer/remplacer le rendu TUI :
   - `src/tui/render.ts`
   - `src/tui/graph-status-widget.ts`
8. Ajouter un `GraphSessionController` :
   - maintient run actif ;
   - maintient routes visibles ;
   - expose `chooseRoute(route)` ;
   - appelle `resumeGraph(runId, { next: route })`.
9. Ajouter wrapper `CustomEditor` optionnel pour raccourcis.
10. Ajouter picker `ctrl+g` via `ctx.ui.custom`.
11. Ajouter reset `ctrl+r` avec confirmation.
12. Ajouter options schema :
    - `ui?: boolean`
    - `shortcuts?: boolean`
13. Ajouter `renderCall` / `renderResult` pour sortie transcript plus lisible.

## Fichiers clés

À modifier :

- `package.json`
- `src/extension/index.ts`
- `src/extension/schemas.ts`
- `src/runtime/runner.ts`
- `src/runtime/run-store.ts`
- `src/runtime/state.ts`
- `src/graphs/graph-store.ts`
- `src/graphs/graph-loader.ts`
- `src/graphs/graph-mermaid.ts`
- `src/shared/paths.ts`
- `src/tui/render.ts`
- `src/tui/graph-status-widget.ts`

À créer :

- `src/graphs/graph-artifacts.ts`
- `src/tui/graph-session-controller.ts`
- `test/graph-artifacts.test.ts`
- `test/tui-render.test.ts`
- `test/graph-session-controller.test.ts`

## Vérification

### Tests automatisés

- artefacts écrits correctement ;
- fallback SVG ne casse pas le flow ;
- manifest/hash évite les rendus inutiles ;
- compatibilité stockage plat ;
- `runGraph/resumeGraph` exposent `currentNode`, `nextRoutes`, `artifacts` ;
- dashboard respecte largeur terminal ;
- nombreuses routes rendues proprement ;
- états spéciaux distincts ;
- `alt+1..9` choisit route visible ;
- `ctrl+g` ouvre picker ;
- `ctrl+r` confirme avant reset ;
- `shortcuts:false` désactive interception ;
- mode sans UI fonctionne comme avant.

### Commandes

```bash
npm run typecheck
node --test --test-reporter spec --import tsx test/*.test.ts
```

### Checks manuels

- `graph list` charge sans warning ;
- `graph create/update` produit fichier plat + dossier artefacts ;
- `graph preview` builtin écrit dans `.pi/graph-artifacts/builtin/<name>/` ;
- `graph run understand` affiche dashboard belowEditor ;
- peu de routes : `alt+1/alt+2` fonctionne ;
- beaucoup de routes : widget compact + `ctrl+g` picker ;
- `waitingInput` n’affiche pas de raccourci trompeur ;
- `ctrl+r` demande confirmation ;
- Mermaid indisponible : warning + `.mmd`, pas de crash ;
- lien `file://graph.svg` ouvrable.

## Critères d’acceptation

- Artefacts générés sur create/update et preview/run.
- Fallback Mermaid robuste.
- Builtins read-only respectés.
- Widget TUI dashboard persistant, compact et esthétique.
- Gestion propre de peu/beaucoup de routes.
- Raccourcis + picker fonctionnels.
- Reset state sécurisé.
- États spéciaux bien différenciés.
- `shortcuts:false` et absence d’UI conservent le comportement classique.
- Tests existants verts.
