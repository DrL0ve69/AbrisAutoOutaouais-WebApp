// Copie l'hôte bilingue à la racine de l'artifact de build, à côté de `browser/`,
// pour que la commande de démarrage de production soit simplement
// `node serve-i18n.mjs` (cf. docs/deployment.md).
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'serve-i18n.mjs');
const distRoot = resolve(here, '../dist/abristempo-client');

if (!existsSync(distRoot)) {
  console.error(`✗ ${distRoot} introuvable — lance le build avant le postbuild.`);
  process.exit(1);
}

const dest = join(distRoot, 'serve-i18n.mjs');
copyFileSync(src, dest);
console.log(`✓ Hôte bilingue copié → ${dest}`);
