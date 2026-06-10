import { Component, ChangeDetectionStrategy, AfterViewChecked, signal, viewChild, ElementRef } from "@angular/core";

// features/projects/a11y-components/modal/a11y-modal.component.ts
@Component({
  selector: 'app-a11y-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="modal-section-title">
      <h3 id="modal-section-title" i18n>Boîte de dialogue modale</h3>

      <button #triggerBtn
              (click)="open()"
              i18n>
        Ouvrir la boîte de dialogue
      </button>

      @if (isOpen()) {
        <!-- Fond -->
        <div class="modal-backdrop"
             aria-hidden="true"
             (click)="close()">
        </div>

        <!-- Dialogue -->
        <div #dialogEl
             role="dialog"
             aria-modal="true"
             aria-labelledby="dialog-title"
             aria-describedby="dialog-desc"
             class="modal"
             (keydown)="onKeydown($event)">

          <h2 id="dialog-title" i18n>Titre de la boîte de dialogue</h2>
          <p id="dialog-desc" i18n>
            Description du contenu et des actions disponibles.
            Cette boîte capture le focus et peut être fermée
            avec la touche Échap.
          </p>

          <div class="modal__actions">
            <button (click)="confirm()" i18n>Confirmer</button>
            <button (click)="close()" i18n>Annuler</button>
          </div>

        </div>
      }
    </section>
  `
})
export class A11yModalComponent implements AfterViewChecked {
  readonly isOpen = signal(false);

  readonly triggerBtn = viewChild.required<ElementRef<HTMLButtonElement>>('triggerBtn');
  readonly dialogEl = viewChild<ElementRef<HTMLDivElement>>('dialogEl');

  private previouslyFocused: HTMLElement | null = null;
  private needsFocusTrap = false;

  open(): void {
    this.previouslyFocused = document.activeElement as HTMLElement;
    this.isOpen.set(true);
    this.needsFocusTrap = true;
  }

  close(): void {
    this.isOpen.set(false);
    // Retour du focus sur l'élément déclencheur — obligatoire WCAG 2.4.3
    this.previouslyFocused?.focus();
  }

  confirm(): void {
    // Logique métier
    this.close();
  }

  ngAfterViewChecked(): void {
    if (this.needsFocusTrap && this.dialogEl()) {
      this.trapFocus();
      this.needsFocusTrap = false;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      this.handleTabKey(event);
    }
  }

  private trapFocus(): void {
    const focusable = this.getFocusableElements();
    focusable[0]?.focus();
  }

  private handleTabKey(event: KeyboardEvent): void {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const dialog = this.dialogEl()?.nativeElement;
    if (!dialog) return [];
    const selector = [
      'a[href]', 'button:not([disabled])',
      'input:not([disabled])', 'select:not([disabled])',
      'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    return Array.from(dialog.querySelectorAll<HTMLElement>(selector));
  }
}
