import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { FirstLoginHintService } from '../../../core/services/first-login-hint.service';
import { AddressAutofillService } from '../../../core/services/address-autofill.service';
import { LocaleService, AppLocale } from '../../../core/services/locale.service';
import { environment } from '../../../../environments/environment';
import { UserProfileDto, UpdateProfileRequest } from '../../../core/models/profile.model';
import { PlaceSuggestionDto } from '../../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import {
  ADDRESS_LINE_PATTERN,
  POSTAL_PATTERN,
  PROVINCES,
  normalizePostal,
  splitAddressLine,
} from '../../../core/validators/address.validators';

type ActiveTab = 'info' | 'address' | 'security';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AddressAutocompleteComponent],
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly profileStore = inject(ProfileService);
  private readonly firstLoginHint = inject(FirstLoginHintService);
  private readonly addressAutofill = inject(AddressAutofillService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LocaleService);
  private readonly injector = inject(Injector);
  protected readonly auth = inject(AuthService);

  // ── État ────────────────────────────────────────────────────
  protected readonly profile = signal<UserProfileDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<ActiveTab>('info');
  protected readonly saveSuccess = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Annonce (aria-live) : issue de la résolution du code postal après choix d'une suggestion. */
  protected readonly postalFill = signal<'idle' | 'filled' | 'unavailable'>('idle');

  /**
   * Texte de l'alerte non bloquante « entrez votre adresse » (E2), affichée à la
   * première connexion tant que l'adresse de profil est vide et que l'utilisateur ne
   * l'a pas rejetée. Vide = pas d'alerte. La bannière est `role="status"` scopée DANS
   * la page (pas une 3ᵉ région globale dans app.html, leçon L-010). On passe par un
   * état neutre `''` avant chaque message pour garantir la (ré)annonce du lecteur
   * d'écran même si le texte est identique (leçon L-027).
   */
  protected readonly addressHint = signal('');

  // ── Avatar (photo de profil) ─────────────────────────────────
  protected readonly avatarUploading = signal(false);
  protected readonly avatarError = signal<string | null>(null);

  /** Provinces/territoires pour le `<select>` (code 2 lettres canonique, L-011). */
  protected readonly provinces = PROVINCES;

  // Ordre des onglets pour la navigation clavier (ARIA APG : flèches + Home/End).
  protected readonly tabOrder: readonly ActiveTab[] = ['info', 'address', 'security'];
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');
  /**
   * Onglet « Adresse de livraison » — cible STABLE (toujours montée) du retour de
   * focus quand l'alerte « entrez votre adresse » est fermée : son bouton de
   * fermeture disparaît avec elle (`@if`), donc on ne peut pas y laisser le focus
   * (leçon L-006). On renvoie vers l'onglet adresse, qui est aussi le raccourci utile.
   */
  private readonly addressTabBtn = viewChild<ElementRef<HTMLButtonElement>>('addressTabBtn');

  protected readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '?';
    return ((p.firstName ?? '') + (p.lastName ?? '')).toUpperCase() || p.email[0].toUpperCase();
  });

  protected readonly fullName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.firstName} ${p.lastName}`.trim() || p.email;
  });

  protected readonly roleLabel = computed(() => {
    const roles = this.profile()?.roles ?? [];
    if (roles.includes('Admin')) return 'Administrateur';
    if (roles.includes('Staff')) return 'Personnel';
    return 'Client';
  });

  // ── Formulaire informations ──────────────────────────────────
  protected readonly infoForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    phoneNumber: [''],
    preferredLanguage: ['fr'],
  });

  // ── Formulaire adresse ───────────────────────────────────────
  protected readonly addressForm = this.fb.nonNullable.group({
    // Champ unifié « n° et rue » (EPIC 15). Adresse de profil OPTIONNELLE : le motif n'exige un
    // numéro en tête que si la ligne est remplie (vide = toléré). Recombiné depuis le serveur au
    // chargement (`patchForms`), re-scindé à l'enregistrement (`saveAddress`).
    addressLine1: ['', [Validators.maxLength(210), Validators.pattern(ADDRESS_LINE_PATTERN)]],
    apartment: ['', Validators.maxLength(20)],
    city: ['', Validators.maxLength(100)],
    province: ['QC'],
    // Accepte le format canadien avec OU sans espace (« A1A 1A1 » ou « A1A1A1 »),
    // exactement comme l'indice du champ l'affiche. Sans le « espace optionnel »,
    // saisir « J8X 1A1 » échouait silencieusement la validation → l'adresse ne se
    // sauvegardait jamais (leçon L-001). Normalisée à l'enregistrement. Motif partagé
    // avec le serveur via address.validators (L-004).
    postalCode: ['', Validators.pattern(POSTAL_PATTERN)],
    country: ['Canada'],
  });

  // ── Formulaire sécurité (changement mot de passe) ───────────
  protected readonly securityForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/[A-Z]/),
        Validators.pattern(/[0-9]/),
        Validators.pattern(/[^a-zA-Z0-9]/),
      ],
    ],
    confirmPassword: ['', Validators.required],
  });

  // Raccourcis
  protected get fFirst() {
    return this.infoForm.controls.firstName;
  }
  protected get fLast() {
    return this.infoForm.controls.lastName;
  }
  protected get fPhone() {
    return this.infoForm.controls.phoneNumber;
  }
  protected get fLang() {
    return this.infoForm.controls.preferredLanguage;
  }

  protected get aLine1() {
    return this.addressForm.controls.addressLine1;
  }
  protected get aPostal() {
    return this.addressForm.controls.postalCode;
  }

  protected get sCurrent() {
    return this.securityForm.controls.currentPassword;
  }
  protected get sNew() {
    return this.securityForm.controls.newPassword;
  }
  protected get sConfirm() {
    return this.securityForm.controls.confirmPassword;
  }
  protected get sPwdMismatch() {
    return this.sNew.value !== this.sConfirm.value && this.sConfirm.touched;
  }

  // ── Cycle de vie ────────────────────────────────────────────
  ngOnInit(): void {
    this.http.get<UserProfileDto>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.profileStore.setProfile(profile);
        this.patchForms(profile);
        this.loading.set(false);
        this.evaluateAddressHint(profile);
      },
      error: () => {
        // Fallback : utiliser les données du token JWT
        const u = this.auth.user();
        if (u) {
          this.infoForm.patchValue({
            firstName: u.firstName,
            lastName: u.lastName,
          });
        }
        this.loading.set(false);
      },
    });
  }

  // ── Navigation des onglets ───────────────────────────────────
  protected setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  /**
   * Navigation clavier des onglets (ARIA Authoring Practices) :
   * flèches gauche/droite (avec bouclage), Home/End. Activation automatique —
   * la sélection suit le focus, le focus reste sur l'onglet (Tab entre dans le panneau).
   */
  protected onTabKeydown(event: KeyboardEvent): void {
    const tabs = this.tabOrder;
    const current = tabs.indexOf(this.activeTab());
    let next = current;

    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.setTab(tabs[next]);
    this.tabButtons()[next]?.nativeElement.focus();
  }

  // ── Alerte « entrez votre adresse » (première connexion, E2) ─────────────────
  /**
   * Calcule s'il faut afficher l'alerte d'adresse à partir du profil chargé. La
   * source de l'adresse est le profil (`defaultDeliveryAddress`), JAMAIS `AuthUser`
   * (qui ne la transporte pas, leçon L-003). On passe par `''` avant le message pour
   * forcer la ré-annonce du lecteur d'écran (leçon L-027) ; l'`userId` vient du token.
   */
  private evaluateAddressHint(profile: UserProfileDto): void {
    const userId = this.auth.user()?.id ?? profile.id;
    const hasAddress = profile.defaultDeliveryAddress !== null;
    this.addressHint.set('');
    if (this.firstLoginHint.shouldShowAddressHint(userId, hasAddress)) {
      this.addressHint.set(
        $localize`:@@profile.addressHint:Bienvenue ! Ajoutez votre adresse de livraison pour accélérer vos commandes et réservations.`,
      );
    }
  }

  /** Raccourci de l'alerte : bascule sur l'onglet « Adresse de livraison ». */
  protected goToAddressTab(): void {
    this.setTab('address');
  }

  /**
   * Ferme l'alerte d'adresse, mémorise le rejet (par compte) et renvoie le focus
   * vers une cible STABLE — l'onglet « Adresse » — APRÈS le rendu qui retire le
   * bouton de fermeture du DOM (`@if`), jamais dans le même tick (leçon L-006).
   */
  protected dismissAddressHint(): void {
    const userId = this.auth.user()?.id ?? this.profile()?.id;
    if (userId) this.firstLoginHint.dismiss(userId);
    this.addressHint.set('');
    afterNextRender(
      () => this.addressTabBtn()?.nativeElement.focus(),
      { injector: this.injector },
    );
  }

  // ── Sauvegarde informations ──────────────────────────────────
  protected saveInfo(): void {
    if (this.infoForm.invalid) {
      this.infoForm.markAllAsTouched();
      return;
    }
    this.save({ ...this.infoForm.getRawValue(), phoneNumber: this.fPhone.value || null });
  }

  // ── Autocomplétion d'adresse ─────────────────────────────────
  /**
   * Choix explicite d'une suggestion — délègue à `AddressAutofillService` (logique partagée
   * par les 4 formulaires). Patch civic/rue/ville/province INCONDITIONNEL (action utilisateur,
   * hors garde pristine de L-002), code postal résolu/normalisé (L-004) et resté éditable ;
   * null → aucun patch.
   */
  protected onSuggestionSelected(s: PlaceSuggestionDto): void {
    // Réinitialiser AVANT chaque sélection : sans repassage par 'idle', deux résolutions
    // successives au même statut n'émettraient pas (signal idempotent) → pas de ré-annonce.
    this.postalFill.set('idle');
    this.addressAutofill
      .applySuggestion(this.addressForm, s)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => this.postalFill.set(result.status));
  }

  /** Frappe libre dans le combobox : synchronise le contrôle unifié `addressLine1` (EPIC 15). */
  protected onAddressLineInput(value: string): void {
    this.addressAutofill.syncAddressLine(this.addressForm, value);
  }

  // ── Sauvegarde adresse ───────────────────────────────────────
  protected saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    const raw = this.addressForm.getRawValue();
    // EPIC 15 (voie B1) — re-scinde la ligne unifiée en n° + rue pour le DTO serveur découpé.
    const { civicNumber, street } = splitAddressLine(raw.addressLine1);
    const addr = {
      civicNumber,
      street,
      apartment: raw.apartment.trim() || null,
      city: raw.city,
      province: raw.province,
      postalCode: normalizePostal(raw.postalCode),
      country: raw.country,
    };
    // Le serveur exige n° civique + rue + ville + code postal pour considérer une
    // adresse « présente » : on n'envoie un objet que si ces champs sont remplis.
    const hasAddress = addr.civicNumber && addr.street && addr.city && addr.postalCode;

    this.save({
      firstName: this.fFirst.value,
      lastName: this.fLast.value,
      phoneNumber: this.fPhone.value || null,
      preferredLanguage: this.fLang.value,
      defaultDeliveryAddress: hasAddress ? addr : null,
    });
  }

  // ── Changement de mot de passe ───────────────────────────────
  protected changePassword(): void {
    if (this.securityForm.invalid || this.sPwdMismatch) {
      this.securityForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);

    this.http
      .post(`${environment.apiUrl}/auth/me/change-password`, {
        currentPassword: this.sCurrent.value,
        newPassword: this.sNew.value,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saveSuccess.set(true);
          this.securityForm.reset();
          setTimeout(() => this.saveSuccess.set(false), 4000);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(err.error?.error ?? err.error?.detail ?? 'Erreur lors du changement.');
        },
      });
  }

  // ── Avatar : téléversement et retrait ────────────────────────
  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Réinitialise l'input pour pouvoir resélectionner le même fichier ensuite.
    input.value = '';
    if (file) this.uploadAvatar(file);
  }

  protected removeAvatar(): void {
    if (!this.profile()?.avatar || this.avatarUploading()) return;
    this.avatarUploading.set(true);
    this.avatarError.set(null);

    this.http
      .delete<UserProfileDto>(`${environment.apiUrl}/auth/me/avatar`)
      .subscribe({
        next: updated => {
          this.profile.set(updated);
          this.auth.updateProfile({ avatar: updated.avatar });
          this.avatarUploading.set(false);
        },
        error: err => {
          this.avatarUploading.set(false);
          this.avatarError.set(
            err.error?.error ?? err.error?.detail ?? 'Le retrait de la photo a échoué.',
          );
        },
      });
  }

  private uploadAvatar(file: File): void {
    this.avatarError.set(null);
    this.avatarUploading.set(true);

    const form = new FormData();
    form.append('file', file);

    this.http
      .post<UserProfileDto>(`${environment.apiUrl}/auth/me/avatar`, form)
      .subscribe({
        next: updated => {
          this.profile.set(updated);
          this.auth.updateProfile({ avatar: updated.avatar });
          this.avatarUploading.set(false);
        },
        error: err => {
          this.avatarUploading.set(false);
          this.avatarError.set(
            err.error?.error ?? err.error?.detail ?? 'Le téléversement de la photo a échoué.',
          );
        },
      });
  }

  // ── Privé ────────────────────────────────────────────────────
  private save(partial: Partial<UpdateProfileRequest>): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    // L'adresse enregistrée est préservée par défaut : sauvegarder l'onglet
    // « Informations » ne doit PAS effacer l'adresse de livraison (régression).
    const current = this.profile();
    const payload: UpdateProfileRequest = {
      firstName: this.fFirst.value,
      lastName: this.fLast.value,
      phoneNumber: this.fPhone.value || null,
      preferredLanguage: this.fLang.value,
      defaultDeliveryAddress: current?.defaultDeliveryAddress ?? null,
      ...partial,
    };

    this.http.put<UserProfileDto>(`${environment.apiUrl}/auth/me`, payload).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.profileStore.setProfile(updated);
        this.patchForms(updated);
        // Rafraîchit le nom mis en cache → la navbar se met à jour aussitôt.
        this.auth.updateProfile({
          firstName: updated.firstName,
          lastName: updated.lastName,
        });
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 4000);
        // Si la langue préférée enregistrée diffère de la locale servie, on
        // recharge le site dans cette langue (i18n compile-time → navigation
        // vers l'autre build). No-op sinon ; SSR géré dans LocaleService.
        const lang = updated.preferredLanguage as AppLocale;
        if ((lang === 'fr' || lang === 'en') && lang !== this.locale.current()) {
          this.locale.switchTo(lang);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(
          err.error?.error ?? err.error?.detail ?? 'Erreur lors de la sauvegarde.',
        );
      },
    });
  }

  private patchForms(p: UserProfileDto): void {
    this.infoForm.patchValue({
      firstName: p.firstName,
      lastName: p.lastName,
      phoneNumber: p.phoneNumber ?? '',
      preferredLanguage: p.preferredLanguage ?? 'fr',
    });

    const a = p.defaultDeliveryAddress;
    if (a) {
      this.addressForm.patchValue({
        // EPIC 15 — recombine n° + rue de l'adresse serveur (découpée) dans le champ unifié.
        addressLine1: `${a.civicNumber} ${a.street}`.trim(),
        apartment: a.apartment ?? '',
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
      });
    }
  }
}
