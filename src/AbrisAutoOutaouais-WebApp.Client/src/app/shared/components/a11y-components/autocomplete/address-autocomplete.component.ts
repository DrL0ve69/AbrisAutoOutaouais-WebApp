import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { PlacesService } from '../../../../core/services/places.service';
import { PlaceSuggestionDto } from '../../../../core/models/place.model';

/**
 * Combobox d'autocomplétion d'adresse — patron ARIA APG « combobox + listbox ».
 *
 * Principes (voir CLAUDE.md + leçons L-002/L-006/L-010) :
 *  - Le combobox NE possède PAS le `FormControl`. Il émet `valueChange` (frappe libre,
 *    pour synchroniser le contrôle « rue ») et `suggestionSelected` (option choisie) ;
 *    c'est le parent qui patche le formulaire, ce qui préserve la maîtrise du pristine
 *    pour l'autofill par défaut (L-002) et évite un ControlValueAccessor.
 *  - Roving via `aria-activedescendant` (aucun `tabindex` sur les options) : le focus DOM
 *    reste sur l'input, le lecteur d'écran suit l'option active par son `id`.
 *  - Compteur de résultats dans un `role="status"` SCOPÉ au composant (sr-only). Tout test
 *    doit l'ancrer par son texte, jamais par le rôle nu (L-010 — `app.html` a un status global).
 *  - SSR-safe : aucun accès à `window`/`document` au niveau module ni à la construction ;
 *    le focus de l'input se fait après le rendu via `setTimeout` (macrotâche post-CD, L-006).
 */
