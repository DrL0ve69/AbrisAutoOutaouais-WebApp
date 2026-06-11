import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CurrencyPipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { ProductSummaryDto, PaginatedList } from '../../core/models/product.model';

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
  imports: [RouterLink, CurrencyPipe],
})
export class HomeComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly featuredProducts = signal<ProductSummaryDto[]>([]);
  protected readonly loadingProducts = signal(true);

  protected readonly services: ServiceCard[] = [
    {
      icon: '🏪',
      title: 'Boutique en ligne',
      description: 'Parcourez notre catalogue complet d\'abris d\'auto Tempo. Livraison disponible partout en Outaouais.',
      link: '/boutique',
      linkLabel: 'Voir le catalogue',
    },
    {
      icon: '📅',
      title: 'Location saisonnière',
      description: 'Louez un abri pour la saison. Solution flexible et économique sans engagement à long terme.',
      link: '/location',
      linkLabel: 'Explorer la location',
    },
    {
      icon: '🔧',
      title: 'Installation professionnelle',
      description: 'Service d\'installation et de démontage à domicile. Réservez votre créneau en ligne.',
      link: '/installation',
      linkLabel: 'Réserver maintenant',
    },
  ];

  protected readonly whyUs: WhyUsItem[] = [
    { icon: '✅', title: 'Représentant officiel', text: 'Distributeur agréé Tempo pour la région de l\'Outaouais. Produits garantis et authentiques.' },
    { icon: '🚛', title: 'Livraison régionale', text: 'Livraison directement chez vous dans toute la région. Disponible 7 jours sur 7.' },
    { icon: '📞', title: 'Service personnalisé', text: 'Parlez à un vrai représentant. Conseils sur mesure pour choisir le bon abri.' },
    { icon: '🛡️', title: 'Qualité garantie', text: 'Abris Tempo reconnus pour leur robustesse face aux conditions hivernales du Québec.' },
  ];

  ngOnInit(): void {
    this.http
      .get<PaginatedList<ProductSummaryDto>>(
        `${environment.apiUrl}/products?page=1&pageSize=3`
      )
      .subscribe({
        next: res => { this.featuredProducts.set([...res.items]); this.loadingProducts.set(false); },
        error: () => { this.loadingProducts.set(false); },
      });
  }
}
