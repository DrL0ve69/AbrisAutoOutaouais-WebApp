/**
 * Fournisseur de tuiles satellite pour la carte de mesure (`map-measure`).
 *
 * Source UNIQUE : pour changer de fournisseur (ex. Maxar, Bing), ne modifier qu'ici.
 * Esri « World Imagery » est utilisable sans clé d'API pour un usage léger ; l'attribution
 * DOIT rester affichée (control attribution Leaflet activé) — exigence de la licence Esri.
 */
export const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const SATELLITE_TILE_ATTRIBUTION =
  'Tuiles &copy; Esri — Source : Esri, Maxar, Earthstar Geographics, et la communauté SIG';

/** Zoom maximal raisonnable pour l'imagerie Esri (au-delà, tuiles absentes/floues). */
export const SATELLITE_MAX_ZOOM = 19;
