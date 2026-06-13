import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MotionService } from '../../../core/services/motion.service';
import { isWebglAvailable } from './webgl.util';
import {
  buildShelterDescriptor,
  descriptorToGroup,
  type ThreeNamespace,
} from './shelter-model.builder';

/**
 * Viewer 3D d'un abri Tempo paramétré par ses dimensions (E4, Redesign v2).
 *
 * SSR + bundle (contrainte E5) : AUCUN symbole `three` au niveau module. La lib ET OrbitControls
 * sont importés DYNAMIQUEMENT dans `afterNextRender` (jamais exécuté côté serveur), derrière une
 * double garde `isPlatformBrowser` + `isWebglAvailable`. Le calcul géométrique passe par
 * `buildShelterDescriptor` (pur, sans three) ; la conversion en meshes reçoit le namespace en
 * paramètre. Modèle calqué sur `features/mesurer/.../map-measure.ts` (lib lourde browser-only).
 *
 * Accessibilité (barre dure WCAG 2.2 AA) : le `<canvas>` est purement visuel (`role="img"` +
 * `aria-label` incluant le nom du produit, AUCUN rôle interactif). La commande clavier passe par
 * une barre de vrais `<button>` (rotation, zoom, reset), cibles ≥ 44 px, focus visible. La souris
 * et le tactile sont gérés par OrbitControls. Repli : si pas de WebGL / SSR → `<img>` statique.
 *
 * Mouvement réduit : pas d'auto-rotation, et rendu À LA DEMANDE (aucune boucle RAF continue hors
 * interaction) pour ne pas chauffer le GPU inutilement.
 *
 * Teardown (`DestroyRef`) : `dispose()` + `forceContextLoss()`, libération des
 * géométries/matériaux, `cancelAnimationFrame`, retrait des écouteurs → pas de fuite de contexte.
 */
