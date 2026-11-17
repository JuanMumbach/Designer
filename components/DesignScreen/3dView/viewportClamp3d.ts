import { calculateScaleFactor } from '@react-three/drei/native';
import { Size } from '@react-three/fiber';
import * as THREE from 'three';

export interface ScreenSize2D {
  width: number;
  height: number;
}

export interface ViewportMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ClampedScreenLayoutInput {
  anchorPx: { x: number; y: number };
  baseSizePx: ScreenSize2D;
  viewport: ScreenSize2D;
  margins: ViewportMargins;
  gapPx?: number;
  preferAbove?: boolean;
  minFitFactor?: number;
}

export interface ClampedScreenLayoutResult {
  centerX: number;
  centerY: number;
  fitFactor: number;
  widthPx: number;
  heightPx: number;
}

export interface ResolveClampedWorldTransformInput {
  localAnchor: [number, number, number];
  parentMatrixWorld: THREE.Matrix4;
  camera: THREE.Camera;
  viewport: Size;
  baseSizePx: ScreenSize2D;
  basePxPerUnit: number;
  margins?: ViewportMargins;
  gapPx?: number;
  preferAbove?: boolean;
  minFitFactor?: number;
  outLocalPosition?: THREE.Vector3;
}

export interface ClampedWorldTransformResult {
  localPosition: THREE.Vector3;
  scalarScale: number;
  layout: ClampedScreenLayoutResult;
}

const DEFAULT_HORIZONTAL_MARGIN = 12;
const DEFAULT_TOP_MARGIN = 32;
const DEFAULT_BOTTOM_MARGIN = 84;
const COMPACT_HEIGHT_THRESHOLD = 420;

const scratchWorldAnchor = new THREE.Vector3();
const scratchViewPos = new THREE.Vector3();
const scratchProjected = new THREE.Vector3();
const scratchClampedWorld = new THREE.Vector3();
const scratchParentInverse = new THREE.Matrix4();

export function computeResponsiveMargins(viewport: ScreenSize2D): ViewportMargins {
  const horizontal = Math.min(
    DEFAULT_HORIZONTAL_MARGIN,
    Math.max(4, Math.floor(viewport.width * 0.05))
  );

  if (viewport.height > COMPACT_HEIGHT_THRESHOLD) {
    return {
      top: DEFAULT_TOP_MARGIN,
      right: horizontal,
      bottom: DEFAULT_BOTTOM_MARGIN,
      left: horizontal,
    };
  }

  const vertical = Math.min(
    DEFAULT_HORIZONTAL_MARGIN,
    Math.max(4, Math.floor(viewport.height * 0.05))
  );

  return {
    top: vertical,
    right: horizontal,
    bottom: vertical,
    left: horizontal,
  };
}

export function computeClampedMenuScreenLayout({
  anchorPx,
  baseSizePx,
  viewport,
  margins,
  gapPx = 0,
  preferAbove = false,
  minFitFactor = 0.2,
}: ClampedScreenLayoutInput): ClampedScreenLayoutResult {
  if (
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    baseSizePx.width <= 0 ||
    baseSizePx.height <= 0
  ) {
    return {
      centerX: anchorPx.x,
      centerY: anchorPx.y,
      fitFactor: 1,
      widthPx: baseSizePx.width,
      heightPx: baseSizePx.height,
    };
  }

  const availW = Math.max(1, viewport.width - margins.left - margins.right);
  const availH = Math.max(1, viewport.height - margins.top - margins.bottom);
  const rawFit = Math.min(1, availW / baseSizePx.width, availH / baseSizePx.height);
  const fitFactor = Math.max(minFitFactor, Math.min(1, rawFit));

  const widthPx = baseSizePx.width * fitFactor;
  const heightPx = baseSizePx.height * fitFactor;
  const halfW = widthPx / 2;
  const halfH = heightPx / 2;
  const scaledGap = gapPx * fitFactor;

  const rawCenterY = preferAbove ? anchorPx.y - scaledGap - halfH : anchorPx.y;

  const minX = margins.left + halfW;
  const maxX = viewport.width - margins.right - halfW;
  const centerX =
    minX <= maxX
      ? Math.min(maxX, Math.max(minX, anchorPx.x))
      : viewport.width / 2;

  const minY = margins.top + halfH;
  const maxY = viewport.height - margins.bottom - halfH;
  const centerY =
    minY <= maxY
      ? Math.min(maxY, Math.max(minY, rawCenterY))
      : viewport.height / 2;

  return {
    centerX,
    centerY,
    fitFactor,
    widthPx,
    heightPx,
  };
}

export function resolveClampedWorldTransform({
  localAnchor,
  parentMatrixWorld,
  camera,
  viewport,
  baseSizePx,
  basePxPerUnit,
  margins,
  gapPx = 0,
  preferAbove = false,
  minFitFactor = 0.2,
  outLocalPosition,
}: ResolveClampedWorldTransformInput): ClampedWorldTransformResult {
  const effectiveMargins = margins ?? computeResponsiveMargins(viewport);

  camera.updateMatrixWorld(false);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  scratchWorldAnchor.set(localAnchor[0], localAnchor[1], localAnchor[2]);
  scratchWorldAnchor.applyMatrix4(parentMatrixWorld);

  scratchViewPos.copy(scratchWorldAnchor).applyMatrix4(camera.matrixWorldInverse);
  const cameraNear = 'near' in camera && typeof camera.near === 'number' ? camera.near : 0.1;
  const minFrontDepth = Math.max(0.1, cameraNear + 0.1);
  if (scratchViewPos.z > -minFrontDepth) {
    scratchViewPos.z = -minFrontDepth;
    scratchWorldAnchor.copy(scratchViewPos).applyMatrix4(camera.matrixWorld);
  }

  scratchProjected.copy(scratchWorldAnchor).project(camera);
  const ndcZ = Math.min(0.999, Math.max(-0.999, scratchProjected.z));
  const anchorPx = {
    x: (scratchProjected.x * 0.5 + 0.5) * viewport.width,
    y: (-scratchProjected.y * 0.5 + 0.5) * viewport.height,
  };

  const layout = computeClampedMenuScreenLayout({
    anchorPx,
    baseSizePx,
    viewport,
    margins: effectiveMargins,
    gapPx,
    preferAbove,
    minFitFactor,
  });

  const clampedNdcX = viewport.width > 0 ? (layout.centerX / viewport.width) * 2 - 1 : 0;
  const clampedNdcY = viewport.height > 0 ? -(layout.centerY / viewport.height) * 2 + 1 : 0;

  scratchClampedWorld.set(clampedNdcX, clampedNdcY, ndcZ).unproject(camera);

  const worldPerPx = calculateScaleFactor(scratchClampedWorld, 1, camera, viewport);
  const scalarScale = worldPerPx * basePxPerUnit * layout.fitFactor;

  scratchParentInverse.copy(parentMatrixWorld).invert();
  const localPosition = (outLocalPosition ?? new THREE.Vector3())
    .copy(scratchClampedWorld)
    .applyMatrix4(scratchParentInverse);

  return {
    localPosition,
    scalarScale,
    layout,
  };
}
