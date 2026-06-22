import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Footprint, footprintFromManual } from '../../../util/footprint.util';
import { rectDimensionsFromPolygon } from '../../../util/measure-rect.util';
import { SERVICE_BASE } from '../../../util/service-area.util';
import {
  SATELLITE_MAX_NATIVE_ZOOM,
  SATELLITE_MAX_ZOOM,
  SATELLITE_TILE_ATTRIBUTION,
  SATELLITE_TILE_URL,
} from '../../../util/tile-provider.const';

/**
 * Carte satellite de mesure (dessin d'un rectangle/polygone sur le stationnement réel).
 *
 * SSR (risque #1) : AUCUN symbole Leaflet/geoman/turf au niveau module — tout est importé
 * DYNAMIQUEMENT à l'intérieur d'`afterNextRender` (jamais exécuté côté serveur), y compris
 * le CSS de Leaflet. Le `<div>` carte est rendu derrière un `@defer (on immediate)` dans le
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

  /** Centre initial de la carte (issu du géocodage de l'adresse) ; repli `SERVICE_BASE` (Gatineau). */
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);

  /** Gabarit déduit du rectangle/polygone dessiné (largeur × longueur en cm). */
  readonly footprintComputed = output<Footprint>();

  protected readonly ready = signal(false);
  /** Vrai quand le dessin obtenu dépasse la plage `[1, 2000]` cm. */
  protected readonly outOfRange = signal(false);

  /**
   * Vrai quand l'adresse n'a PAS été localisée (saisie manuelle sans choix d'une
   * suggestion) : `lat`/`lng` sont `null` et la carte retombe sur Gatineau par défaut
   * (voir `center` dans `initMap`). On affiche alors un indice persistant pour éviter
   * que l'utilisateur mesure silencieusement le mauvais emplacement.
   */
  protected readonly notLocated = computed(
    () => this.lat() === null || this.lng() === null,
  );

  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  // Type lâche : la lib n'est chargée que côté navigateur (import dynamique).
  private map: unknown = null;

  // G3a — observe le conteneur carte : tout redimensionnement (rotation, panneau latéral,
  // breakout responsive) doit rappeler `invalidateSize()`, sinon Leaflet garde des tuiles grises.
  // Déconnecté au `DestroyRef` (cf. `teardown`). `null` tant que la carte n'est pas montée / hors
  // navigateur (créé seulement dans `initMap`, exécuté depuis `afterNextRender`, donc SSR-safe).
  private resizeObserver: ResizeObserver | null = null;
  /** rAF en vol pour le debounce du resize (annulé au teardown). */
  private resizeRaf = 0;

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
    // Normalisation du namespace : selon le bundler (vite en dev vs esbuild en build/CI), l'API
    // Leaflet est exposée soit sur le namespace, soit sous `.default`. On normalise pour éviter le
    // « TypeError: L.map is not a function » déjà corrigé.
    const leafletNs = await import('leaflet');
    const L = leafletNs.default ?? leafletNs;

    // geoman (free) est un IIFE qui lit `L` comme variable LIBRE → `globalThis.L`. Il n'importe
    // PAS Leaflet (0 require/import, 463 réfs `L.`). On expose donc l'instance dynamiquement
    // importée AVANT de charger geoman, sinon geoman patche un `L` absent.
    // Surtout : geoman attache `map.pm` via un INIT HOOK posé sur `L.Map` — ce hook ne s'exécute
    // QUE pour les cartes construites APRÈS le chargement de geoman. Il faut donc importer geoman
    // AVANT `L.map(...)`, faute de quoi notre carte est créée sans `pm` (barre de dessin absente,
    // bien que `L.PM` existe globalement). Reste dans `afterNextRender` = navigateur uniquement,
    // donc SSR-safe. On NE supprime PAS `globalThis.L` au teardown (casserait une 2e carte). (F2-D / L-019)
    (globalThis as { L?: unknown }).L = L;
    await import('@geoman-io/leaflet-geoman-free'); // effet de bord : pose l'init hook `pm` sur L.Map

    // Coordonnées réelles de l'adresse géocodée (D4). Repli sur la base de service (Gatineau) —
    // `SERVICE_BASE`, miroir de la const serveur (motion-a11y §2 : pas de littéral en dur). Quand
    // l'adresse est localisée, on cadre serré (zoom stationnement) ; sinon vue régionale par défaut.
    const lat = this.lat();
    const lng = this.lng();
    const located = lat !== null && lng !== null;
    const center: [number, number] = located ? [lat, lng] : [SERVICE_BASE.lat, SERVICE_BASE.lng];

    // Création de la carte APRÈS geoman → l'init hook attache `map.pm` à la construction.
    // US-14.1 — over-zoom : cadrage localisé poussé au zoom max (21). Au-delà du natif Esri (19),
    // Leaflet agrandit les dernières tuiles → plus de détail pour tracer un petit stationnement.
    const map = L.map(this.mapHost().nativeElement, {
      center,
      zoom: located ? 21 : 19,
      attributionControl: true,
    });

    // `maxNativeZoom` = dernier niveau réellement servi par Esri ; `maxZoom` autorise l'over-zoom
    // au-delà (agrandissement des tuiles natives, gratuit/keyless — aucune requête en plus). US-14.1.
    L.tileLayer(SATELLITE_TILE_URL, {
      maxZoom: SATELLITE_MAX_ZOOM,
      maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM,
      attribution: SATELLITE_TILE_ATTRIBUTION,
    }).addTo(map);

    this.map = map;
    this.ready.set(true);

    // D4 — recalcul de la taille du conteneur : monté en `@defer`, le `<div>` peut avoir une taille
    // nulle/instable au 1er rendu → tuiles grises. `invalidateSize()` force Leaflet à relire ses
    // dimensions une fois le conteneur peint (le centrage « stationnement » est déjà posé par
    // `center`/`zoom` à la construction). Reste dans `afterNextRender` (navigateur), donc SSR-safe.
    (map as unknown as { invalidateSize(animate?: boolean): void }).invalidateSize(false);

    // G3a — ResizeObserver : la zone de dessin est large et responsive (breakout + clamp hauteur).
    // À chaque changement de taille du conteneur, on rappelle `invalidateSize()` (debounce 1 frame
    // via rAF) pour que Leaflet relise ses dimensions → pas de tuiles grises. SSR-safe (`ResizeObserver`
    // n'existe que côté navigateur, et ce code n'est atteint que depuis `afterNextRender`).
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(this.resizeRaf);
        this.resizeRaf = requestAnimationFrame(() => {
          (this.map as { invalidateSize?(animate?: boolean): void } | null)?.invalidateSize?.(false);
        });
      });
      this.resizeObserver.observe(this.mapHost().nativeElement);
    }

    // Mesure turf chargée à la demande (calcul d'aire/bbox du tracé).
    const area = (await import('@turf/area')).default;
    const bbox = (await import('@turf/bbox')).default;

    // Rectangle + polygone uniquement (pas de marqueurs/lignes).
    // `map.pm` est posé par l'init hook geoman (cf. plus haut). S'il est absent (environnement de
    // test sans le vrai conteneur / DOM, ou `globalThis.L` introuvable au chargement de geoman), on
    // s'arrête là sans planter l'init : la carte satellite reste affichée, seuls les outils de
    // dessin manquent. (garde défensive — L-019)
    const pm = (map as unknown as { pm?: PmApi }).pm;
    if (!pm) return;
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

  /**
   * Calcule largeur/longueur (cm) depuis le tracé dessiné.
   *
   * L-034 — on mesure D'ABORD par arête (`rectDimensionsFromPolygon`) : la bbox alignée aux axes
   * SUR-ESTIME un rectangle pivoté (un 3×6 m à 45° y lit ~6,4×6,4 → abri trop grand). Pour un vrai
   * quadrilatère (4 sommets), la mesure great-circle des côtés opposés est invariante à
   * l'orientation. Si le tracé n'est PAS un rectangle (polygone libre, triangle…), on conserve le
   * calcul bbox comme repli.
   */
  private handleShape(
    geojson: TurfArea extends (g: infer G) => number ? G : never,
    area: TurfArea,
    bbox: TurfBbox,
  ): void {
    // `area` (m²) sert de garde-fou : un tracé dégénéré donne une aire ~0.
    if (area(geojson) < 1) {
      this.outOfRange.set(true);
      return;
    }

    // Mesure exacte par arête pour un rectangle (invariante à l'orientation — L-034).
    const rect = rectDimensionsFromPolygon(geojson);
    let widthM: number;
    let heightM: number;
    if (rect !== null) {
      widthM = rect.widthM;
      heightM = rect.lengthM;
    } else {
      // Repli : boîte englobante alignée aux axes (polygone libre / non rectangulaire).
      const [minX, minY, maxX, maxY] = bbox(geojson);
      const midLat = (minY + maxY) / 2;
      const metersPerDegLat = 111_320;
      const metersPerDegLng = 111_320 * Math.cos((midLat * Math.PI) / 180);
      widthM = (maxX - minX) * metersPerDegLng;
      heightM = (maxY - minY) * metersPerDegLat;
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
    // G3a — déconnecter l'observer + annuler le rAF en vol avant de détruire la carte.
    cancelAnimationFrame(this.resizeRaf);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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
