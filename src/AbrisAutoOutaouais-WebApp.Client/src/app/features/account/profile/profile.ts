import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';
import { AddressAutofillService } from '../../../core/services/address-autofill.service';
import { LocaleService, AppLocale } from '../../../core/services/locale.service';
import { environment } from '../../../../environments/environment';
import { UserProfileDto, UpdateProfileRequest } from '../../../core/models/profile.model';
import { PlaceSuggestionDto } from '../../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../../core/validators/address.validators';

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
  private readonly addressAutofill = inject(AddressAutofillService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LocaleService);
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

  // ── Avatar (photo de profil) ─────────────────────────────────
  protected readonly avatarUploading = signal(false);
  protected readonly avatarError = signal<string | null>(null);

  // Ordre des onglets pour la navigation clavier (ARIA APG : flèches + Home/End).
  protected readonly tabOrder: readonly ActiveTab[] = ['info', 'address', 'security'];
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

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
    civicNumber: ['', [Validators.maxLength(10), Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.maxLength(200)],
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

  protected get aCivic() {
    return this.addressForm.controls.civicNumber;
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

  /** Frappe libre dans le combobox : synchronise le contrôle « rue ». */
  protected onStreetInput(value: string): void {
    this.addressAutofill.syncStreet(this.addressForm, value);
  }

  // ── Sauvegarde adresse ───────────────────────────────────────
  protected saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    const raw = this.addressForm.getRawValue();
    const addr = {
      ...raw,
      apartment: raw.apartment.trim() || null,
      postalCode: normalizePostal(raw.postalCode),
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
        civicNumber: a.civicNumber,
        street: a.street,
        apartment: a.apartment ?? '',
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
      });
    }
  }
}
