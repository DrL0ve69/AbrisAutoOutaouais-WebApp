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
  viewChildren,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShelterService } from '../../core/services/shelter.service';
import { RentalService } from '../../core/services/rental.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { createAddressFormController } from '../../core/services/address-form.controller';
import { RentableShelterModel } from '../../core/models/shelter.model';
import { CreateRentalContractRequest } from '../../core/models/rental.model';
import { PaymentInstructions } from '../../core/models/order.model';
import { FaqComponent } from '../../shared/components/faq/faq.component';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../shared/components/a11y-components/address-choice/address-choice.component';
import { GuestContactComponent } from '../../shared/components/a11y-components/guest-contact/guest-contact.component';
import { LOCATION_FAQ } from '../../shared/content/faq.data';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../core/validators/address.validators';
import {
  buildGuestContactGroup,
  toGuestContactRequest,
} from '../../core/validators/guest-contact.validators';
import { isRadioNavKey, nextRadioIndex } from '../mesurer/util/radio-nav.util';
import { formatFeetInches } from '../mesurer/util/feet-inches.util';

/**
 * Location saisonnière d'abris (rework EPIC 9). Liste les MODÈLES louables (tarif mensuel
 * FORFAITAIRE, indépendant de la taille) ; l'utilisateur choisit un modèle, puis une TAILLE
 * (longueur par pas + hauteur dégagée) valide pour ce modèle, puis une période et une adresse.
 *
 * Décision sélecteur de taille : on N'utilise PAS `DimensionConfiguratorComponent` (qui appelle
 * `/price` et affiche un prix d'ACHAT par couple — trompeur pour une location à tarif forfaitaire).
 * On pose un petit sélecteur accessible dédié : un `<select>` natif pour la longueur (multiples du
 * pas dans [min, max]) + un radiogroup APG (roving tabindex + flèches/Home/End — util pur
 * `radio-nav.util`, L-015) pour la hauteur dégagée. La taille (longueur, hauteur) est REQUISE avant
 * soumission ; le serveur revalide contre la grille (422 si hors grille). Garde-fou DENSE côté client
 * (`combinationOffered`) en bonus, sans répliquer la logique de grille éparse.
 */
@Component({
  selector: 'app-location',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    RouterLink,
    FaqComponent,
    AddressAutocompleteComponent,
    AddressChoiceComponent,
    GuestContactComponent,
  ],
  templateUrl: './location.html',
  styleUrl: './location.scss',
})
export class LocationComponent implements OnInit {
  /** Entrées FAQ de la page (durée, dépôt, annulation, installation). */
  protected readonly faq = LOCATION_FAQ;

  private readonly fb = inject(FormBuilder);
  private readonly shelterService = inject(ShelterService);
  private readonly rentals = inject(RentalService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);

  /**
   * Étape du tunnel : saisie du formulaire, puis instructions de virement Interac (EPIC 7.2),
   * comme la caisse. Aucune redirection automatique : le client lit et exécute le virement ;
   * la réconciliation (activation du contrat) est faite plus tard par l'administration.
   */
  protected readonly step = signal<'form' | 'instructions'>('form');
  /** Instructions de virement Interac renvoyées par le serveur à la création du contrat. */
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

  // ── Modèles louables + sélection ─────────────────────────────────────────────
  protected readonly rentableModels = signal<readonly RentableShelterModel[]>([]);
  protected readonly selectedSlug = signal<string | null>(null);
  protected readonly hasModels = computed(() => this.rentableModels().length > 0);
  protected readonly selectedModel = computed(
    () => this.rentableModels().find(m => m.slug === this.selectedSlug()) ?? null,
  );

  /** Hauteur dégagée sélectionnée (index dans `clearHeightOptionsCm`) — roving tabindex APG. */
  protected readonly heightIndex = signal(0);
  /** Boutons radio de hauteur (ordre DOM) pour déplacer le focus au clavier. */
  private readonly heightRadios = viewChildren<ElementRef<HTMLButtonElement>>('heightRadio');

  /** Longueurs offertes (cm) : multiples du pas dans [min, max] du modèle sélectionné. */
  protected readonly lengthOptionsCm = computed<readonly number[]>(() => {
    const m = this.selectedModel();
    if (!m) return [];
    const count = Math.floor((m.maxLengthCm - m.minLengthCm) / m.lengthStepCm) + 1;
    return Array.from({ length: count }, (_, i) => m.minLengthCm + i * m.lengthStepCm);
  });

