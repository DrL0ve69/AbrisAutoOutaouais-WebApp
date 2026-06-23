import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShelterService } from '../../core/services/shelter.service';
import { ToastService } from '../../core/services/toast.service';
import { ShelterModelSummary } from '../../core/models/shelter.model';
import { HeroStoryComponent } from './hero-story/hero-story';
import {
  ShelterModelCardComponent,
  ShelterConfigureRequest,
} from '../shop/shelter-model-card/shelter-model-card';
import { ShelterConfiguratorOverlayComponent } from '../shop/shelter-configurator-overlay/shelter-configurator-overlay';

interface ServiceCard {
  icon: string;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
}

interface WhyUsItem {
  icon: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    HeroStoryComponent,
    ShelterModelCardComponent,
    ShelterConfiguratorOverlayComponent,
  ],
})
export class HomeComponent implements OnInit {
  private readonly shelterService = inject(ShelterService);
  private readonly toastService = inject(ToastService);

  // ── Modèles d'abris en vedette (rework EPIC 9 : configure-only) ──────────────
  /** Trois modèles d'abris représentatifs ; l'ajout au panier passe par l'overlay (dimensions requises). */
  protected readonly featuredModels = signal<ShelterModelSummary[]>([]);
  protected readonly loadingModels = signal(true);

  /** Overlay de configuration ouvert (slug + nom du modèle), ou null s'il est fermé. */
  protected readonly overlay = signal<{ slug: string; modelName: string } | null>(null);
  /** Bouton à re-focaliser à la fermeture de l'overlay (retour de focus — WCAG 2.4.3, L-006). */
  private overlayTrigger: HTMLElement | null = null;

  protected readonly services: ServiceCard[] = [
    {
      icon: '🏪',
      title: $localize`:@@home.services.shop.title:Boutique en ligne`,
      description: $localize`:@@home.services.shop.desc:Parcourez notre catalogue complet d'abris d'auto Tempo. Livraison disponible partout en Outaouais.`,
      link: '/boutique',
      linkLabel: $localize`:@@home.services.shop.link:Voir le catalogue`,
    },
    {
      icon: '📅',
      title: $localize`:@@home.services.rental.title:Location saisonnière`,
      description: $localize`:@@home.services.rental.desc:Louez un abri pour la saison. Solution flexible et économique sans engagement à long terme.`,
      link: '/location',
      linkLabel: $localize`:@@home.services.rental.link:Explorer la location`,
    },
    {
      icon: '🔧',
      title: $localize`:@@home.services.install.title:Installation professionnelle`,
      description: $localize`:@@home.services.install.desc:Service d'installation et de démontage à domicile. Réservez votre créneau en ligne.`,
      link: '/installation',
      linkLabel: $localize`:@@home.services.install.link:Réserver maintenant`,
    },
    {
      icon: '📐',
      title: $localize`:@@home.services.measure.title:Mesurer mon stationnement`,
      description: $localize`:@@home.services.measure.desc:Mesurez votre espace sur une carte satellite ou avec notre calculateur, et trouvez l'abri adapté.`,
      link: '/mesurer',
      linkLabel: $localize`:@@home.services.measure.link:Mesurer mon espace`,
    },
  ];

  protected readonly whyUs: WhyUsItem[] = [
    {
      icon: '✅',
      title: $localize`:@@home.whyUs.official.title:Représentant officiel`,
      text: $localize`:@@home.whyUs.official.text:Distributeur agréé Tempo pour la région de l'Outaouais. Produits garantis et authentiques.`,
    },
    {
      icon: '🚛',
      title: $localize`:@@home.whyUs.delivery.title:Livraison régionale`,
      text: $localize`:@@home.whyUs.delivery.text:Livraison directement chez vous dans toute la région. Disponible 7 jours sur 7.`,
    },
    {
      icon: '📞',
      title: $localize`:@@home.whyUs.service.title:Service personnalisé`,
      text: $localize`:@@home.whyUs.service.text:Parlez à un vrai représentant. Conseils sur mesure pour choisir le bon abri.`,
    },
    {
      icon: '🛡️',
      title: $localize`:@@home.whyUs.quality.title:Qualité garantie`,
      text: $localize`:@@home.whyUs.quality.text:Abris Tempo reconnus pour leur robustesse face aux conditions hivernales du Québec.`,
    },
  ];

  ngOnInit(): void {
    // Modèles en vedette : les 3 premiers du référentiel (ordre serveur déterministe — tri Name/Slug).
    // L'achat passe TOUJOURS par l'overlay de configuration (dimensions obligatoires — rework EPIC 9),
    // jamais par la fiche produit (ce qui supprime aussi le chemin 404 spéculatif signalé).
    this.shelterService.getModels().subscribe({
      next: (models) => {
        this.featuredModels.set(models.slice(0, 3));
        this.loadingModels.set(false);
      },
      error: () => this.loadingModels.set(false),
    });
  }

  // ── Overlay de configuration (calque catalog.ts) ─────────────────────────────
  /** Ouvre l'overlay pour le modèle demandé et mémorise le bouton déclencheur (retour de focus). */
  protected openConfigurator(request: ShelterConfigureRequest): void {
    this.overlayTrigger = request.trigger;
    this.overlay.set({ slug: request.slug, modelName: request.modelName });
  }

  /** Ferme l'overlay et rend le focus au bouton qui l'a ouvert (WCAG 2.4.3 — L-006). */
  protected closeConfigurator(): void {
    this.overlay.set(null);
    this.overlayTrigger?.focus();
    this.overlayTrigger = null;
  }

  /**
   * Abri ajouté depuis l'overlay : confirme au niveau page (toast) PUIS ferme l'overlay (qui rend
   * le focus au déclencheur — L-006 : le déclencheur existe toujours, focus synchrone OK).
   */
  protected onShelterAdded(modelName: string): void {
    this.toastService.show(
      $localize`:@@home.featured.shelterAddedToast:${modelName}:name: a été ajouté au panier.`,
      'success',
    );
    this.closeConfigurator();
  }
}
