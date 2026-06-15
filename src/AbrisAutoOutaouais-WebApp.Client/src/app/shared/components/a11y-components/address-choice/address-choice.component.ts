import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AddressDto } from '../../../../core/models/booking.model';
import { formatAddressLine } from '../../../../core/util/format-address.util';

type AddressMode = 'profile' | 'other';

/**
 * Choix d'adresse pour un utilisateur connecté possédant une adresse de profil (D6).
 *
 * Deux états :
 *  - `'profile'` (défaut quand `profileAddress()` existe) : affiche une PASTILLE en lecture seule
 *    avec l'adresse formatée + un bouton « Utiliser une autre adresse ». Le contenu projeté
 *    (`<ng-content>` = le formulaire structuré de l'écran) est MASQUÉ.
 *  - `'other'` : affiche le contenu projeté (formulaire éditable) + un bouton retour
 *    « Utiliser l'adresse de mon profil ».
 *
 * FRONTIÈRE DURE — parcours anonyme INCHANGÉ : si `profileAddress()` est `null` (invité OU connecté
 * sans adresse enregistrée), le composant rend DIRECTEMENT `<ng-content>`, sans pastille, sans
 * bouton, mode `'other'` implicite — le formulaire de l'écran s'affiche exactement comme avant.
 *
 * Accessibilité (CLAUDE.md + leçons) :
 *  - La pastille est un `role="group"` NEUTRE étiqueté par `headingId` (jamais un live-region).
 *  - Une annonce `role="status"`/`aria-live` SCOPÉE au composant (L-010, jamais un landmark global)
 *    signale la bascule. On repasse par la chaîne vide entre deux annonces identiques (signal
 *    idempotent), comme le `postalFill` des écrans.
 *  - Focus APRÈS rendu (L-006) : la bascule AJOUTE/RETIRE des nœuds, donc on ne focalise jamais dans
 *    le même tick que `mode.set(...)`. Un `effect()` lit le `viewChild()` du bouton de la nouvelle
 *    vue (présent une fois le rendu fait) et le focalise — la cible vit DANS ce template (stable),
 *    pas dans le contenu projeté.
 *  - Aucune entrée nommée `id`/`class`/`role` (L-013).
 */
@Component({
  selector: 'app-address-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './address-choice.component.html',
  styleUrl: './address-choice.component.scss',
})
export class AddressChoiceComponent {
  /** Adresse de profil à proposer. `null` ⇒ parcours anonyme (rend `<ng-content>` directement). */
  readonly profileAddress = input<AddressDto | null>(null);
  /** `id` du titre de section de l'écran, repris par `aria-labelledby` de la pastille. */
  readonly headingId = input<string>('');

  /** Émis à chaque transition de mode — l'écran patche/réinitialise son formulaire en conséquence. */
  readonly modeChange = output<AddressMode>();

  /** Mode courant. Démarre en `'profile'` ; ignoré (traité comme `'other'`) si pas d'adresse profil. */
  protected readonly mode = signal<AddressMode>('profile');

  /** Vrai quand une adresse de profil existe : pilote l'affichage de la pastille. */
  protected readonly hasProfileAddress = computed(() => this.profileAddress() !== null);

  /** Mode effectif : sans adresse profil, on est toujours en « autre adresse ». */
  protected readonly effectiveMode = computed<AddressMode>(() =>
    this.hasProfileAddress() ? this.mode() : 'other',
  );

  /** Adresse de profil mise en forme pour l'affichage (vide si absente). */
  protected readonly formattedAddress = computed(() => {
    const address = this.profileAddress();
    return address ? formatAddressLine(address) : '';
  });

  /** Annonce live (sr-only) de la bascule ; chaîne vide entre deux annonces identiques. */
  protected readonly announcement = signal('');

  private readonly useOtherButton =
    viewChild<ElementRef<HTMLButtonElement>>('useOtherButton');
  private readonly useProfileButton =
    viewChild<ElementRef<HTMLButtonElement>>('useProfileButton');

  /** Cible du focus à recevoir après le prochain rendu (null = ne pas voler le focus). */
  private readonly focusTarget = signal<'useOther' | 'useProfile' | null>(null);

  constructor() {
    // Focus APRÈS rendu (L-006) : l'effet lit le viewChild de la nouvelle vue. Comme un `viewChild`
    // est un signal qui se met à jour une fois l'élément projeté dans le DOM, l'effet se ré-exécute
    // quand le bouton cible apparaît — on focalise alors hors du tick de `mode.set`.
    effect(() => {
      const target = this.focusTarget();
      if (target === null) return;
      const el =
        target === 'useOther'
          ? this.useOtherButton()?.nativeElement
          : this.useProfileButton()?.nativeElement;
      if (el) {
        el.focus();
        this.focusTarget.set(null);
      }
    });
  }

  /** Passe au formulaire « autre adresse ». Focus post-rendu sur le bouton retour. */
  protected switchToOther(): void {
    this.mode.set('other');
    this.modeChange.emit('other');
    this.announce(
      $localize`:@@address.choice.switchedToOther:Formulaire d'adresse affiché.`,
    );
    this.focusTarget.set('useProfile');
  }

  /** Revient à la pastille d'adresse de profil. Focus post-rendu sur le bouton « autre adresse ». */
  protected switchToProfile(): void {
    this.mode.set('profile');
    this.modeChange.emit('profile');
    this.announce(
      $localize`:@@address.choice.switchedToProfile:Adresse de profil sélectionnée.`,
    );
    this.focusTarget.set('useOther');
  }

  /** Réinitialise via chaîne vide avant de poser le message (sinon un signal idempotent ne ré-émet pas). */
  private announce(message: string): void {
    this.announcement.set('');
    this.announcement.set(message);
  }
}
