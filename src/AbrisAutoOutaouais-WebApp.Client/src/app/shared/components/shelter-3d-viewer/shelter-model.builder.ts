/**
 * Construction du modèle 3D d'un abri Tempo — EN DEUX NIVEAUX (E4, Redesign v2).
 *
 * Pourquoi deux niveaux : tout le calcul géométrique (positions, rayons, espacement des baies,
 * cadrage caméra) est isolé dans `buildShelterDescriptor`, une fonction **100 % PURE et SANS
 * AUCUN import de `three`**. Elle est donc testable de façon déterministe en vitest, sans WebGL.
 * La conversion descripteur → meshes (`descriptorToGroup`) reçoit le namespace `three` **en
 * paramètre** (jamais d'`import 'three'` en tête de fichier) : ainsi ce module ne fait jamais
 * fuiter `three` dans le bundle initial — c'est la contrainte E5 (lazy-only).
 *
 * Modèle : abri « tunnel » Tempo = une série d'arcs transversaux (demi-ellipse) répartis sur la
 * longueur, reliés par des pannes longitudinales, recouverts d'une toile cintrée.
 */

/** Dimensions hors-tout d'un abri, en centimètres. */
export interface ShelterDimensionsCm {
  readonly widthCm: number;
  readonly lengthCm: number;
  readonly heightCm: number;
}

/** Options de construction du descripteur (valeurs par défaut appliquées dans la fonction). */
export interface ShelterBuildOptions {
  /** Échelle cm → unités de scène (1 unité = `1/unitDivisor` cm). Défaut : 100 (1 unité = 1 m). */
  readonly unitDivisor?: number;
  /** Espacement cible entre deux arcs, en cm. Défaut : 120 cm. */
  readonly baySpacingCm?: number;
  /** Couleur de la toile (hex CSS). Défaut : blanc cassé. */
  readonly clothColor?: string;
}

/** Un arc transversal (demi-ellipse) à une position z donnée le long de la longueur. */
export interface ArcSpec {
  /** Position le long de la longueur, en unités de scène (z ∈ [-L/2, +L/2]). */
  readonly z: number;
  /** Demi-largeur de l'ellipse (= moitié de la largeur de l'abri), en unités. */
  readonly radiusX: number;
  /** Hauteur de l'ellipse (= hauteur de l'abri), en unités. */
  readonly radiusY: number;
  /** Rayon du tube de l'arc (épaisseur de la structure), en unités. */
  readonly tubeRadius: number;
}

/** Une panne longitudinale reliant les arcs, à un angle donné sur l'ellipse. */
export interface PurlinSpec {
  /** Angle sur la demi-ellipse, en radians (0 = côté, π/2 = faîte). */
  readonly angle: number;
  /** Position x du faîtage/panne, en unités. */
  readonly x: number;
  /** Hauteur y de la panne, en unités. */
  readonly y: number;
  /** Longueur (= longueur de l'abri), en unités. */
  readonly length: number;
  /** Rayon du tube, en unités. */
  readonly tubeRadius: number;
}

/** La toile cintrée recouvrant la structure (demi-cylindre elliptique). */
export interface ClothSpec {
  readonly radiusX: number;
  readonly radiusY: number;
  /** Étendue le long de la longueur, en unités. */
  readonly length: number;
  readonly color: string;
}

/** Boîte englobante (en unités de scène) pour cadrer la caméra. */
export interface SceneBounds {
  readonly width: number;
  readonly height: number;
  readonly length: number;
  /** Rayon de la sphère englobante (sert à positionner la caméra). */
  readonly radius: number;
}

/** Descripteur complet, purement numérique, prêt à être converti en meshes `three`. */
export interface ShelterDescriptor {
  readonly unitScale: number;
  readonly arcs: readonly ArcSpec[];
  readonly purlins: readonly PurlinSpec[];
  readonly cloth: ClothSpec;
  readonly bounds: SceneBounds;
}

const DEFAULT_UNIT_DIVISOR = 100;
const DEFAULT_BAY_SPACING_CM = 120;
const DEFAULT_CLOTH_COLOR = '#f5f3ee';
/** Épaisseur de la structure tubulaire, en unités (≈ 4 cm de diamètre apparent). */
const TUBE_RADIUS = 0.02;
/** Angles (sur la demi-ellipse) où poser des pannes longitudinales : côtés + épaules + faîte. */
const PURLIN_ANGLES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI];

/**
 * Construit le descripteur géométrique d'un abri — FONCTION PURE, aucun import `three`.
 *
 * Dimensions dégénérées (0 ou négatives) : on plancher à 1 cm pour éviter rayons/échelles nuls et
 * une division par zéro sur l'espacement des baies ; le descripteur reste cohérent (≥ 1 arc).
 */
