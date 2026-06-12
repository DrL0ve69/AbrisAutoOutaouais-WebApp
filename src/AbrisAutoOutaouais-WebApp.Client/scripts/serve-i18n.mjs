// ============================================================
// Hôte bilingue (i18n compile-time) — sert les DEUX locales
// ============================================================
//
// L'i18n d'AbrisTempo est compile-time : `ng build --localize` produit une
// application par langue. Avec `subPath` (cf. angular.json), la locale source
// (fr) est à la racine de `browser/` et l'anglais sous `browser/en/`. `ng serve`
// ne sert qu'UNE locale ; ce serveur sert le français à « / » et l'anglais à
// « /en/ » (chacun avec repli SPA), reproduisant les baseHref de production.
//
//   • Dev    : npm run preview:i18n   (après npm run build:i18n)
//   • Prod   : node serve-i18n.mjs    (copié à la racine de l'artifact par le
//              postbuild ; commande de démarrage de l'App Service — voir
//              docs/deployment.md). PORT lu depuis l'environnement.
//
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Le shell client SSR est émis sous « index.csr.html » (et non index.html).
const INDEX = 'index.csr.html';

// Localise le dossier `browser/` selon le contexte d'exécution :
//  - copié à la racine de l'artifact (prod)  → ./browser
//  - lancé depuis scripts/ dans le dépôt (dev) → ../dist/abristempo-client/browser
const candidates = [
  resolve(here, 'browser'),
  resolve(here, '../dist/abristempo-client/browser'),
];
const browser = candidates.find((dir) => existsSync(join(dir, INDEX)));

if (!browser) {
  console.error(
    `\n✗ Build localisé introuvable.\n` +
      `  Cherché : ${candidates.join('  |  ')}\n` +
      `  Lance d'abord :  npm run build:i18n\n`,
  );
  process.exit(1);
}

const frIndex = join(browser, INDEX);
const enIndex = join(browser, 'en', INDEX);

const app = express();

// Cache long pour les ressources hachées (immuables) ; l'index reste revalidé.
app.use(
  express.static(browser, {
    index: INDEX,
    setHeaders: (res, path) => {
      if (path.endsWith(INDEX)) res.setHeader('Cache-Control', 'no-cache');
      else if (/-[A-Z0-9]{8,}\.[a-z0-9]+$/i.test(path))
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);

// Repli SPA : une route Angular sans fichier renvoie l'index de sa locale.
app.use((req, res) => {
  const isEn = req.path === '/en' || req.path.startsWith('/en/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(isEn ? enIndex : frIndex);
});

const port = process.env.PORT || 4300;
app.listen(port, () => {
  console.log(`\nHôte bilingue AbrisTempo :`);
  console.log(`  Français → http://localhost:${port}/`);
  console.log(`  English  → http://localhost:${port}/en/\n`);
});
