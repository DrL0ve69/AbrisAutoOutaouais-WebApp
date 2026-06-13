/**
 * Données FAQ par page (installation, location).
 *
 * Le texte source est en français ; la traduction anglaise est portée par les
 * chaînes `$localize` du composant `FaqComponent` (une entrée i18n par `id`),
 * pour rester cohérent avec l'i18n compile-time du reste de l'app.
 *
 * Chaque entrée fournit `question`/`answer` en français (locale source) ET un
 * `id` stable, utilisé par le composant pour résoudre la traduction et comme
 * clé de boucle. NE PAS réutiliser un `id` entre deux entrées.
 */
export interface FaqEntry {
  /** Identifiant stable (sert de clé i18n et de clé `track`). */
  readonly id: string;
  /** Question (français, locale source). */
  readonly question: string;
  /** Réponse (français, locale source). */
  readonly answer: string;
}

/** FAQ de la page Installation (/installation). */
export const INSTALLATION_FAQ: readonly FaqEntry[] = [
  {
    id: 'install.delais',
    question: 'Quels sont les délais pour une installation ?',
    answer:
      'Après confirmation du rendez-vous, l\'installation a généralement lieu sous une à deux semaines selon la saison et la disponibilité des créneaux. Les périodes de fin d\'automne sont les plus demandées : réservez tôt.',
  },
  {
    id: 'install.marques',
    question: 'Installez-vous d\'autres marques d\'abris que Abris Tempo ?',
    answer:
      'Oui. On installe aussi d\'autres marques d\'abris, à l\'exception de ShelterLogic. Contactez-nous avec le modèle et les dimensions pour confirmer la faisabilité avant de réserver.',
  },
  {
    id: 'install.garantie',
    question: 'L\'installation est-elle garantie ?',
    answer:
      'Le travail d\'installation est garanti contre les défauts de montage. La garantie du produit lui-même reste celle du fabricant de l\'abri.',
  },
  {
    id: 'install.terrain',
    question: 'Dois-je préparer le terrain avant votre venue ?',
    answer:
      'Dégagez la surface (neige, véhicules, obstacles) et assurez-vous que le sol est raisonnablement de niveau. Notre équipe s\'occupe de l\'ancrage adapté à votre surface (asphalte, gravier ou gazon).',
  },
];

/** FAQ de la page Location (/location). */
export const LOCATION_FAQ: readonly FaqEntry[] = [
  {
    id: 'location.duree',
    question: 'Quelle est la durée minimale d\'une location ?',
    answer:
      'Les abris se louent à la saison. Indiquez vos dates de début et de fin au moment de la réservation ; la facturation est mensuelle.',
  },
  {
    id: 'location.depot',
    question: 'Un dépôt est-il exigé ?',
    answer:
      'Un dépôt de garantie peut être demandé à la signature du contrat. Il est remboursé à la fin de la location si l\'abri est rendu en bon état.',
  },
  {
    id: 'location.annulation',
    question: 'Puis-je annuler ma location ?',
    answer:
      'Vous pouvez annuler depuis « Mes locations » dans votre compte. Les conditions d\'annulation dépendent du moment de la demande par rapport à la date de début prévue.',
  },
  {
    id: 'location.installation',
    question: 'L\'installation est-elle incluse dans la location ?',
    answer:
      'L\'adresse d\'installation est demandée à la réservation. Selon l\'entente, le montage peut être inclus ou facturé séparément — précisez votre besoin dans la demande.',
  },
];
