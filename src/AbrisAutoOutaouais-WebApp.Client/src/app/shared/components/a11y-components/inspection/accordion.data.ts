// features/projects/a11y-components/accordion/accordion.data.ts
export interface AccordionItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly tags: readonly string[];
}

export const ACCORDION_DATA: AccordionItem[] = [
  {
    id: 'wcag-levels',
    question: 'Quelle est la différence entre les niveaux A, AA et AAA ?',
    answer: `Le niveau A couvre les obstacles les plus critiques — 
      sans ces critères, certains utilisateurs ne peuvent pas du tout 
      accéder au contenu. Le niveau AA est le standard légal dans la 
      plupart des juridictions, incluant le gouvernement canadien. 
      Le niveau AAA représente l'accessibilité optimale — utile 
      comme objectif mais rarement exigé en totalité.`,
    tags: ['WCAG', 'niveaux', 'gouvernement'],
  },
  {
    id: 'aria-vs-html',
    question: 'Quand utiliser ARIA plutôt que HTML sémantique ?',
    answer: `La règle d'or : "No ARIA is better than bad ARIA." 
      Toujours préférer les éléments HTML natifs (<button>, <nav>, 
      <table>, <label>) — ils ont le comportement clavier et les 
      annonces lecteur d'écran intégrés. ARIA sert uniquement 
      à compléter ce que HTML ne peut pas exprimer nativement, 
      comme aria-live, aria-expanded, ou aria-sort.`,
    tags: ['ARIA', 'HTML', 'bonnes pratiques'],
  },
  {
    id: 'axe-vs-manual',
    question: 'axe DevTools suffit-il pour un audit complet ?',
    answer: `axe DevTools détecte environ 30 à 40% des problèmes 
      d'accessibilité automatiquement — les violations claires comme 
      les contrastes insuffisants, les attributs manquants, et les 
      structures incorrectes. Les 60 à 70% restants nécessitent 
      des tests manuels : navigation clavier, tests avec NVDA/JAWS, 
      évaluations heuristiques, et tests avec de vrais utilisateurs.`,
    tags: ['axe', 'audit', 'tests manuels'],
  },
  {
    id: 'wet-boew',
    question: 'Qu\'est-ce que WET-BOEW et pourquoi est-il utilisé au gouvernement ?',
    answer: `La Boîte à outils de l'expérience Web (WET-BOEW) est 
      le cadriciel front-end officiel du gouvernement du Canada. 
      Elle implémente les composants courants (menus, onglets, 
      formulaires) en conformité avec les WCAG et les Standards 
      sur l'accessibilité du Web du Conseil du Trésor. Son utilisation 
      garantit une baseline d'accessibilité sur les sites fédéraux.`,
    tags: ['WET-BOEW', 'gouvernement', 'Canada'],
  },
];