@Component({
  selector: 'app-address-autocomplete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './address-autocomplete.component.html',
  styleUrl: './address-autocomplete.component.scss',
  // `id` est un attribut DOM global : un `id="street"` écrit sur la balise hôte par le
  // parent serait reflété SUR l'élément hôte EN PLUS de l'input interne → deux `#street`
  // dans le document, et `getElementById` (calcul du nom via `<label for>`) tomberait sur
  // l'hôte non étiquetable. On retire donc l'id de l'hôte : seul l'`<input>` le porte.
  host: { '[attr.id]': 'null', '(focusout)': 'onFocusOut($event)' },
})
export class AddressAutocompleteComponent {
  private readonly places = inject(PlacesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Entrées publiques (signaux) ─────────────────────────────────────────────
  /** Identifiant de l'input — pilote `<label for>` et les ids d'options/listbox. */
  readonly id = input.required<string>();
  /**
   * Jeton `autocomplete` HTML (WCAG 1.3.5 — finalité programmatiquement déterminable). Défaut
   * `address-line1` : le champ unifié « n° et rue » mappe proprement sur la 1re ligne d'adresse
   * (EPIC 15, US-15.2). L'input portait `off` en dur auparavant.
   */
  readonly autocompleteToken = input<string>('address-line1');
  /** Libellé visible du champ (peut être fourni en externe via un `<label for>` parent). */
  readonly label = input<string>('');
  /** Texte courant de la rue (le parent garde l'autorité sur la valeur). */
  readonly value = input<string>('');
  /** Indice de ville transmis au proxy pour affiner les suggestions. */
  readonly cityHint = input<string>('');
  /** Indice de province transmis au proxy. */
  readonly provinceHint = input<string>('');
  /** `id`(s) externes décrivant le champ (indice/erreur), repris dans `aria-describedby`. */
  readonly describedBy = input<string>('');
  /** Marque le champ en erreur (`aria-invalid`). */
  readonly invalid = input<boolean>(false);

  // ── Sorties ─────────────────────────────────────────────────────────────────
  /** Émis à chaque frappe libre — le parent synchronise le contrôle « rue ». */
  readonly valueChange = output<string>();
  /** Émis quand l'utilisateur choisit une suggestion (action explicite). */
  readonly suggestionSelected = output<PlaceSuggestionDto>();

  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  // ── État interne ────────────────────────────────────────────────────────────
  protected readonly suggestions = signal<readonly PlaceSuggestionDto[]>([]);
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  /** Index de l'option active (-1 = aucune). Pilote `aria-activedescendant`. */
  protected readonly activeIndex = signal(-1);

  /** `id` du `<li>` actif, pour `aria-activedescendant`. Vide si aucune option active. */
  protected readonly activeOptionId = computed(() => {
    const i = this.activeIndex();
    return i >= 0 && i < this.suggestions().length ? this.optionId(i) : '';
  });

  /** Message du compteur de résultats (sr-only, `role="status"`). */
  protected readonly statusMessage = computed(() => {
    if (this.loading()) {
      return $localize`:@@autocomplete.status.loading:Recherche d'adresses en cours…`;
    }
    if (!this.open()) return '';
    const n = this.suggestions().length;
    if (n === 0) {
      return $localize`:@@autocomplete.status.none:Aucune adresse trouvée.`;
    }
    return $localize`:@@autocomplete.status.count:${n}:count: adresse(s) trouvée(s). Utilisez les flèches pour parcourir.`;
  });

  /** Flux de requêtes debouncées (300 ms) — annule la précédente via `switchMap`. */
  private readonly query$ = new Subject<string>();

  constructor() {
    this.query$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.loading.set(true);
          return this.places.suggest(q, this.cityHint(), this.provinceHint());
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (results) => {
          this.suggestions.set(results);
          this.activeIndex.set(-1);
          this.open.set(results.length > 0);
          this.loading.set(false);
        },
        error: () => {
          this.suggestions.set([]);
          this.open.set(false);
          this.loading.set(false);
        },
      });
  }

  protected optionId(index: number): string {
    return `${this.id()}-option-${index}`;
  }

  protected listboxId(): string {
    return `${this.id()}-listbox`;
  }

  // ── Saisie ──────────────────────────────────────────────────────────────────
  protected onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.valueChange.emit(text);
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      // Trop court pour interroger : on ferme la liste sans appel réseau.
      this.suggestions.set([]);
      this.open.set(false);
      this.activeIndex.set(-1);
      this.loading.set(false);
      return;
    }
    this.query$.next(trimmed);
  }

  // ── Clavier (ARIA APG combobox) ─────────────────────────────────────────────
  protected onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open() && count > 0) {
          this.open.set(true);
          this.activeIndex.set(0);
        } else if (count > 0) {
          this.activeIndex.update((i) => (i + 1) % count);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count > 0) {
          this.open.set(true);
          this.activeIndex.update((i) => (i <= 0 ? count - 1 : i - 1));
        }
        break;
      case 'Home':
        if (this.open() && count > 0) {
          event.preventDefault();
          this.activeIndex.set(0);
        }
        break;
      case 'End':
        if (this.open() && count > 0) {
          event.preventDefault();
          this.activeIndex.set(count - 1);
        }
        break;
      case 'Enter': {
        const i = this.activeIndex();
        if (this.open() && i >= 0 && i < count) {
          event.preventDefault();
          this.choose(this.suggestions()[i]);
        }
        break;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
      default:
        break;
    }
  }

  /** Survol souris : aligne l'option active sans voler le focus DOM (reste sur l'input). */
  protected onOptionHover(index: number): void {
    this.activeIndex.set(index);
  }

  protected choose(suggestion: PlaceSuggestionDto): void {
    this.suggestionSelected.emit(suggestion);
    this.close();
    // Le focus reste sur l'input (il n'a jamais bougé) ; on s'assure qu'il y est
    // APRÈS la fermeture/rendu de la liste (L-006), sans dépendre de `document`.
    this.focusInput();
  }

  protected close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  /** Re-ouvre la liste si on revient dans le champ avec des suggestions déjà chargées. */
  protected onFocus(): void {
    if (this.suggestions().length > 0) this.open.set(true);
  }

  /**
   * APG « combobox » : ferme la listbox quand le focus QUITTE le composant (tabulation vers
   * le champ suivant), sinon `aria-expanded` resterait `true` avec une popup orpheline.
   * La sélection souris n'est PAS cassée : le `mousedown` des options fait `preventDefault`,
   * donc l'input ne perd jamais le focus au clic → aucun `focusout` n'est émis avant `choose`.
   * On ne ferme que si la cible du focus est HORS de l'hôte (déplacement interne ignoré).
   */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!this.hostEl.nativeElement.contains(next)) this.close();
  }

  private focusInput(): void {
    setTimeout(() => this.inputEl().nativeElement.focus());
  }
}
