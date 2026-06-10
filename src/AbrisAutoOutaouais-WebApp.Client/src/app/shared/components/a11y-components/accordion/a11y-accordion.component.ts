import { Component, ChangeDetectionStrategy, signal, computed } from "@angular/core";
import { ACCORDION_DATA } from "../inspection/accordion.data";

// features/projects/a11y-components/accordion/a11y-accordion.component.ts
@Component({
  selector: 'app-a11y-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="accordion-title">
      <h3 id="accordion-title" i18n>
        Questions fréquentes — Accessibilité web
      </h3>

      <p i18n>
        Utilisez Entrée ou Espace pour ouvrir une section.
        Utilisez les touches fléchées pour naviguer entre les questions.
      </p>

      <!-- Option : tout ouvrir / tout fermer -->
      <div class="accordion__controls">
        <button (click)="expandAll()"
                [disabled]="allExpanded()"
                i18n>
          Tout ouvrir
        </button>
        <button (click)="collapseAll()"
                [disabled]="noneExpanded()"
                i18n>
          Tout fermer
        </button>
      </div>

      <div class="accordion">
        @for (item of items; track item.id; let i = $index) {

          <div class="accordion__item">

            <!-- Bouton — pattern ARIA APG Accordion -->
            <h4 class="accordion__heading">
              <button
                [id]="'accordion-btn-' + item.id"
                class="accordion__trigger"
                [attr.aria-expanded]="isExpanded(item.id)"
                [attr.aria-controls]="'accordion-panel-' + item.id"
                (click)="toggle(item.id)"
                (keydown)="onKeydown($event, i)">

                <span>{{ item.question }}</span>

                <!-- Icône visuelle seulement -->
                <span class="accordion__icon" aria-hidden="true">
                  {{ isExpanded(item.id) ? '▲' : '▼' }}
                </span>

              </button>
            </h4>

            <!-- Panneau de contenu -->
            <div
              [id]="'accordion-panel-' + item.id"
              role="region"
              [attr.aria-labelledby]="'accordion-btn-' + item.id"
              [hidden]="!isExpanded(item.id)"
              class="accordion__panel">

              <p>{{ item.answer }}</p>

              <!-- Tags -->
              <ul class="accordion__tags"
                  aria-label="Sujets liés"
                  role="list">
                @for (tag of item.tags; track tag) {
                  <li>{{ tag }}</li>
                }
              </ul>

            </div>

          </div>

        }
      </div>

    </section>
  `
})
export class A11yAccordionComponent {
  readonly items = ACCORDION_DATA;

  // Set des IDs expanded — signal pour réactivité
  readonly expandedIds = signal(new Set<string>());

  readonly allExpanded = computed(() =>
    this.expandedIds().size === this.items.length
  );
  readonly noneExpanded = computed(() =>
    this.expandedIds().size === 0
  );

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggle(id: string): void {
    this.expandedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  expandAll(): void {
    this.expandedIds.set(new Set(this.items.map(i => i.id)));
  }

  collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  // Navigation clavier — pattern APG Accordion
  // Flèche haut/bas déplace le focus entre les boutons
  onKeydown(event: KeyboardEvent, currentIndex: number): void {
    const buttons = this.getAccordionButtons();
    let targetIndex: number | null = null;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        targetIndex = (currentIndex + 1) % buttons.length;
        break;

      case 'ArrowUp':
        event.preventDefault();
        targetIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        break;

      case 'Home':
        event.preventDefault();
        targetIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        targetIndex = buttons.length - 1;
        break;
    }

    if (targetIndex !== null) {
      buttons[targetIndex]?.focus();
    }
  }

  private getAccordionButtons(): HTMLButtonElement[] {
    return Array.from(
      document.querySelectorAll<HTMLButtonElement>('.accordion__trigger')
    );
  }
}
