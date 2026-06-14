import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Hero d'accueil — AbrisTempo Local.
 *
 * Section d'introduction STATIQUE : titre (h1/LCP), sous-titre, deux CTA et trois
 * statistiques, posés dès la peinture serveur (pas de JS requis). Aucune animation
 * au défilement — la page défile normalement (l'ancien récit GSAP « scroll story »
 * épinglé a été retiré). Décor purement CSS (dégradé navy + lueurs), `aria-hidden`
 * implicite car non textuel. WCAG AA : h1, aria-labels, focus visible, contrastes
 * vérifiés en e2e dual-thème (`motion-a11y.spec.ts`).
 */
@Component({
  selector: 'app-hero-story',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-story.html',
  styleUrl: './hero-story.scss',
  imports: [RouterLink],
})
export class HeroStoryComponent {}
