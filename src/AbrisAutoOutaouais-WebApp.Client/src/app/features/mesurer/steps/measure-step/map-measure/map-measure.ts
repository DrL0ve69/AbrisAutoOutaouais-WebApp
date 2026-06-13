import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Footprint, footprintFromManual } from '../../../util/footprint.util';
import {
  SATELLITE_MAX_ZOOM,
  SATELLITE_TILE_ATTRIBUTION,
  SATELLITE_TILE_URL,
} from '../../../util/tile-provider.const';

/**
 * Carte satellite de mesure (dessin d'un rectangle/polygone sur le stationnement réel).
 *
 * SSR (risque #1) : AUCUN symbole Leaflet/geoman/turf au niveau module — tout est importé
 * DYNAMIQUEMENT à l'intérieur d'`afterNextRender` (jamais exécuté côté serveur), y compris
 * le CSS de Leaflet. Le `<div>` carte est rendu derrière un `@defer (on viewport)` dans le
 * parent, donc ce composant n'est instancié qu'au besoin.
 *
 * Mode POINTER-ONLY assumé : geoman se manipule à la souris/au tactile. L'équivalent CLAVIER
 * est le calculateur de véhicules (étape par défaut) — annoncé via les instructions visibles.
 * `role="application"` + instructions ; axe exclut `.leaflet-container` (internes tiers).
 *
 * Teardown : `map.remove()` au `DestroyRef.onDestroy` (évite la fuite + double init).
 */
@Component({
  selector: 'app-map-measure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-measure.html',
  styleUrl: './map-measure.scss',
})
export class MapMeasureComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Centre initial de la carte (issu du géocodage de l'adresse) ; défaut Gatineau. */
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);

  /** Gabarit déduit du rectangle/polygone dessiné (largeur × longueur en cm). */
  readonly footprintComputed = output<Footprint>();

  protected readonly ready = signal(false);
  /** Vrai quand le dessin obtenu dépasse la plage `[1, 2000]` cm. */
  protected readonly outOfRange = signal(false);

  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  // Type lâche : la lib n'est chargée que côté navigateur (import dynamique).
  private map: unknown = null;

  constructor() {
    afterNextRender(async () => {
      await this.initMap();
    });
    this.destroyRef.onDestroy(() => this.teardown());
  }

  private async initMap(): Promise<void> {
    if (this.map) return; // jamais ré-init

    // CSS Leaflet/geoman chargée À LA DEMANDE : bundle non injecté « leaflet.css »
    // (angular.json) ajouté via un <link> au runtime → reste hors du bundle initial.
    ensureLeafletStyles();

    // Import dynamique de Leaflet (navigateur uniquement) — aucun symbole au top-level (SSR-safe).
    const L = await import('leaflet');

    const center: [number, number] = [this.lat() ?? 45.4765, this.lng() ?? -75.7013];

    // On crée la carte + les tuiles EN PREMIER : `.leaflet-container` apparaît dès que le chunk
    // Leaflet est prêt, INDÉPENDAMMENT de geoman/turf. C'est essentiel pour que la carte soit
    // visible vite ET pour que l'e2e (qui attend `.leaflet-container`) soit déterministe : le
    // chunk geoman (CommonJS, ~360 kB) ne doit pas bloquer l'apparition du conteneur.
    const map = L.map(this.mapHost().nativeElement, {
      center,
      zoom: 19,
      attributionControl: true,
    });

    L.tileLayer(SATELLITE_TILE_URL, {
      maxZoom: SATELLITE_MAX_ZOOM,
      attribution: SATELLITE_TILE_ATTRIBUTION,
    }).addTo(map);

    this.map = map;
    this.ready.set(true);

    // Outils de dessin geoman + mesure turf chargés APRÈS l'affichage de la carte.
    await import('@geoman-io/leaflet-geoman-free'); // effet de bord : attache `pm` à L
    const area = (await import('@turf/area')).default;
    const bbox = (await import('@turf/bbox')).default;

    // Rectangle + polygone uniquement (pas de marqueurs/lignes).
    const pm = (map as unknown as { pm: PmApi }).pm;
    pm.addControls({
      position: 'topright',
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
    });

    // Un seul tracé à la fois : on retire l'ancien quand un nouveau est créé.
    let current: { remove(): void } | null = null;
    (map as unknown as LeafletEvented).on('pm:create', (e: PmCreateEvent) => {
      if (current) current.remove();
      current = e.layer;
      this.handleShape(e.layer.toGeoJSON(), area, bbox);
    });
  }

  /** Calcule largeur/longueur (cm) depuis le rectangle dessiné via turf area+bbox. */
  private handleShape(
    geojson: TurfArea extends (g: infer G) => number ? G : never,
    area: TurfArea,
    bbox: TurfBbox,
  ): void {
    const [minX, minY, maxX, maxY] = bbox(geojson);
    // Largeur/longueur de la boîte englobante en mètres (approximation locale planaire).
    const midLat = (minY + maxY) / 2;
    const metersPerDegLat = 111_320;
    const metersPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180);
    const widthM = (maxX - minX) * metersPerDegLng;
    const heightM = (maxY - minY) * metersPerDegLat;
    // `area` (m²) sert de garde-fou : un tracé dégénéré donne une aire ~0.
    if (area(geojson) < 1) {
      this.outOfRange.set(true);
      return;
    }
    const footprint = footprintFromManual(
      Math.round(widthM * 100),
      Math.round(heightM * 100),
    );
    if (footprint.outOfRange) {
      this.outOfRange.set(true);
      return;
    }
    this.outOfRange.set(false);
    this.footprintComputed.emit(footprint);
  }

  private teardown(): void {
    const map = this.map as { remove?: () => void } | null;
    map?.remove?.();
    this.map = null;
  }
}

/**
 * Ajoute une fois le `<link rel="stylesheet" href="leaflet.css">` (bundle non injecté). Appelée
 * UNIQUEMENT côté navigateur (depuis `afterNextRender`), donc l'accès à `document` est sûr.
 */
function ensureLeafletStyles(): void {
  const id = 'leaflet-bundle-styles';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'leaflet.css';
  document.head.appendChild(link);
}

// ── Types minimaux pour les API geoman/leaflet utilisées (lib non typée en strict). ──
type TurfArea = typeof import('@turf/area').default;
type TurfBbox = typeof import('@turf/bbox').default;
/** GeoJSON accepté par turf (déduit de la signature d'`area`). */
type TurfGeoJson = TurfArea extends (g: infer G) => number ? G : never;

interface PmApi {
  addControls(options: Record<string, unknown>): void;
}
interface LeafletEvented {
  on(type: string, handler: (e: PmCreateEvent) => void): void;
}
interface PmCreateEvent {
  layer: { toGeoJSON(): TurfGeoJson; remove(): void };
}
