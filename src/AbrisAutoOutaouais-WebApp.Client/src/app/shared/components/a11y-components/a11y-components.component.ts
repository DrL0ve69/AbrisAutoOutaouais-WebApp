// import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
// import { RouterLink } from "@angular/router";
// import { inject } from "vitest";
// import { A11yAccordionComponent } from "./accordion/a11y-accordion.component";
// import { InspectionPanelComponent } from "./inspection/inspection-panel.component";
// import { A11yDataTableComponent } from "./data-table/data-table.component";
// import { A11yFormComponent } from "./form/a11y-form.component";
// import { A11yModalComponent } from "./modal/a11y-modal.component";
// // import { SeoService } from "../../services/seo.service";

// // features/projects/a11y-components/a11y-components.component.ts
// export interface ComponentTab {
//   readonly id: string;
//   readonly label: string;
//   readonly icon: string;
//   readonly description: string;
//   readonly wcagPatterns: readonly string[];
//   readonly lighthouseScore: 100;
// }

// @Component({
//   selector: 'app-a11y-components-page',
//   changeDetection: ChangeDetectionStrategy.OnPush,
//   imports: [
//     RouterLink,
//     A11yDataTableComponent,
//     A11yModalComponent,
//     A11yFormComponent,
//     A11yAccordionComponent,
//     InspectionPanelComponent,
//   ],
//   template: `
//     <main aria-labelledby="page-title">

//       <!-- En-tête de page -->
//       <header class="page-header">
//         <nav aria-label="Fil d'ariane">
//           <ol role="list">
//             <li><a routerLink="/" i18n>Accueil</a></li>
//             <li><a routerLink="/projects" i18n>Projets</a></li>
//             <li aria-current="page" i18n>Composants accessibles</li>
//           </ol>
//         </nav>

//         <h1 id="page-title" i18n>Composants Angular accessibles</h1>

//         <p i18n>
//           Quatre composants construits selon les patterns ARIA du W3C,
//           chacun testé avec axe DevTools, NVDA et la navigation clavier.
//           Score Lighthouse Accessibility : 100/100.
//         </p>

//         <!-- Score Lighthouse visible -->
//         <div class="lighthouse-badge"
//              role="img"
//              aria-label="Score Lighthouse Accessibility : 100 sur 100">
//           <span aria-hidden="true">💡 100</span>
//           <span class="sr-only">Lighthouse Accessibility 100/100</span>
//         </div>
//       </header>

//       <!-- Navigation par onglets -->
//       <div class="tabs-wrapper">

//         <!-- Liste des onglets -->
//         <div role="tablist"
//              aria-label="Composants disponibles"
//              class="tabs">
//           @for (tab of tabs; track tab.id; let i = $index) {
//             <button
//               role="tab"
//               [id]="'tab-' + tab.id"
//               [attr.aria-selected]="activeTabId() === tab.id"
//               [attr.aria-controls]="'panel-' + tab.id"
//               [tabindex]="activeTabId() === tab.id ? 0 : -1"
//               (click)="selectTab(tab.id)"
//               (keydown)="onTabKeydown($event, i)"
//               class="tab">
//               <span aria-hidden="true">{{ tab.icon }}</span>
//               <span>{{ tab.label }}</span>
//             </button>
//           }
//         </div>

//         <!-- Panneaux de contenu -->
//         @for (tab of tabs; track tab.id) {
//           <div
//             role="tabpanel"
//             [id]="'panel-' + tab.id"
//             [attr.aria-labelledby]="'tab-' + tab.id"
//             [hidden]="activeTabId() !== tab.id"
//             [tabindex]="0"
//             class="tab-panel">

//             <!-- Description du composant -->
//             <div class="component-meta">
//               <p>{{ tab.description }}</p>

//               <ul class="wcag-patterns"
//                   aria-label="Patterns ARIA démontrés"
//                   role="list">
//                 @for (pattern of tab.wcagPatterns; track pattern) {
//                   <li>
//                     <code>{{ pattern }}</code>
//                   </li>
//                 }
//               </ul>
//             </div>

//             <!-- Zone de démonstration -->
//             <div class="demo-wrapper">

//               <!-- Barre d'outils -->
//               <div role="toolbar"
//                    [attr.aria-label]="'Outils pour ' + tab.label"
//                    class="demo-toolbar">

//                 <button
//                   [attr.aria-pressed]="inspectionOpen()"
//                   (click)="inspectionOpen.update(v => !v)">
//                   🔍
//                   <span i18n>
//                     {{ inspectionOpen() ? 'Masquer' : 'Voir' }}
//                     les décisions d'accessibilité
//                   </span>
//                 </button>

//                 <a [href]="githubUrl(tab.id)"
//                    target="_blank"
//                    rel="noopener noreferrer"
//                    [attr.aria-label]="'Code source de ' + tab.label + ' sur GitHub (nouvelle fenêtre)'">
//                   { } Code source
//                 </a>

//               </div>