  /** Hauteur dégagée (cm) sélectionnée, dérivée de l'index et du modèle. */
  protected readonly selectedHeightCm = computed(() => {
    const m = this.selectedModel();
    return m ? (m.clearHeightOptionsCm[this.heightIndex()] ?? 0) : 0;
  });

  /** Contrôle de longueur (cm) — `<select>` natif (choix discret aligné sur le pas). */
  protected readonly lengthControl = this.fb.control<number | null>(null, Validators.required);

  /**
   * Garde-fou DENSE côté client : le couple (longueur, hauteur) figure-t-il dans la grille du modèle ?
   * Bonus UX — le serveur reste l'arbitre (422 si hors grille). `false` aussi tant qu'aucune longueur
   * n'est choisie.
   */
  protected readonly combinationOffered = computed(() => {
    const m = this.selectedModel();
    const length = this.lengthControl.value;
    if (!m || length === null) return false;
    const height = this.selectedHeightCm();
    return m.priceGrid.some(e => e.lengthCm === length && e.clearHeightCm === height);
  });

  protected readonly form = this.fb.nonNullable.group({
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    apartment: ['', Validators.maxLength(20)],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_PATTERN)]],
  });

  /**
   * Câblage « adresse » mutualisé (pastille profil, recopie force D6, suggestions + code postal).
   * Voir `AddressFormController`. Instancié en initialiseur de champ (pendant la construction).
   */
  protected readonly addr = createAddressFormController(this.form);

  /** Visiteur non connecté : on affiche et exige le bloc « coordonnées invité » (Épic F). */
  protected readonly isGuest = computed(() => !this.auth.isAuthenticated());

  /** Coordonnées invité — uniquement utilisées et validées quand `isGuest()`. */
  protected readonly guestForm = buildGuestContactGroup(this.fb);

  protected formatFeetInches = formatFeetInches;

  protected get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.shelterService.getRentableModels().subscribe({
      next: models => {
        this.rentableModels.set(models);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Sélectionne un modèle et réinitialise la taille (longueur vidée, hauteur sur la 1re option). */
  protected selectModel(slug: string): void {
    this.selectedSlug.set(slug);
    this.heightIndex.set(0);
    this.lengthControl.reset(null);
  }

  // ── Radiogroup APG : hauteur dégagée ─────────────────────────────────────────
  protected selectHeight(index: number): void {
    this.heightIndex.set(index);
  }

  protected onHeightKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const count = this.selectedModel()?.clearHeightOptionsCm.length ?? 0;
    const next = nextRadioIndex(event.key, this.heightIndex(), count);
    this.selectHeight(next);
    this.heightRadios()[next]?.nativeElement.focus();
  }

  protected confirm(): void {
    if (this.submitting()) return;

    const slug = this.selectedSlug();
    if (!slug) {
      this.toast.show(
        $localize`:@@location.noModel:Veuillez choisir un abri à louer.`,
        'error',
      );
      return;
    }

    // Taille requise : longueur choisie + couple offert dans la grille (garde-fou dense, le serveur
    // reste l'arbitre via 422).
    const length = this.lengthControl.value;
    if (length === null || !this.combinationOffered()) {
      this.lengthControl.markAsTouched();
      this.toast.show(
        $localize`:@@location.noSize:Veuillez choisir une taille offerte pour cet abri.`,
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

    const v = this.form.getRawValue();
    if (v.endDate <= v.startDate) {
      this.toast.show(
        $localize`:@@location.badDates:La date de fin doit être après la date de début.`,
        'error',
      );
      return;
    }

    this.submitting.set(true);
    const request: CreateRentalContractRequest = {
      slug,
      lengthCm: length,
      clearHeightCm: this.selectedHeightCm(),
      startDate: v.startDate,
      endDate: v.endDate,
      address: {
        civicNumber: v.civicNumber,
        street: v.street,
        apartment: v.apartment.trim() || null,
        city: v.city,
        province: v.province || 'QC',
        postalCode: normalizePostal(v.postalCode),
        country: 'Canada',
      },
      guestContact: this.isGuest() ? toGuestContactRequest(this.guestForm) : null,
    };

    this.rentals.createRental(request).subscribe({
      next: response => {
        this.submitting.set(false);
        // Contrat enregistré (PendingPayment) : on présente les instructions de virement Interac.
        // AUCUNE redirection automatique — le client doit lire et exécuter le virement (EPIC 7.2).
        this.paymentInstructions.set(response.payment);
        this.step.set('instructions');
        this.toast.show(
          $localize`:@@location.success:Location enregistrée — suivez les instructions de virement Interac pour la régler.`,
          'success',
        );
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@location.error:La location a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }
}
