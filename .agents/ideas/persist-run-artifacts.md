# Idée d'amélioration — persistance des artefacts de run pi-graph

## Contexte

Pendant l'utilisation du flow `understand`, un run sauvegardé avec `saveRun: true` reste actuellement stocké uniquement en mémoire.

Exemple :

```text
graph-2026-06-02T133211523Z-8b3a28bc
```

On peut consulter son statut et son historique tant que la session Pi reste active :

```js
graph({ action: "status", id: "<run-id>" })
graph({ action: "history", id: "<run-id>" })
```

Mais aucun artefact n'est écrit sur disque. Si Pi est relancé, le run est perdu.

## Amélioration proposée

Ajouter une vraie persistance des runs dans un dossier dédié.

Structure possible :

```text
.pi/graph-runs/<run-id>/
  run.json
  history.json
  final-state.json
  graph.json
  graph.mmd
  graph.svg
  summary.md
```

## Contenu attendu

### `run.json`

Métadonnées du run :

- id
- graphName
- status
- createdAt
- updatedAt
- input initial
- currentNode
- interrupt courant si présent
- artifact paths

### `history.json`

Historique complet :

- run_started
- run_waiting
- run_resumed
- node_completed
- run_completed
- run_failed
- run_interrupted

### `final-state.json`

État complet final ou dernier état connu :

- input
- state
- outputs
- errors
- events
- run

Pour `understand`, ce fichier doit contenir le `understand_context` final.

### `graph.json`, `graph.mmd`, `graph.svg`

Snapshot du graphe utilisé par le run.

Cela permet de conserver la visualisation exacte du flow exécuté, même si le graphe source change ensuite.

### `summary.md`

Résumé lisible du run :

- objectif
- graphe utilisé
- statut
- étapes traversées
- contexte final produit
- liens vers les artefacts

## Actions associées

Ajouter ou modifier les actions du tool `graph` :

```js
graph({ action: "status", id: "<run-id>" })
graph({ action: "history", id: "<run-id>" })
graph({ action: "get-run", id: "<run-id>" }) // optionnel
graph({ action: "list-runs" }) // optionnel
```

## Critères d'acceptation

- `saveRun: true` écrit un dossier `.pi/graph-runs/<run-id>/`.
- Un run terminé peut être retrouvé après redémarrage de Pi.
- Le `understand_context` final est disponible dans `final-state.json` ou `summary.md`.
- Le graphe exécuté est archivé avec JSON, MMD et SVG.
- `graph status/history` peut lire depuis la mémoire si disponible, sinon depuis le disque.

## Lien avec les autres améliorations

Cette idée est complémentaire à :

- génération Mermaid SVG par graphe ;
- widget TUI affichant le chemin du SVG ;
- reprise d'un flow `plan` depuis un run `understand` sauvegardé ;
- composition future `understand -> plan -> implementation`.
