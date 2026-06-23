import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { ShelterCatalogService } from '../../core/services/shelter-catalog.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { createAddressFormController } from '../../core/services/address-form.controller';
import {
  AvailableSlotDto,
  BookingType,
  CreateBookingRequest,
} from '../../core/models/booking.model';
import { PaymentInstructions } from '../../core/models/order.model';
import { FaqComponent } from '../../shared/components/faq/faq.component';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../shared/components/a11y-components/address-choice/address-choice.component';
import { GuestContactComponent } from '../../shared/components/a11y-components/guest-contact/guest-contact.component';
import { INSTALLATION_FAQ } from '../../shared/content/faq.data';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../core/validators/address.validators';
import {
  buildGuestContactGroup,
  toGuestContactRequest,
} from '../../core/validators/guest-contact.validators';
import { excludedBrandValidator } from '../../core/validators/brand.validators';
import { BrandCatalog, ModelCatalog } from '../../core/models/shelter-catalog.model';
import { cmToFeet } from '../mesurer/util/units.util';

/** Créneaux regroupés par jour pour l'affichage. */
interface SlotGroup {
  readonly dayKey: string;
  readonly dayLabel: string;
  readonly slots: readonly AvailableSlotDto[];
}

/**
 * Réservation d'installation à domicile.
 * Charge les créneaux disponibles (~3 prochaines semaines), les présente en
 * radiogroup accessible groupé par jour, puis crée la réservation.
 */
@Component({
  selector: 'app-installation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FaqComponent,
    AddressAutocompleteComponent,
    AddressChoiceComponent,
    GuestContactComponent,
  ],
  templateUrl: './installation.html',
  styleUrl: './installation.scss',
})
export class InstallationComponent implements OnInit {
  /** Entrées FAQ de la page (délais, marques, garantie, terrain). */
  protected readonly faq = INSTALLATION_FAQ;

