# Tour de la boucle UI redesign

Tu exécutes UNE étape par tour. `MISSION.md` fixe le quoi et les règles ; ce fichier fixe le découpage.

## Au début de chaque tour

1. Lis `.claude/ui-redesign/MISSION.md` et `.ui-redesign/STATE.json` (absent au premier tour : crée-le avec `phase: "setup"`, crée la branche `redesign/ui` depuis `main`).
2. Si `status` vaut `done` ou `blocked` : affiche le bloc STATE et ne fais rien d'autre.
3. Vérifie que tu es sur `redesign/ui`.

## Machine à états

| Phase       | Étape d'un tour                                                                                                                  | Transition                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `setup`     | Scripts de capture, `.ui-redesign/before/`, double capture de contrôle                                                           | Déterministe → `diagnose`                                                                 |
| `diagnose`  | Diagnostic et notes de toutes les surfaces, ordre final dans `STATE.surfaces`                                                    | → `redesign`                                                                              |
| `redesign`  | Sur la surface courante, UNE sous-étape : `explore` (3 directions), `decide` (critique + design-plan), `build`, `refine` (max 2) | Surface ≥ 8,5 ou 2 refine faits → commit, surface suivante. Plus de surface → `coherence` |
| `coherence` | Un pattern partagé harmonisé par tour (`STATE.patterns`)                                                                         | File vide → `polish`                                                                      |
| `polish`    | Un lot de détails par tour, surface par surface                                                                                  | File vide → `report`                                                                      |
| `report`    | Captures `after/`, doc, `compare.html`, stop-slop, commit, push                                                                  | → `status: done`                                                                          |

## STATE.json

```json
{
  "phase": "redesign",
  "status": "running",
  "tick": 12,
  "surfaces": [
    {
      "id": "chat",
      "step": "refine",
      "refines": 1,
      "direction": "B-focused-column",
      "scores": { "before": 6.0, "current": 8.2 },
      "plan": "design-plans/redesign-chat.md"
    }
  ],
  "current": "chat",
  "patterns": [],
  "polish": [],
  "skipped": [],
  "toDecide": [],
  "reportPath": null
}
```

## Règles

- **Une étape par tour.** Ne passe pas à la sous-étape suivante dans le même tour.
- **Tout sur disque.** L'état vit dans `STATE.json`, `design-plans/` et `.ui-redesign/`. Le contexte sera compacté en route.
- **STATE en dernier**, après le commit ou l'écriture des fichiers.
- **Regarde les images.** Chaque critique s'appuie sur les captures ouvertes, pas sur la lecture du code.
- **Échec.** Build cassé ou checks rouges après deux tentatives : reviens au dernier commit, marque la surface `skipped` avec la raison, passe à la suivante. Trois surfaces skippées : `status: blocked`.
- **Pas d'attente.** Un arbitrage va dans `toDecide` et tu continues.
- **Fin de tour.** Termine toujours par :

```
STATE · tick <n> · phase <phase> · surface <current>/<step> · status <status>
Fait : <une ligne>
Scores : <surface avant → actuel, pour les surfaces touchées> · restantes : <n> · to decide : <n>
Report : <reportPath ou "-">
```