//               <!-- Composant actif -->
//               <div class="demo-stage"
//                    [attr.aria-label]="'Démonstration interactive — ' + tab.label">
//                 @switch (activeTabId()) {
//                   @case ('data-table') {
//                     <app-a11y-data-table />
//                   }
//                   @case ('modal') {
//                     <app-a11y-modal />
//                   }
//                   @case ('form') {
//                     <app-a11y-form />
//                   }
//                   @case ('accordion') {
//                     <app-a11y-accordion />
//                   }
//                 }
//               </div>

//               <!-- Panneau d'inspection -->
//               <app-inspection-panel
//                 [componentId]="activeTabId()"
//                 [(visible)]="inspectionOpen()" />

//             </div>
//           </div>
//         }

//       </div>

//       <!-- Lien vers GitHub global -->
//       <section aria-labelledby="github-section">
//         <h2 id="github-section" i18n>Code source complet</h2>
//         <p i18n>
//           Tous les composants sont disponibles sur GitHub avec
//           leurs tests Vitest et leur documentation d'accessibilité.
//         </p>
//         <a href="https://github.com/philippecharron/portfolio"
//            target="_blank"
//            rel="noopener noreferrer"
//            class="btn btn--primary"
//            i18n>
//           Voir le dépôt GitHub ↗
//           <span class="sr-only">(nouvelle fenêtre)</span>
//         </a>
//       </section>

//     </main>
//   `
// })
// export class A11yComponentsPageComponent {
//   //readonly #seo = inject(SeoService);

//   readonly tabs: ComponentTab[] = [
//     {
//       id: 'data-table',
//       label: 'Tableau filtrable',
//       icon: '📊',
//       description: 'Tableau de données avec filtre, tri multi-colonnes et pagination — navigation clavier et aria-sort conformes au W3C APG.',
//       wcagPatterns: ['aria-sort', 'aria-live="polite"', 'scope="col"', 'aria-current="page"', '<caption>'],
//       lighthouseScore: 100,
//     },
//     {
//       id: 'modal',
//       label: 'Boîte de dialogue',
//       icon: '💬',
//       description: 'Modale avec piège de focus complet, fermeture par Échap et retour du focus sur l\'élément déclencheur.',
//       wcagPatterns: ['role="dialog"', 'aria-modal="true"', 'aria-labelledby', 'focus trap', 'Escape key'],
//       lighthouseScore: 100,
//     },
//     {
//       id: 'form',
//       label: 'Formulaire',
//       icon: '📝',
//       description: 'Formulaire de contact avec validation accessible, résumé des erreurs cliquable et gestion de l\'état de chargement.',
//       wcagPatterns: ['aria-invalid', 'aria-describedby chaîné', 'role="alert"', 'aria-busy', 'aria-required'],
//       lighthouseScore: 100,
//     },
//     {
//       id: 'accordion',
//       label: 'Accordéon',
//       icon: '🪗',
//       description: 'Accordéon FAQ avec navigation clavier complète (flèches, Home, End) selon le pattern W3C APG.',
//       wcagPatterns: ['aria-expanded', 'aria-controls', 'role="region"', 'ArrowDown/Up', 'Home/End'],
//       lighthouseScore: 100,
//     },
//   ];

//   readonly activeTabId = signal('data-table');
//   readonly inspectionOpen = signal(false);

//   // constructor() {
//   //   this.#seo.setPage(
//   //     'Composants accessibles Angular',
//   //     '4 composants Angular construits selon les patterns ARIA du W3C — tableau, modale, formulaire, accordéon'
//   //   );
//   // }

//   selectTab(id: string): void {
//     this.activeTabId.set(id);
//     this.inspectionOpen.set(false); // fermer le panneau au changement d'onglet
//   }

//   // Navigation clavier entre onglets — pattern W3C APG Tabs
//   // Flèches gauche/droite pour changer d'onglet
//   onTabKeydown(event: KeyboardEvent, currentIndex: number): void {
//     const count = this.tabs.length;
//     let target: number | null = null;

//     switch (event.key) {
//       case 'ArrowRight':
//         event.preventDefault();
//         target = (currentIndex + 1) % count;
//         break;

//       case 'ArrowLeft':
//         event.preventDefault();
//         target = (currentIndex - 1 + count) % count;
//         break;

//       case 'Home':
//         event.preventDefault();
//         target = 0;
//         break;

//       case 'End':
//         event.preventDefault();
//         target = count - 1;
//         break;
//     }

//     if (target !== null) {
//       this.selectTab(this.tabs[target].id);
//       // Déplacer le focus sur l'onglet sélectionné
//       setTimeout(() => {
//         const tabBtn = document.getElementById(`tab-${this.tabs[target!].id}`);
//         tabBtn?.focus();
//       });
//     }
//   }

//   githubUrl(componentId: string): string {
//     return `https://github.com/philippecharron/portfolio/tree/main/src/app/features/projects/a11y-components/${componentId}`;
//   }
// }