  private readonly fb = inject(FormBuilder);
  private readonly bookings = inject(BookingService);
  private readonly catalog = inject(ShelterCatalogService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly groups = signal<readonly SlotGroup[]>([]);
  protected readonly selectedSlot = signal<string | null>(null);
  protected readonly hasSlots = computed(() => this.groups().length > 0);

  /**
   * Étape du tunnel : saisie du formulaire, puis instructions de virement Interac (EPIC 7.3), comme
   * la caisse et la location. Aucune redirection automatique : le client lit et exécute le virement ;
   * la réconciliation (confirmation de la réservation) est faite plus tard par l'administration.
   */
  protected readonly step = signal<'form' | 'instructions'>('form');
  /** Instructions de virement Interac renvoyées par le serveur à la création de la réservation. */
  protected readonly paymentInstructions = signal<PaymentInstructions | null>(null);

  /**
   * Titre du panneau d'instructions — cible de focus à l'arrivée sur l'étape (WCAG 2.4.3). Rendu
   * INCONDITIONNELLEMENT dès `step === 'instructions'`, hors du `@if (paymentInstructions())` interne
   * (L-006). Focusé APRÈS rendu via l'effet ci-dessous, jamais dans le tick du `set()`.
   */
  private readonly instructionsHeading =
    viewChild<ElementRef<HTMLElement>>('instructionsHeading');

  constructor() {
    // Focus du titre du panneau d'instructions une fois rendu (L-006) : le `viewChild` ne se résout
    // qu'au rendu suivant le passage `step='instructions'`.
    effect(() => {
      const heading = this.instructionsHeading();
      if (this.step() === 'instructions' && heading) {
        heading.nativeElement.focus();
      }
    });
  }

  // ── Catalogue marque → modèle → dimensions (G2) ───────────────────────────
  /** Catalogue chargé depuis le serveur (marques avec leurs modèles). */
  protected readonly brands = signal<readonly BrandCatalog[]>([]);
  /** Marque sélectionnée (valeur du select marque). '' = aucune. */
  protected readonly selectedBrand = signal('');
  /** Vrai si le catalogue est vide (aucune marque) → on dégrade proprement. */
  protected readonly catalogEmpty = computed(() => this.brands().length === 0);

  /** Modèles disponibles pour la marque choisie (vide tant qu'aucune marque). */
  protected readonly availableModels = computed<readonly ModelCatalog[]>(() => {
    const brand = this.selectedBrand();
    if (!brand) return [];
    return this.brands().find(b => b.brand === brand)?.models ?? [];
  });

  /** Modèle sélectionné (objet catalogue), pour afficher ses dimensions. `null` si aucun. */
  protected readonly selectedModel = signal<ModelCatalog | null>(null);

  /** Affichage : cm (canonique) → pieds (réutilise l'unique point de conversion, L-004). */
  protected readonly toFeet = cmToFeet;

  protected readonly types: readonly BookingType[] = [
    'Installation',
    'Delivery',
    'Removal',
  ];

  protected readonly form = this.fb.nonNullable.group({
    type: ['Installation' as BookingType, Validators.required],
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    apartment: ['', Validators.maxLength(20)],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_PATTERN)]],
    brand: ['', [excludedBrandValidator, Validators.maxLength(100)]],
    model: ['', Validators.maxLength(100)],
    notes: [''],
  });

  /**
   * Câblage « adresse » mutualisé (pastille profil, recopie force D6, suggestions + code postal).
   * Voir `AddressFormController`. Instancié en initialiseur de champ (pendant la construction) : la
   * fabrique résout elle-même ses dépendances par `inject()`. Le template référence directement
   * `addr.*` (pas de ré-exposition — PR #34, dé-duplication SonarCloud).
   */
  protected readonly addr = createAddressFormController(this.form);

  /** Visiteur non connecté : on affiche et exige le bloc « coordonnées invité » (Épic F). */
  protected readonly isGuest = computed(() => !this.auth.isAuthenticated());

  /** Coordonnées invité — uniquement utilisées et validées quand `isGuest()`. */
  protected readonly guestForm = buildGuestContactGroup(this.fb);

  protected get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21); // ~3 prochaines semaines

    this.bookings.getAvailableSlots(this.toIsoDate(from), this.toIsoDate(to)).subscribe({
      next: slots => {
        this.groups.set(this.groupByDay(slots ?? []));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Catalogue marque/modèle — best-effort : en cas d'échec ou de catalogue vide, on
    // dégrade vers des champs texte neutres (catalogEmpty), le submit reste possible.
    this.catalog.getCatalog().subscribe({
      next: brands => {
        const list = brands ?? [];
        this.brands.set(list);
        // En mode catalogue, le select modèle reste désactivé tant qu'aucune marque
        // n'est choisie (désactivation via le control reactive-forms, pas [disabled]).
        if (list.length > 0) this.f.model.disable();
      },
      error: () => this.brands.set([]),
    });
  }

  /**
   * Sélection d'une marque : met à jour le control `brand` (chaîne exacte envoyée au serveur,
   * L-004), réinitialise le modèle (les modèles dépendent de la marque) et vide les dimensions.
   */
  protected onBrandChange(brand: string): void {
    this.selectedBrand.set(brand);
    this.f.brand.setValue(brand);
    this.f.brand.markAsDirty();
    // Le modèle dépend de la marque : on le réinitialise et on active/désactive son select.
    this.f.model.setValue('');
    this.selectedModel.set(null);
    if (brand) {
      this.f.model.enable();
    } else {
      this.f.model.disable();
    }
  }

  /**
   * Sélection d'un modèle : met à jour le control `model` (chaîne exacte) et mémorise l'objet
   * catalogue pour afficher ses dimensions hors-tout (lecture seule).
   */
  protected onModelChange(modelName: string): void {
    this.f.model.setValue(modelName);
    this.f.model.markAsDirty();
    this.selectedModel.set(
      this.availableModels().find(m => m.model === modelName) ?? null,
    );
  }

  protected selectSlot(start: string): void {
    this.selectedSlot.set(start);
  }

  protected confirm(): void {
    if (this.submitting()) return;

    const slot = this.selectedSlot();
    if (!slot) {
      this.toast.show(
        $localize`:@@installation.noSlot:Veuillez choisir un créneau.`,
        'error',
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Invité : ses coordonnées sont requises avant de soumettre (Épic F).
    if (this.isGuest() && this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    const request: CreateBookingRequest = {
      slotStart: slot,
      type: v.type,
      address: {
        civicNumber: v.civicNumber,
        street: v.street,
        apartment: v.apartment.trim() || null,
        city: v.city,
        province: v.province || 'QC',
        postalCode: normalizePostal(v.postalCode),
        country: 'Canada',
      },
      notes: v.notes.trim() || null,
      brand: v.brand?.trim() || null,
      model: v.model?.trim() || null,
      guestContact: this.isGuest() ? toGuestContactRequest(this.guestForm) : null,
    };

    this.bookings.createBooking(request).subscribe({
      next: response => {
        this.submitting.set(false);
        // Réservation enregistrée (PendingPayment) : on présente les instructions de virement Interac.
        // AUCUNE redirection automatique — le client doit lire et exécuter le virement (EPIC 7.3).
        this.paymentInstructions.set(response.payment);
        this.step.set('instructions');
        this.toast.show(
          $localize`:@@installation.success:Réservation enregistrée — suivez les instructions de virement Interac pour la régler.`,
          'success',
        );
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@installation.error:La réservation a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }

  private groupByDay(slots: readonly AvailableSlotDto[]): SlotGroup[] {
    const map = new Map<string, AvailableSlotDto[]>();
    for (const slot of slots) {
      const key = slot.start.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(slot);
      } else {
        map.set(key, [slot]);
      }
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, daySlots]) => ({
        dayKey,
        dayLabel: new Date(daySlots[0].start).toLocaleDateString('fr-CA', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        slots: daySlots,
      }));
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
