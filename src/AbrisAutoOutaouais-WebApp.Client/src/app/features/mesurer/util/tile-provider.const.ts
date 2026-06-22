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

/**
 * Niveau de zoom NATIF maximal de l'imagerie Esri « World Imagery » : au-delà, les tuiles
 * n'existent pas sur le serveur. C'est la borne à passer à Leaflet en `maxNativeZoom`.
 */
export const SATELLITE_MAX_NATIVE_ZOOM = 19;

/**
 * Zoom maximal autorisé sur la carte (over-zoom). Au-delà du natif (`SATELLITE_MAX_NATIVE_ZOOM`),
 * Leaflet AGRANDIT les dernières tuiles natives au lieu d'en demander de nouvelles : on gagne en
 * détail apparent pour tracer plus finement un petit stationnement, au prix d'un léger flou.
 * Gratuit et sans clé (aucune requête supplémentaire vers Esri). US-14.1.
 */
export const SATELLITE_MAX_ZOOM = 21;
