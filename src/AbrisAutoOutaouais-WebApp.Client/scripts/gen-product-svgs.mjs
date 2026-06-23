// Génère des images SVG légères (placeholders soignés) pour chaque produit.
// Une image par slug du ProductSeeder backend, sous public/images/products/.
// Lancer : node scripts/gen-product-svgs.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'images', 'products');
mkdirSync(outDir, { recursive: true });

// slug → { name, accent, icon }
// icon : 'shelter' (abri en pic), 'pente' (toit simple), 'rond' (toit arrondi),
//        'tarp' (toile), 'part' (pièce/accessoire), 'entry' (entrée).
//
// Depuis le rework « configure-only » (rework EPIC 9 / Phase 6), les abris fixes ont été retirés du
// catalogue : tous les abris sont désormais des MODÈLES paramétriques configurés via l'overlay. Les
// 8 slugs d'abris fixes (abri-simple-une-voiture, abri-pente-unique, abri-double-pic, abri-double-rond,
// abri-rangement-atelier, abri-industriel-commercial, abri-entree, abri-passage-cloture) ont donc été
// supprimés d'ici. Ne restent que les 4 produits NON-abris encore vendus directement (toiles, pièces).
// L'imagerie des cartes de MODÈLES paramétriques est gérée par catégorie : voir
// `scripts/gen-category-svgs.mjs` + `resolveShelterCategoryImage` (shelter.model.ts).
const products = [
  { slug: 'toile-remplacement-simple', name: 'Toile de remplacement — abri simple', accent: '#92400e', icon: 'tarp' },
  { slug: 'toile-remplacement-double', name: 'Toile de remplacement — abri double', accent: '#92400e', icon: 'tarp' },
  { slug: 'kit-ancrage-sol', name: "Kit d'ancrage au sol", accent: '#475569', icon: 'part' },
  { slug: 'attaches-fixations', name: 'Attaches et fixations (paquet)', accent: '#475569', icon: 'part' },
];

function icon(kind, accent) {
  // Pictogrammes vectoriels simples, centrés autour de (400, 250).
  const stroke = '#ffffff';
  const w = 5;
  switch (kind) {
    case 'pente': // toit à pente unique
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M250 320 L250 200 L550 150 L550 320" fill="${accent}" fill-opacity="0.35"/>
        <path d="M250 200 L550 150" />
        <path d="M250 320 L550 320" />
      </g>`;
    case 'rond': // toit arrondi
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M250 320 L250 230 Q400 130 550 230 L550 320 Z" fill="${accent}" fill-opacity="0.35"/>
        <path d="M250 230 Q400 130 550 230" />
      </g>`;
    case 'tarp': // toile pliée
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M250 180 L550 180 L520 330 L280 330 Z" fill="${accent}" fill-opacity="0.35"/>
        <path d="M250 180 Q400 230 550 180" />
        <path d="M280 330 Q400 280 520 330" />
      </g>`;
    case 'part': // boulon / ancrage
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <circle cx="400" cy="200" r="46" fill="${accent}" fill-opacity="0.35"/>
        <circle cx="400" cy="200" r="20" />
        <path d="M400 246 L400 340" />
        <path d="M372 330 L428 330" />
      </g>`;
    case 'entry': // petit abri d'entrée
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M320 320 L320 230 L400 170 L480 230 L480 320 Z" fill="${accent}" fill-opacity="0.35"/>
        <path d="M320 230 L400 170 L480 230" />
      </g>`;
    case 'shelter': // abri en pic (défaut)
    default:
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M250 320 L250 230 L400 150 L550 230 L550 320 Z" fill="${accent}" fill-opacity="0.35"/>
        <path d="M250 230 L400 150 L550 230" />
        <path d="M250 320 L550 320" />
      </g>`;
  }
}

function svg({ name, accent, icon: kind }) {
  const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${safe}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e2d3d"/>
      <stop offset="1" stop-color="#0f1923"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect y="380" width="800" height="220" fill="url(#ground)"/>
  <circle cx="650" cy="120" r="70" fill="${accent}" fill-opacity="0.18"/>
  ${icon(kind, accent)}
  <line x1="120" y1="380" x2="680" y2="380" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
  <text x="400" y="470" text-anchor="middle" font-family="'Sora', 'Segoe UI', sans-serif"
        font-size="34" font-weight="700" fill="#ffffff">${safe}</text>
  <text x="400" y="510" text-anchor="middle" font-family="'DM Sans', 'Segoe UI', sans-serif"
        font-size="20" fill="#ffffff" fill-opacity="0.6">AbrisTempo Outaouais</text>
</svg>
`;
}

for (const p of products) {
  writeFileSync(join(outDir, `${p.slug}.svg`), svg(p), 'utf8');
}
console.log(`Généré ${products.length} SVG dans ${outDir}`);
