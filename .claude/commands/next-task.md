---
description: Reprend le programme AbrisTempo (épics A→F) à la prochaine sous-tâche en attente
---

Tu reprends le programme **« Compléter + Adresse + Mesurer + Redesign 10k »** d'AbrisTempo Local.
L'utilisateur veut que tu enchaînes la prochaine tâche en attente. Procède ainsi :

1. **Lis le pointeur de reprise** `docs/agile/PROGRAM-STATUS.md` (curseur courant + détail de la
   prochaine sous-tâche) **et** le plan complet `C:\Users\phili\.claude\plans\1-i-want-you-glistening-barto.md`
   (les 6 épics A→F, contraintes inter-épics, risques).

2. **Vérifie l'état réel avant d'agir** (ne fais jamais confiance au pointeur seul) :
   - `git branch --show-current` et `git log master..HEAD --oneline` (qu'est-ce qui est committé ?)
   - `git status --short` (du travail non committé d'une session coupée ?)
   - Si le travail réel diverge du pointeur, **réconcilie le pointeur d'abord**, puis annonce l'écart.

3. **Identifie la prochaine sous-tâche** depuis le pointeur, et confirme-la à l'utilisateur en une
   ligne avant de plonger (« Prochaine tâche : B4 — … ; je lance le cycle. »).

4. **Exécute via la boucle d'agents du repo** (cf. `CLAUDE.md` / `.claude/README.md`) :
   `solution-architect` (re-valider vs master) → `feature-developer` (implémenter) → gates
   (`dotnet test` ; depuis le client : `npm run i18n:extract`, `npm run build:prod`, `npm test`,
   `npm run e2e` — **zéro violation axe**) → `code-reviewer` indépendant (l'implémenteur ne valide
   jamais son propre diff ; backend → `solid-review` aussi) → `mentor` si la revue révèle un défaut
   systémique. Respecte `lessons-learned.md` (injecté au démarrage). Codebase en **français**, WCAG 2.2 AA.
   - *Économie de crédits (préférence utilisateur)* : un seul `feature-developer` à la fois ; revue
     complète aux **frontières d'épic** plutôt qu'à chaque sous-phase, sauf si l'utilisateur demande
     la batterie complète.

5. **Workflow standard de fin de tâches liées** (instruction permanente de l'utilisateur — voir
   `[[program-git-flow]]` en mémoire) : quand une **série de tâches liées est terminée** (typiquement
   la clôture d'un épic), enchaîne **revue → commit → PR → revue CI → sync/push vers `master`**.
   Pour une simple sous-tâche intermédiaire, **commit local** suffit (ne pas merger un épic à moitié).

6. **Ferme la boucle** : retourne les statuts (`docs/agile/board.md`, `product-backlog.md`, README
   roadmap, avant/après dans les audits), puis **mets à jour `docs/agile/PROGRAM-STATUS.md`** (curseur
   → prochaine sous-tâche/épic, date). C'est ce que la prochaine session relira.

7. **Avant de t'arrêter** (surtout si le contexte se remplit) : laisse le pointeur propre et dis à
   l'utilisateur exactement où ça en est et quoi taper pour reprendre (« continue la prochaine tâche »
   ou `/next-task`).

Si `$ARGUMENTS` est fourni, traite-le comme une instruction de cadrage (ex. un numéro d'épic précis
ou « juste committer ce qui est en attente ») au lieu de simplement prendre la prochaine sous-tâche.
