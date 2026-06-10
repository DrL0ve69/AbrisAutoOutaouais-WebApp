import { Component, ChangeDetectionStrategy, input, computed, model } from "@angular/core";
import { INSPECTIONS } from "./inspection.data";


// features/projects/a11y-components/inspection/inspection-panel.component.ts
@Component({
  selector: 'app-inspection-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside [attr.aria-labelledby]="'inspect-title-' + componentId()"
           [hidden]="!visible()"
           class="inspection-panel">

      <div class="inspection-panel__header">
        <h3 [id]="'inspect-title-' + componentId()" i18n>
          Décisions d'accessibilité
        </h3>
        <button (click)="visible.set(false)"
                aria-label="Fermer le panneau d'inspection"
                i18n-aria-label>
          ✕
        </button>
      </div>

      <p class="inspection-panel__intro" i18n>
        Chaque attribut ci-dessous est une décision consciente
        liée à un critère WCAG précis.
      </p>

      <ol class="inspection-panel__list">
        @for (d of decisions(); track d.id) {
          <li class="inspection-decision">

            <div class="inspection-decision__header">
              <code class="inspection-decision__attr">{{ d.attribute }}</code>
              <span class="badge badge--wcag-level"
                    [attr.aria-label]="'Niveau WCAG ' + d.wcagLevel">
                {{ d.wcagLevel }}
              </span>
            </div>

            <p class="inspection-decision__location">
              <span class="sr-only" i18n>Emplacement : </span>
              {{ d.location }}
            </p>

            <p class="inspection-decision__explanation">
              {{ d.explanation }}
            </p>

            @if (d.codeSnippet) {
              <details>
                <summary i18n>Voir l'extrait de code</summary>
                <pre [attr.aria-label]="'Code pour ' + d.attribute">
                  <code>{{ d.codeSnippet }}</code>
                </pre>
              </details>
            }

            <a [href]="d.wcagUrl"
               target="_blank"
               rel="noopener noreferrer"
               class="inspection-decision__wcag-link"
               [attr.aria-label]="'WCAG ' + d.wcagCriterion + ' — ' + d.wcagTitle + ' (nouvelle fenêtre)'">
              WCAG {{ d.wcagCriterion }} — {{ d.wcagTitle }} ↗
            </a>

          </li>
        }
      </ol>

    </aside>
  `
})
export class InspectionPanelComponent {
  readonly componentId = input.required<string>();
  readonly visible = model<boolean>(false);

  readonly decisions = computed(() =>
    INSPECTIONS[this.componentId()]?.decisions ?? []
  );
}
