import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FaqEntry } from '../../content/faq.data';

/** Une entrée FAQ après résolution de la traduction (question/réponse localisées). */
interface LocalizedFaqEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/**
 * Accordéon FAQ accessible, réutilisable (installation, location).
 *
 * Implémentation volontairement native : un `<details>/<summary>` par question.
 * L'élément natif gère à lui seul l'état ouvert/fermé, le focus clavier, le rôle
 * et `aria-expanded` — zéro JS, zéro piège de focus, conforme WCAG sans widget
 * composite à maintenir. (L'`A11yAccordionComponent` de démo existant est figé
 * sur ses propres données et requête le DOM globalement → non réutilisable ici.)
 *
 * i18n : le texte source FR vient de `faq.data.ts` ; la traduction EN est portée
 * par les chaînes `$localize` statiques de `TRANSLATIONS`, résolues par `id`.
 */
@Component({
  selector: 'app-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="faq" [attr.aria-labelledby]="headingId()">
      <h2 [id]="headingId()" class="faq__title" i18n="@@faq.title">Foire aux questions</h2>

      <div class="faq__list">
        @for (entry of localized(); track entry.id) {
          <details class="faq__item">
            <summary class="faq__question">
              <span class="faq__question-text">{{ entry.question }}</span>
              <span class="faq__icon" aria-hidden="true"></span>
            </summary>
            <div class="faq__answer">
              <p>{{ entry.answer }}</p>
            </div>
          </details>
        }
      </div>
    </section>
  `,
  styleUrl: './faq.component.scss',
})
export class FaqComponent {
  /** Entrées FAQ (texte source FR) à afficher. */
  readonly entries = input.required<readonly FaqEntry[]>();

  /** Identifiant du titre de section, pour `aria-labelledby` (unique par page). */
  readonly headingId = input<string>('faq-title');

  /** Entrées avec question/réponse résolues dans la locale courante. */
  protected readonly localized = computed<readonly LocalizedFaqEntry[]>(() =>
    this.entries().map(e => {
      const t = TRANSLATIONS[e.id];
      return {
        id: e.id,
        question: t?.question ?? e.question,
        answer: t?.answer ?? e.answer,
      };
    }),
  );
}

/**
 * Table de traduction par `id`. Les valeurs par défaut sont le FR (locale
 * source) ; `ng extract-i18n` les collecte et le build localisé EN les remplace.
 * Une entrée par `id` de `faq.data.ts` — garder les deux en phase.
 */
const TRANSLATIONS: Record<string, { question: string; answer: string }> = {
  'install.delais': {
    question: $localize`:@@faq.install.delais.q:Quels sont les délais pour une installation ?`,
    answer: $localize`:@@faq.install.delais.a:Après confirmation du rendez-vous, l'installation a généralement lieu sous une à deux semaines selon la saison et la disponibilité des créneaux. Les périodes de fin d'automne sont les plus demandées : réservez tôt.`,
  },
  'install.marques': {
    question: $localize`:@@faq.install.marques.q:Installez-vous d'autres marques d'abris que Abris Tempo ?`,
    answer: $localize`:@@faq.install.marques.a:Oui. On installe aussi d'autres marques d'abris, à l'exception de ShelterLogic. Contactez-nous avec le modèle et les dimensions pour confirmer la faisabilité avant de réserver.`,
  },
  'install.garantie': {
    question: $localize`:@@faq.install.garantie.q:L'installation est-elle garantie ?`,
    answer: $localize`:@@faq.install.garantie.a:Le travail d'installation est garanti contre les défauts de montage. La garantie du produit lui-même reste celle du fabricant de l'abri.`,
  },
  'install.terrain': {
    question: $localize`:@@faq.install.terrain.q:Dois-je préparer le terrain avant votre venue ?`,
    answer: $localize`:@@faq.install.terrain.a:Dégagez la surface (neige, véhicules, obstacles) et assurez-vous que le sol est raisonnablement de niveau. Notre équipe s'occupe de l'ancrage adapté à votre surface (asphalte, gravier ou gazon).`,
  },
  'location.duree': {
    question: $localize`:@@faq.location.duree.q:Quelle est la durée minimale d'une location ?`,
    answer: $localize`:@@faq.location.duree.a:Les abris se louent à la saison. Indiquez vos dates de début et de fin au moment de la réservation ; la facturation est mensuelle.`,
  },
  'location.depot': {
    question: $localize`:@@faq.location.depot.q:Un dépôt est-il exigé ?`,
    answer: $localize`:@@faq.location.depot.a:Un dépôt de garantie peut être demandé à la signature du contrat. Il est remboursé à la fin de la location si l'abri est rendu en bon état.`,
  },
  'location.annulation': {
    question: $localize`:@@faq.location.annulation.q:Puis-je annuler ma location ?`,
    answer: $localize`:@@faq.location.annulation.a:Vous pouvez annuler depuis « Mes locations » dans votre compte. Les conditions d'annulation dépendent du moment de la demande par rapport à la date de début prévue.`,
  },
  'location.installation': {
    question: $localize`:@@faq.location.installation.q:L'installation est-elle incluse dans la location ?`,
    answer: $localize`:@@faq.location.installation.a:L'adresse d'installation est demandée à la réservation. Selon l'entente, le montage peut être inclus ou facturé séparément — précisez votre besoin dans la demande.`,
  },
};
