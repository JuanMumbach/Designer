import { DesignObject } from './DesignObjects';
import { Room3dProps, WallIdentifier, WallTileZone } from './Room3d';

const DEFAULT_BOTTOM = 0.90;
const DEFAULT_HEIGHT = 0.60;
const EPSILON = 0.15;

export function resolveWallTileZones(
  wallId: WallIdentifier,
  room: Room3dProps,
  designObjects: DesignObject[]
): WallTileZone[] {
  const wallConfig = room.walls?.[wallId];
  const manualTiles = (wallConfig?.tiles ?? []).filter((t) => t.source === 'manual');

  const autoBacksplashEnabled = wallConfig?.autoBacksplash !== false;
  if (!autoBacksplashEnabled) {
    return manualTiles;
  }

  const autoTiles: WallTileZone[] = [];

  for (const obj of designObjects) {
    if (obj.hidden) continue;
    const behaviour = obj.objectProperties?.movingBehaviour;
    if (behaviour !== 'counter') continue;
    if (obj.backsplash && obj.backsplash.enabled === false) continue;

    const rot = obj.rotation || 0;
    const bottom = obj.backsplash?.bottom ?? DEFAULT_BOTTOM;
    const height = obj.backsplash?.height ?? DEFAULT_HEIGHT;
    const materialId = obj.backsplash?.materialId || wallConfig?.defaultTileMaterialId;

    if (wallId === 'back') {
      const isBackWallRot = Math.abs(rot) < EPSILON || Math.abs(rot - Math.PI * 2) < EPSILON;
      if (isBackWallRot && (obj.position[2] ?? 0) <= 0.25) {
        const start = Math.max(0, obj.position[0]);
        const width = Math.min(obj.dimensions[0], room.width - start);
        if (width > 0.05) {
          autoTiles.push({
            id: `auto-${obj.id}-back`,
            source: 'counter',
            counterId: obj.id,
            start,
            width,
            bottom,
            height,
            materialId,
          });
        }
      }
    } else if (wallId === 'left') {
      const isLeftWallRot = Math.abs(rot - Math.PI / 2) < EPSILON;
      if (isLeftWallRot && (obj.position[0] ?? 0) <= 0.25) {
        const start = Math.max(0, (obj.position[2] ?? 0) - obj.dimensions[0]);
        const width = Math.min(obj.dimensions[0], room.depth - start);
        if (width > 0.05) {
          autoTiles.push({
            id: `auto-${obj.id}-left`,
            source: 'counter',
            counterId: obj.id,
            start,
            width,
            bottom,
            height,
            materialId,
          });
        }
      }
    } else if (wallId === 'right') {
      const isRightWallRot = Math.abs(rot + Math.PI / 2) < EPSILON || Math.abs(rot - 3 * Math.PI / 2) < EPSILON;
      if (isRightWallRot && (obj.position[0] ?? 0) >= room.width - obj.dimensions[2] - 0.25) {
        const start = Math.max(0, obj.position[2] ?? 0);
        const width = Math.min(obj.dimensions[0], room.depth - start);
        if (width > 0.05) {
          autoTiles.push({
            id: `auto-${obj.id}-right`,
            source: 'counter',
            counterId: obj.id,
            start,
            width,
            bottom,
            height,
            materialId,
          });
        }
      }
    }
  }

  return [...manualTiles, ...autoTiles];
}
