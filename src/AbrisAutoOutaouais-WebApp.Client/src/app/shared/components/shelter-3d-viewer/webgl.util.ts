/**
 * Détection WebGL pure et SSR-safe (E4, Redesign v2).
 *
 * Utilisée par `Shelter3dViewerComponent` AVANT tout import dynamique de `three` : si le
 * navigateur (ou l'environnement) ne fournit pas de contexte WebGL, on bascule sur le repli
 * statique `<img>` sans jamais charger la lib lourde.
 *
 * SSR-safe : aucun symbole `three` ici ; quand `document` est absent (rendu serveur), on renvoie
 * `false` (le serveur n'a pas de GPU et n'instancie jamais le viewer). On essaie réellement de
 * créer un contexte plutôt que de se fier à `'WebGLRenderingContext' in window` — certains
 * navigateurs exposent le constructeur mais refusent le contexte (GPU blacklisté).
 *
 * @param doc Document à sonder. Si l'argument est OMIS, on prend le `document` global s'il existe.
 *   Passer explicitement `undefined`/`null` force le cas « pas de document » (rendu serveur).
 */
export function isWebglAvailable(...args: [doc?: Document | null]): boolean {
  // On distingue « argument omis » (→ document global) de « undefined passé » (→ pas de document).
  const doc =
    args.length === 0
      ? typeof document !== 'undefined'
        ? document
        : undefined
      : args[0];
  if (!doc) {
    return false;
  }
  try {
    const canvas = doc.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    return gl !== null && gl !== undefined;
  } catch {
    // SecurityError / contexte refusé / API absente → repli statique.
    return false;
  }
}