@Component({
  selector: 'app-shelter-3d-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shelter-3d-viewer.html',
  styleUrl: './shelter-3d-viewer.scss',
})
export class Shelter3dViewerComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly motionService = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly widthCm = input.required<number>();
  readonly lengthCm = input.required<number>();
  readonly heightCm = input.required<number>();
  /** Couleur de la toile — défaut blanc cassé (cohérent avec les abris Tempo). */
  readonly color = input<string>('#f5f3ee');
  /** Image de repli affichée tant que la 3D n'est pas dispo (SSR, pas de WebGL). */
  readonly fallbackImageSrc = input.required<string>();
  readonly productName = input.required<string>();

  private readonly canvasHost =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvasHost');

  /** Vrai une fois la scène 3D montée ; faux → on garde le repli `<img>`. */
  protected readonly ready = signal(false);
  /** Vrai si la 3D est indisponible (SSR / pas de WebGL) → repli définitif. */
  protected readonly unsupported = signal(false);

  /** Libellé accessible du canvas (role=img), inclut le nom du produit. */
  protected readonly canvasLabel = computed(() =>
    $localize`:@@shelter3d.canvasLabel:Modèle 3D interactif de ${this.productName()}:name:`,
  );

  // Références three (typées via le namespace importé dynamiquement, pas d'import top-level).
  private renderer: import('three').WebGLRenderer | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').PerspectiveCamera | null = null;
  private controls: { update(): void; dispose(): void } | null = null;
  private group: import('three').Group | null = null;
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      void this.init();
    });
    this.destroyRef.onDestroy(() => this.teardown());
  }

  private async init(): Promise<void> {
    const host = this.canvasHost().nativeElement;
    if (!this.isBrowser || !isWebglAvailable(host.ownerDocument)) {
      this.unsupported.set(true);
      return;
    }

    // Imports dynamiques : `three` + OrbitControls (chunk LAZY, hors bundle initial).
    const THREE = (await import('three')) as ThreeNamespace;
    const { OrbitControls } = await import(
      'three/examples/jsm/controls/OrbitControls.js'
    );

    const descriptor = buildShelterDescriptor(
      {
        widthCm: this.widthCm(),
        lengthCm: this.lengthCm(),
        heightCm: this.heightCm(),
      },
      { clothColor: this.color() },
    );

    const renderer = new THREE.WebGLRenderer({
      canvas: host,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.sizeRendererToHost(renderer, host);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, this.hostAspect(host), 0.1, 100);
    const dist = descriptor.bounds.radius * 2.6;
    camera.position.set(dist * 0.8, dist * 0.55, dist);
    camera.lookAt(0, descriptor.bounds.height / 2, 0);

    // Éclairage simple (ambiant + directionnel) pour rendre les volumes lisibles.
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(1, 2, 1.5);
    scene.add(dir);

    const group = descriptorToGroup(descriptor, THREE);
    group.position.y = 0; // demi-ellipse posée au sol (y = 0 → faîte vers le haut)
    scene.add(group);

    const controls = new OrbitControls(camera, host);
    controls.enableDamping = false;
    controls.target.set(0, descriptor.bounds.height / 2, 0);
    // Auto-rotation UNIQUEMENT hors mouvement réduit.
    const reduced = this.motionService.prefersReducedMotion();
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 1.0;
    // Rendu à la demande : chaque changement de contrôle → un rendu (pas de RAF continu inutile).
    controls.addEventListener('change', this.requestRenderBound);
    controls.update();

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.group = group;

    // Redimensionnement → re-cadre + re-rend.
    this.resizeObserver = new ResizeObserver(() => {
      this.sizeRendererToHost(renderer, host);
      camera.aspect = this.hostAspect(host);
      camera.updateProjectionMatrix();
      this.requestRender();
    });
    this.resizeObserver.observe(host);

    this.ready.set(true);

    if (reduced) {
      // Mouvement réduit : un seul rendu statique, aucune boucle d'animation.
      this.requestRender();
    } else {
      // Auto-rotation : boucle RAF tant qu'elle est active.
      this.animate();
    }
  }

  /** Boucle d'animation (uniquement pour l'auto-rotation, hors mouvement réduit). */
  private animate = (): void => {
    if (!this.controls?.update || !this.renderer) {
      return;
    }
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderScene();
  };

  /** Rendu unique à la demande (drag manuel, redimensionnement, commande clavier). */
  private requestRender(): void {
    // En mode auto-rotation, le RAF rend déjà chaque frame ; un rendu ponctuel suffit sinon.
    if (this.frameId === null) {
      this.renderScene();
    }
  }
  private readonly requestRenderBound = (): void => this.requestRender();

  private renderScene(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ── Commandes clavier (vrais boutons) : appliquent un delta caméra puis re-rendent. ──

  /** Fait pivoter la caméra autour de la cible (azimut), `direction` = -1 gauche / +1 droite. */
  protected rotate(direction: -1 | 1): void {
    const camera = this.camera;
    if (!camera) {
      return;
    }
    const angle = direction * (Math.PI / 12); // 15°
    const target = this.controlsTarget();
    const dx = camera.position.x - target.x;
    const dz = camera.position.z - target.z;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    camera.position.x = target.x + dx * cos - dz * sin;
    camera.position.z = target.z + dx * sin + dz * cos;
    camera.lookAt(target.x, target.y, target.z);
    this.controls?.update();
    this.requestRender();
  }

  /** Zoom avant (+1) ou arrière (-1) en rapprochant/éloignant la caméra de la cible. */
  protected zoom(direction: -1 | 1): void {
    const camera = this.camera;
    if (!camera) {
      return;
    }
    const factor = direction === 1 ? 0.85 : 1.18;
    const target = this.controlsTarget();
    camera.position.x = target.x + (camera.position.x - target.x) * factor;
    camera.position.y = target.y + (camera.position.y - target.y) * factor;
    camera.position.z = target.z + (camera.position.z - target.z) * factor;
    this.controls?.update();
    this.requestRender();
  }

  /** Réinitialise la vue (recharge la scène depuis le descripteur n'est pas nécessaire : reset cam). */
  protected reset(): void {
    const camera = this.camera;
    if (!camera || !this.group) {
      return;
    }
    const target = this.controlsTarget();
    const dist = target.y * 2 + 5;
    camera.position.set(dist * 0.8, dist * 0.55, dist);
    camera.lookAt(target.x, target.y, target.z);
    this.controls?.update();
    this.requestRender();
  }

  private controlsTarget(): { x: number; y: number; z: number } {
    const t = (this.controls as unknown as { target?: { x: number; y: number; z: number } })
      ?.target;
    return t ?? { x: 0, y: 0, z: 0 };
  }

  private hostAspect(host: HTMLCanvasElement): number {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    return w / h;
  }

  private sizeRendererToHost(
    renderer: import('three').WebGLRenderer,
    host: HTMLCanvasElement,
  ): void {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
  }

  private teardown(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.controls?.dispose();
    this.controls = null;

    // Libère géométries + matériaux pour éviter une fuite mémoire GPU.
    this.group?.traverse((obj: unknown) => {
      const mesh = obj as {
        geometry?: { dispose?: () => void };
        material?: { dispose?: () => void } | { dispose?: () => void }[];
      };
      mesh.geometry?.dispose?.();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach(m => m.dispose?.());
      } else {
        mat?.dispose?.();
      }
    });
    this.group = null;
    this.scene = null;
    this.camera = null;

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer = null;
    }
  }
}
