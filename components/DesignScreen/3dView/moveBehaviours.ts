import { Room3dProps } from './Room3d';
import { ObjectProperties } from '../../../services/api';

export interface MoveContext {
  objectId: string;
  origin: [number, number, number];
  initialPosition: [number, number, number];
  objectRotation: number;
  objectDimensions: [number, number, number];
  objectProperties?: ObjectProperties;
  room3d: Room3dProps;
  magnetEnabled: boolean;
  allObjects: {
    id: string;
    position: [number, number, number];
    rotation: number;
    dimensions: [number, number, number];
  }[];
}

export interface MoveResult {
  newX: number;
  newY: number;
  newZ: number;
  newRot: number;
  resetDragPoint: boolean;
}

export function freeMove(ctx: MoveContext, targetX: number, targetZ: number): MoveResult {
  const newX = Math.max(0, Math.min(ctx.room3d.width - ctx.objectDimensions[0], targetX));
  const newZ = Math.max(0, Math.min(ctx.room3d.depth - ctx.objectDimensions[2], targetZ));
  return {
    newX,
    newY: ctx.initialPosition[1],
    newZ,
    newRot: ctx.objectRotation || 0,
    resetDragPoint: false,
  };
}

export function wallSnapMove(
  ctx: MoveContext,
  targetX: number,
  targetZ: number,
  mouseX: number,
  mouseZ: number
): MoveResult {
  const MARGIN = 1;
  const EPSILON = 0.1;
  let angle = ctx.objectRotation || 0;
  let halfWidth = ctx.objectDimensions[0] / 2;

  let newX = ctx.initialPosition[0];
  let newZ = ctx.initialPosition[2];
  let newRot = ctx.objectRotation || 0;
  let resetDragPoint = false;

  if (Math.abs(angle) < EPSILON) {
    if (ctx.room3d.leftWall && targetX < -MARGIN) {
      newRot = Math.PI / 2;
      newX = 0;
      newZ = Math.max(ctx.objectDimensions[0], Math.min(ctx.room3d.depth, mouseZ + halfWidth));
      resetDragPoint = true;
    } else if (ctx.room3d.rightWall && targetX > ctx.room3d.width - ctx.objectDimensions[0] + MARGIN) {
      newRot = -Math.PI / 2;
      newX = ctx.room3d.width;
      newZ = Math.max(0, Math.min(ctx.room3d.depth - ctx.objectDimensions[0], mouseZ - halfWidth));
      resetDragPoint = true;
    } else {
      newX = Math.max(0, Math.min(ctx.room3d.width - ctx.objectDimensions[0], targetX));
      newZ = 0;
    }
  } else if (Math.abs(angle - Math.PI / 2) < EPSILON) {
    if (targetZ < ctx.objectDimensions[0] - MARGIN) {
      newRot = 0;
      newX = 0;
      newZ = 0;
      resetDragPoint = true;
    } else {
      newZ = Math.max(ctx.objectDimensions[0], Math.min(ctx.room3d.depth, targetZ));
      newX = 0;
    }
  } else if (Math.abs(angle + Math.PI / 2) < EPSILON) {
    if (targetZ < -MARGIN) {
      newRot = 0;
      newX = ctx.room3d.width - ctx.objectDimensions[0];
      newZ = 0;
      resetDragPoint = true;
    } else {
      newZ = Math.max(0, Math.min(ctx.room3d.depth - ctx.objectDimensions[0], targetZ));
      newX = ctx.room3d.width;
    }
  }

  if (ctx.magnetEnabled && ctx.allObjects.length > 1) {
    const MAGNET_THRESHOLD = 0.10;
    const currentAngle = newRot;
    const EPSILON_MAG = 0.1;

    const candidates = ctx.allObjects.filter(other => {
      if (other.id === ctx.objectId) return false;
      const otherAngle = other.rotation || 0;
      return Math.abs(otherAngle - currentAngle) < EPSILON_MAG;
    });

    if (candidates.length > 0) {
      if (Math.abs(currentAngle) < EPSILON_MAG) {
        const draggedLeft = newX;
        const draggedRight = newX + ctx.objectDimensions[0];
        let bestSnap: number | null = null;
        let bestDist = MAGNET_THRESHOLD;
        for (const other of candidates) {
          const otherLeft = other.position[0];
          const otherRight = other.position[0] + other.dimensions[0];
          let dist = Math.abs(draggedRight - otherLeft);
          if (dist < bestDist) { bestDist = dist; bestSnap = otherLeft - ctx.objectDimensions[0]; }
          dist = Math.abs(draggedLeft - otherRight);
          if (dist < bestDist) { bestDist = dist; bestSnap = otherRight; }
        }
        if (bestSnap !== null) newX = Math.max(0, Math.min(ctx.room3d.width - ctx.objectDimensions[0], bestSnap));
      } else if (Math.abs(currentAngle - Math.PI / 2) < EPSILON_MAG) {
        const draggedFront = newZ;
        const draggedBack = newZ + ctx.objectDimensions[0];
        let bestSnap: number | null = null;
        let bestDist = MAGNET_THRESHOLD;
        for (const other of candidates) {
          const otherFront = other.position[2];
          const otherBack = other.position[2] + other.dimensions[0];
          let dist = Math.abs(draggedBack - otherFront);
          if (dist < bestDist) { bestDist = dist; bestSnap = otherFront - ctx.objectDimensions[0]; }
          dist = Math.abs(draggedFront - otherBack);
          if (dist < bestDist) { bestDist = dist; bestSnap = otherBack; }
        }
        if (bestSnap !== null) newZ = Math.max(ctx.objectDimensions[0], Math.min(ctx.room3d.depth, bestSnap));
      } else if (Math.abs(currentAngle + Math.PI / 2) < EPSILON_MAG) {
        const draggedFront = newZ;
        const draggedBack = newZ + ctx.objectDimensions[0];
        let bestSnap: number | null = null;
        let bestDist = MAGNET_THRESHOLD;
        for (const other of candidates) {
          const otherFront = other.position[2];
          const otherBack = other.position[2] + other.dimensions[0];
          let dist = Math.abs(draggedBack - otherFront);
          if (dist < bestDist) { bestDist = dist; bestSnap = otherFront - ctx.objectDimensions[0]; }
          dist = Math.abs(draggedFront - otherBack);
          if (dist < bestDist) { bestDist = dist; bestSnap = otherBack; }
        }
        if (bestSnap !== null) newZ = Math.max(0, Math.min(ctx.room3d.depth - ctx.objectDimensions[0], bestSnap));
      }
    }
  }

  let newY = ctx.initialPosition[1];

  return {
    newX,
    newY,
    newZ,
    newRot,
    resetDragPoint,
  };
}

export function cupboardMove(
  ctx: MoveContext,
  targetX: number,
  targetZ: number,
  mouseX: number,
  mouseZ: number
): MoveResult {
  const result = wallSnapMove(ctx, targetX, targetZ, mouseX, mouseZ);
  result.newY = ctx.objectProperties?.height ?? ctx.initialPosition[1];
  return result;
}

export function computeDragMove(
  ctx: MoveContext,
  deltaX: number,
  deltaZ: number,
  mouseX: number,
  mouseZ: number
): MoveResult {
  const targetX = ctx.initialPosition[0] + deltaX;
  const targetZ = ctx.initialPosition[2] + deltaZ;
  const behaviour = ctx.objectProperties?.movingBehaviour;

  if (behaviour === 'counter') return wallSnapMove(ctx, targetX, targetZ, mouseX, mouseZ);
  if (behaviour === 'cupboard') return cupboardMove(ctx, targetX, targetZ, mouseX, mouseZ);
  return freeMove(ctx, targetX, targetZ);
}
