// Génère des images SVG légères (placeholders soignés) pour chaque CATÉGORIE d'abris paramétriques.
// Une image par slug de catégorie (cf. PARAMETRIC_CATEGORY_SLUGS / ProductSeeder), sous
// public/images/categories/. Les cartes de MODÈLES paramétriques (app-shelter-model-card) n'ont pas
// d'image propre par modèle (le référentiel serveur n'expose pas d'URL d'image) : on illustre donc la
// carte par sa CATÉGORIE, de façon déterministe, gratuite et sans clé (100 % local, vectoriel).
// Lancer : node scripts/gen-category-svgs.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'images', 'categories');
mkdirSync(outDir, { recursive: true });

// slug de catégorie → { name, accent, icon }. Les slugs MIROITENT ProductSeeder.cs.
//  icon : 'pic' (toit en pic), 'pente' (monopente), 'double' (deux pics), 'rangement' (mural fermé),
//         'entry' (petit auvent d'entrée), 'industriel' (grand portique).
const categories = [
  { slug: 'abris-simples', name: 'Abris simples', accent: '#b91c1c', icon: 'pic' },
  { slug: 'abris-monopente', name: 'Abris monopente', accent: '#b91c1c', icon: 'pente' },
  { slug: 'abris-doubles', name: 'Abris doubles', accent: '#9a1212', icon: 'double' },
  { slug: 'abris-rangement', name: 'Abris de rangement', accent: '#1e40af', icon: 'rangement' },
  { slug: 'abris-entree-passage', name: "Abris d'entrée et de passage", accent: '#1e40af', icon: 'entry' },
  { slug: 'abris-industriels', name: 'Abris industriels et commerciaux', accent: '#0f766e', icon: 'industriel' },
];

function icon(kind, accent) {
  const stroke = '#ffffff';
  const w = 5;
  const fill = `fill="${accent}" fill-opacity="0.35"`;
  switch (kind) {
    case 'pente': // monopente : toit incliné, une seule pente
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M250 320 L250 210 L560 150 L560 320 Z" ${fill}/>
        <path d="M250 210 L560 150" />
        <path d="M250 320 L560 320" />
      </g>`;
    case 'double': // deux pics côte à côte
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M210 320 L210 240 L320 165 L430 240 L430 320 Z" ${fill}/>
        <path d="M370 320 L370 240 L480 165 L590 240 L590 320 Z" ${fill}/>
        <path d="M210 240 L320 165 L430 240" />
        <path d="M370 240 L480 165 L590 240" />
      </g>`;
    case 'rangement': // remise murale fermée + porte
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M280 320 L280 220 L400 160 L520 220 L520 320 Z" ${fill}/>
        <path d="M280 220 L400 160 L520 220" />
        <rect x="375" y="250" width="50" height="70" />
      </g>`;
    case 'entry': // petit auvent d'entrée
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M330 320 L330 240 L400 185 L470 240 L470 320 Z" ${fill}/>
        <path d="M330 240 L400 185 L470 240" />
      </g>`;
    case 'industriel': // grand portique large
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M180 320 L180 220 Q400 120 620 220 L620 320 Z" ${fill}/>
        <path d="M180 220 Q400 120 620 220" />
        <path d="M300 320 L300 250" /><path d="M500 320 L500 250" />
      </g>`;
    case 'pic': // abri simple en pic (défaut)
    default:
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
        <path d="M250 320 L250 230 L400 150 L550 230 L550 320 Z" ${fill}/>
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

for (const c of categories) {
  writeFileSync(join(outDir, `${c.slug}.svg`), svg(c), 'utf8');
}
console.log(`Généré ${categories.length} SVG de catégorie dans ${outDir}`);
