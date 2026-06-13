import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../core/services/product.service';
import { ProductDto, resolveProductImage } from '../../core/models/product.model';
import { HeroStoryComponent } from './hero-story/hero-story';

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
  imports: [RouterLink, CurrencyPipe, HeroStoryComponent],
})
export class HomeComponent implements OnInit {
  private readonly productService = inject(ProductService);

  // ── Produits vedettes ───────────────────────────────────────
  protected readonly featuredProducts = signal<ProductDto[]>([]);
  protected readonly loadingProducts = signal(true);

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
    // Produits vedettes (3 premiers) — le catalogue complet vit sur /boutique.
    this.productService.getProducts({ page: 1, pageSize: 3 }).subscribe({
      next: (res) => {
        this.featuredProducts.set([...res.items]);
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false),
    });
  }

  // URL de l'image (SVG par slug) pour les cartes de la page d'accueil.
  protected imageFor(product: ProductDto): string {
    return resolveProductImage(product);
  }

  // En cas d'erreur de chargement, on masque l'image pour révéler le
  // placeholder en dégradé positionné dessous.
  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
