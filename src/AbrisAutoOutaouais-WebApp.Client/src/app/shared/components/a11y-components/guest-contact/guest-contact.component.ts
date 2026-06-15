import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { GuestContactForm } from '../../../../core/validators/guest-contact.validators';

/**
 * Bloc « coordonnées invité » réutilisable (parcours invité, Épic F).
 *
 * Idiome aligné sur l'adresse (Épic D) : le `FormGroup` est porté par l'ÉCRAN parent — celui-ci
 * construit ses contrôles via `buildGuestContactGroup(fb)` et passe le groupe ici. Le composant ne
 * fait QUE rendre les champs étiquetés/accessibles (pas de logique métier, pas d'état propre).
 *
 * L'écran n'affiche ce bloc QUE pour un visiteur non connecté (`!auth.isAuthenticated()`) ; pour un
 * utilisateur connecté il n'est jamais rendu et la charge omet `guestContact`.
 *
 * Accessibilité (CLAUDE.md + leçons) :
 *  - chaque champ a un `<label for>` lié ; les erreurs sont reliées par `aria-describedby` et
 *    `role="alert"`, SCOPÉES au formulaire (pas de live-region/landmark global — L-010) ;
 *  - `idPrefix` rend les `id` uniques par écran (un seul nœud par id sur la page — L-013) ;
 *  - cibles tactiles ≥ 44px (gérées par la classe `.field__input` globale) ;
 *  - i18n sur tous les libellés et messages d'erreur (ids `@@guestContact.*`).
 */
@Component({
  selector: 'app-guest-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './guest-contact.component.html',
  styleUrl: './guest-contact.component.scss',
})
export class GuestContactComponent {
  /** Groupe de formulaire porté par l'écran (cf. `buildGuestContactGroup`). */
  readonly group = input.required<GuestContactForm>();

  /** Préfixe d'`id` propre à l'écran (`co`, `loc`, `inst`…) pour des `id` uniques (L-013). */
  readonly idPrefix = input.required<string>();

  protected get c() {
    return this.group().controls;
  }
}
