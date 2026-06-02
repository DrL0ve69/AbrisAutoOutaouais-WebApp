Ce fichier explique comment Visual Studio a créé le projet.

Les outils suivants ont été utilisés pour générer ce projet :
- Angular CLI (ng)

Les étapes suivantes ont été utilisées pour générer ce projet :
- Créez un projet Angular avec ng : `ng new AbrisAutoOutaouais-WebApp.Client --defaults --skip-install --skip-git --no-standalone `.
- Mettez à jour angular.json avec le port.
- Créez le fichier projet (`AbrisAutoOutaouais-WebApp.Client.esproj`).
- Créez `launch.json` pour activer le débogage.
- Mettez à jour package.json pour ajouter `jest-editor-support`.
- Mettez à jour le script `start` dans `package.json` pour spécifier l’hôte.
- Ajoutez `karma.conf.js` pour les tests unitaires.
- Mettez à jour `angular.json` pour son pointage vers `karma.conf.js`.
- Ajoutez le projet à la solution.
- Écrivez ce fichier.
