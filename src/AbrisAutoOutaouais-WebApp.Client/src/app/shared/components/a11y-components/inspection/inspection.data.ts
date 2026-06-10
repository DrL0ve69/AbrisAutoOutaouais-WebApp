// features/projects/a11y-components/inspection/inspection.data.ts
import { ComponentInspection } from './inspection.model';

export const INSPECTIONS: Record<string, ComponentInspection> = {

  'data-table': {
    componentId: 'data-table',
    decisions: [
      {
        id: 'aria-sort',
        attribute: 'aria-sort="ascending | descending | none"',
        location: 'sur chaque <th scope="col">',
        wcagCriterion: '1.3.1',
        wcagTitle: 'Information et relations',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#info-and-relationships',
        explanation: `Sans aria-sort, NVDA lit "Colonne Nom, bouton" 
          sans indiquer l'ordre de tri. Avec aria-sort="ascending", 
          NVDA annonce "Nom, trié par ordre croissant, bouton de tri". 
          L'attribut doit être sur le <th>, pas sur le <button> intérieur.`,
        codeSnippet: `<th scope="col" [attr.aria-sort]="getSortAriaValue(col.key)">
  <button>{{ col.label }}</button>
</th>`,
      },
      {
        id: 'role-status',
        attribute: 'role="status" aria-live="polite"',
        location: 'sur le paragraphe compteur de résultats',
        wcagCriterion: '4.1.3',
        wcagTitle: 'Messages d\'état',
        wcagLevel: 'AA',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#status-messages',
        explanation: `Quand le filtre change, "12 entrées affichées" 
          est annoncé automatiquement par NVDA sans déplacer le focus. 
          aria-live="polite" attend la fin de la lecture courante 
          avant d'annoncer — contrairement à "assertive" qui interrompt.`,
        codeSnippet: `<p role="status" aria-live="polite" aria-atomic="true" class="sr-only">
  {{ statusMessage() }}
</p>`,
      },
      {
        id: 'caption',
        attribute: '<caption>',
        location: 'premier enfant de <table>',
        wcagCriterion: '1.3.1',
        wcagTitle: 'Information et relations',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#info-and-relationships',
        explanation: `<caption> est l'équivalent d'un titre pour un tableau. 
          NVDA annonce le caption quand l'utilisateur entre dans le tableau. 
          La classe sr-only le masque visuellement mais le conserve 
          pour les technologies d'assistance.`,
        codeSnippet: `<table>
  <caption class="sr-only">Données filtrables — triables par colonne</caption>
  ...
</table>`,
      },
      {
        id: 'th-scope',
        attribute: 'scope="col" sur <th>',
        location: 'dans <thead>',
        wcagCriterion: '1.3.1',
        wcagTitle: 'Information et relations',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#info-and-relationships',
        explanation: `scope="col" indique que le <th> est un en-tête 
          de colonne. NVDA utilise cette information pour annoncer 
          l'en-tête quand l'utilisateur navigue dans les cellules. 
          Sans scope, la relation en-tête/données est ambiguë.`,
        codeSnippet: `<th scope="col">Nom</th>
<td>Philippe</td> <!-- NVDA annonce : "Nom, Philippe" -->`,
      },
      {
        id: 'pagination-nav',
        attribute: 'aria-label sur <nav>',
        location: 'sur l\'élément <nav> de pagination',
        wcagCriterion: '2.4.1',
        wcagTitle: 'Contourner des blocs',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#bypass-blocks',
        explanation: `Une page avec plusieurs <nav> doit différencier 
          chacune par aria-label. Sans ça, NVDA liste "navigation, 
          navigation" — l'utilisateur ne sait pas laquelle est 
          la pagination et laquelle est le menu principal.`,
        codeSnippet: `<nav aria-label="Pagination du tableau">...</nav>`,
      },
      {
        id: 'aria-current-page',
        attribute: 'aria-current="page"',
        location: 'sur le bouton de la page active',
        wcagCriterion: '1.3.1',
        wcagTitle: 'Information et relations',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#info-and-relationships',
        explanation: `Sans aria-current, NVDA lit "1, bouton — 2, bouton — 
          3, bouton" sans indiquer la page courante. Avec 
          aria-current="page", NVDA annonce "1, page actuelle, bouton". 
          L'attribut remplace visuellement l'apparence active.`,
        codeSnippet: `<button [attr.aria-current]="currentPage() === page ? 'page' : null">
  {{ page }}
</button>`,
      },
    ],
  },

  'modal': {
    componentId: 'modal',
    decisions: [
      {
        id: 'role-dialog',
        attribute: 'role="dialog" aria-modal="true"',
        location: 'sur le conteneur de la modale',
        wcagCriterion: '1.3.1',
        wcagTitle: 'Information et relations',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#info-and-relationships',
        explanation: `role="dialog" indique à NVDA qu'il s'agit d'une 
          boîte de dialogue. aria-modal="true" informe les lecteurs 
          d'écran modernes que le contenu derrière la modale est inerte. 
          Sans ces attributs, NVDA traite la modale comme du contenu 
          ordinaire et peut lire le fond de page.`,
        codeSnippet: `<div role="dialog" aria-modal="true"
     aria-labelledby="dialog-title"
     aria-describedby="dialog-desc">`,
      },
      {
        id: 'focus-trap',
        attribute: 'Piège de focus via keydown',
        location: 'gestionnaire d\'événement sur le dialog',
        wcagCriterion: '2.1.2',
        wcagTitle: 'Pas de piège au clavier',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#no-keyboard-trap',
        explanation: `Le piège de focus est intentionnel et conforme 
          à WCAG 2.1.2 parce que l'utilisateur peut sortir de la modale 
          avec Échap. Sans piège, Tab emmènerait le focus hors de la 
          modale sur le fond de page — l'utilisateur clavier serait perdu.`,
        codeSnippet: `// Shift+Tab sur le premier élément → aller au dernier
if (event.shiftKey && document.activeElement === first) {
  event.preventDefault();
  last.focus();
}`,
      },
      {
        id: 'focus-return',
        attribute: 'focus() sur l\'élément déclencheur à la fermeture',
        location: 'méthode close()',
        wcagCriterion: '2.4.3',
        wcagTitle: 'Ordre de focus',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#focus-order',
        explanation: `Sans retour de focus, l'utilisateur clavier se 
          retrouve en haut de la page après la fermeture. Le focus doit 
          retourner exactement là d'où il est venu — l'élément qui 
          a ouvert la modale.`,
        codeSnippet: `close(): void {
  this.isOpen.set(false);
  this.previouslyFocused?.focus(); // ← WCAG 2.4.3
}`,
      },
      {
        id: 'escape-key',
        attribute: 'Fermeture par Échap',
        location: 'gestionnaire keydown sur le dialog',
        wcagCriterion: '2.1.1',
        wcagTitle: 'Clavier',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#keyboard',
        explanation: `ARIA Authoring Practices Guide (APG) du W3C 
          exige qu'Échap ferme les boîtes de dialogue. C'est une 
          convention universelle que les utilisateurs de technologies 
          d'assistance connaissent et attendent.`,
        codeSnippet: `if (event.key === 'Escape') {
  event.preventDefault();
  this.close();
}`,
      },
    ],
  },

  'form': {
    componentId: 'form',
    decisions: [
      {
        id: 'aria-invalid',
        attribute: 'aria-invalid="true"',
        location: 'sur les <input> invalides',
        wcagCriterion: '3.3.1',
        wcagTitle: 'Identification des erreurs',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#error-identification',
        explanation: `aria-invalid="true" permet à NVDA d'annoncer 
          "invalide" quand le focus arrive sur un champ en erreur. 
          La valeur est retirée (null) quand le champ est valide — 
          mettre aria-invalid="false" génère une annonce inutile.`,
        codeSnippet: `[attr.aria-invalid]="isInvalid('name') || null"`,
      },
      {
        id: 'aria-describedby-chained',
        attribute: 'aria-describedby enchaîné',
        location: 'sur le champ courriel',
        wcagCriterion: '1.3.1',
        wcagTitle: 'Information et relations',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#info-and-relationships',
        explanation: `Un seul champ peut pointer vers plusieurs IDs 
          séparés par des espaces. Ici : l'erreur d'abord, puis l'indice. 
          NVDA lit les deux dans l'ordre. L'erreur doit être en premier 
          car c'est l'information prioritaire pour l'utilisateur.`,
        codeSnippet: `[attr.aria-describedby]="isInvalid('email')
  ? 'email-error email-hint'
  : 'email-hint'"`,
      },
      {
        id: 'validation-summary',
        attribute: 'Résumé des erreurs avec role="alert" et tabindex="-1"',
        location: 'en haut du formulaire, visible après soumission',
        wcagCriterion: '3.3.3',
        wcagTitle: 'Suggestion après une erreur',
        wcagLevel: 'AA',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#error-suggestion',
        explanation: `Le résumé avec tabindex="-1" permet de déplacer 
          programmatiquement le focus dessus. Les liens internes du 
          résumé (#contact-name) amènent l'utilisateur directement 
          au champ problématique — c'est le pattern recommandé par 
          le W3C pour les formulaires multi-champs.`,
        codeSnippet: `// Déplacer le focus sur le résumé après soumission invalide
setTimeout(() => {
  this.validationSummary()?.nativeElement.focus();
});`,
      },
      {
        id: 'aria-busy',
        attribute: 'aria-busy="true" sur le bouton de soumission',
        location: 'sur <button type="submit"> pendant le chargement',
        wcagCriterion: '4.1.3',
        wcagTitle: 'Messages d\'état',
        wcagLevel: 'AA',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#status-messages',
        explanation: `Sans aria-busy, l'utilisateur clavier qui appuie 
          sur Entrée n'a aucun retour — le bouton est désactivé en silence. 
          aria-busy="true" indique un état de traitement en cours. 
          Combiné avec le texte "Envoi en cours…", c'est un retour complet.`,
        codeSnippet: `<button [attr.aria-busy]="isLoading() || null"
        [disabled]="isLoading()">
  @if (isLoading()) {
    <span role="status">Envoi en cours, veuillez patienter…</span>
  }
</button>`,
      },
      {
        id: 'abbr-required',
        attribute: '<abbr title="obligatoire"> *</abbr>',
        location: 'dans chaque <label> de champ obligatoire',
        wcagCriterion: '3.3.2',
        wcagTitle: 'Étiquettes ou instructions',
        wcagLevel: 'A',
        wcagUrl: 'https://www.w3.org/TR/WCAG22/#labels-or-instructions',
        explanation: `L'astérisque seul n'a pas de signification pour 
          NVDA. <abbr title="obligatoire"> * </abbr> permet à NVDA 
          d'annoncer "obligatoire" quand le focus passe sur le label. 
          aria-hidden="true" sur certaines implémentations évite 
          la double annonce.`,
        codeSnippet: `<label for="contact-name">
  Nom complet
  <abbr title="Champ obligatoire" aria-label="obligatoire"> *</abbr>
</label>`,
      },
    ],
  },
};