export function buildShelterDescriptor(
  dims: ShelterDimensionsCm,
  opts: ShelterBuildOptions = {},
): ShelterDescriptor {
  const unitDivisor = opts.unitDivisor ?? DEFAULT_UNIT_DIVISOR;
  const baySpacingCm = opts.baySpacingCm ?? DEFAULT_BAY_SPACING_CM;
  const clothColor = opts.clothColor ?? DEFAULT_CLOTH_COLOR;

  const unitScale = 1 / unitDivisor;

  // Plancher anti-dégénérescence : aucune dimension ne descend sous 1 cm.
  const widthCm = Math.max(dims.widthCm, 1);
  const lengthCm = Math.max(dims.lengthCm, 1);
  const heightCm = Math.max(dims.heightCm, 1);

  // Demi-ellipse : largeur de l'abri = grand axe horizontal (donc radiusX = moitié), hauteur de
  // l'abri = hauteur de l'ellipse (radiusY = hauteur pleine, la demi-ellipse monte de 0 à hauteur).
  const radiusX = (widthCm / 2) * unitScale;
  const radiusY = heightCm * unitScale;
  const length = lengthCm * unitScale;

  // Nombre d'arcs = ceil(longueur / espacement) baies, soit baies+1 arcs, ≥ 2 pour fermer la travée.
  const bays = Math.max(1, Math.ceil(lengthCm / baySpacingCm));
  const arcCount = bays + 1;

  // Répartition SYMÉTRIQUE des arcs sur z ∈ [-L/2, +L/2].
  const halfLength = length / 2;
  const arcs: ArcSpec[] = [];
  for (let i = 0; i < arcCount; i++) {
    const t = arcCount === 1 ? 0.5 : i / (arcCount - 1); // 0..1
    const z = -halfLength + t * length;
    arcs.push({ z, radiusX, radiusY, tubeRadius: TUBE_RADIUS });
  }

  // Pannes longitudinales à quelques angles sur la demi-ellipse (du côté gauche au côté droit).
  const purlins: PurlinSpec[] = PURLIN_ANGLES.map(angle => ({
    angle,
    x: radiusX * Math.cos(angle),
    y: radiusY * Math.sin(angle),
    length,
    tubeRadius: TUBE_RADIUS,
  }));

  const cloth: ClothSpec = { radiusX, radiusY, length, color: clothColor };

  const bounds: SceneBounds = {
    width: radiusX * 2,
    height: radiusY,
    length,
    // Rayon englobant : demi-diagonale de la boîte (largeur, hauteur, longueur).
    radius:
      0.5 *
      Math.hypot(radiusX * 2, radiusY, length),
  };

  return { unitScale, arcs, purlins, cloth, bounds };
}

// ── Niveau 2 : conversion en meshes. `three` est passé EN PARAMÈTRE (jamais importé ici). ──

/** Sous-ensemble minimal du namespace `three` requis par `descriptorToGroup`. */
export type ThreeNamespace = typeof import('three');

/**
 * Convertit un descripteur en `THREE.Group` de meshes. Reçoit le namespace `three` en paramètre :
 * AUCUN `import 'three'` au top-level → ce module reste hors du bundle initial (contrainte E5).
 * JAMAIS appelée dans les specs (nécessiterait WebGL).
 */
export function descriptorToGroup(
  descriptor: ShelterDescriptor,
  THREE: ThreeNamespace,
): import('three').Group {
  const group = new THREE.Group();

  const structureMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a4453,
    metalness: 0.6,
    roughness: 0.4,
  });

  // Arcs transversaux : demi-tube suivant une EllipseCurve (0 → π = demi-ellipse supérieure).
  for (const arc of descriptor.arcs) {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      arc.radiusX,
      arc.radiusY,
      0,
      Math.PI,
      false,
      0,
    );
    const points3d = curve
      .getPoints(48)
      .map(p => new THREE.Vector3(p.x, p.y, 0));
    const path = new THREE.CatmullRomCurve3(points3d);
    const tube = new THREE.TubeGeometry(path, 48, arc.tubeRadius, 8, false);
    const mesh = new THREE.Mesh(tube, structureMaterial);
    mesh.position.z = arc.z;
    group.add(mesh);
  }

  // Pannes longitudinales : cylindres orientés selon z.
  for (const purlin of descriptor.purlins) {
    const cyl = new THREE.CylinderGeometry(
      purlin.tubeRadius,
      purlin.tubeRadius,
      purlin.length,
      8,
    );
    const mesh = new THREE.Mesh(cyl, structureMaterial);
    mesh.rotation.x = Math.PI / 2; // axe Y → axe Z
    mesh.position.set(purlin.x, purlin.y, 0);
    group.add(mesh);
  }

  // Toile : demi-cylindre elliptique (extrusion de la demi-ellipse le long de z).
  const shape = new THREE.Shape();
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI;
    const x = descriptor.cloth.radiusX * Math.cos(angle);
    const y = descriptor.cloth.radiusY * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  const clothGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: descriptor.cloth.length,
    bevelEnabled: false,
    steps: 1,
  });
  clothGeometry.translate(0, 0, -descriptor.cloth.length / 2);
  const clothMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(descriptor.cloth.color),
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });
  group.add(new THREE.Mesh(clothGeometry, clothMaterial));

  return group;
}
