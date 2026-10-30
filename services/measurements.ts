import type { DesignObject } from '../components/DesignScreen/3dView/DesignObjects';
import type { Room3dProps } from '../components/DesignScreen/3dView/Room3d';

export enum WallView {
  Left = 'left',
  Front = 'front',
  Right = 'right',
}

export interface MeasurementWall {
  view: WallView;
  name: string;
  label: string;
  width: number;
}

export interface ModuleElevation {
  object: DesignObject;
  left: number;
  bottom: number;
  width: number;
  height: number;
  outsideWall: boolean;
}

export interface HorizontalGapMeasurement {
  id: string;
  left: number;
  width: number;
  y: number;
}

export interface VerticalGapMeasurement {
  id: string;
  x: number;
  bottom: number;
  height: number;
}

export function getMeasurementWalls(room: Room3dProps): MeasurementWall[] {
  const walls = [
    ...(room.leftWall ? [{ view: WallView.Left, label: 'Left', width: room.depth }] : []),
    { view: WallView.Front, label: 'Front', width: room.width },
    ...(room.rightWall ? [{ view: WallView.Right, label: 'Right', width: room.depth }] : []),
  ];
  return walls.map((wall, index) => ({ ...wall, name: `wall ${String.fromCharCode(65 + index)}` }));
}

export function getModuleElevations(objects: DesignObject[], room: Room3dProps, wall: MeasurementWall): ModuleElevation[] {
  return objects.filter(object => !object.hidden).flatMap(object => {
    if (![...object.position, ...object.dimensions, object.rotation].every(Number.isFinite)
      || object.dimensions.some(value => value <= 0)) return [];
    const sin = Math.sin(object.rotation);
    const cos = Math.cos(object.rotation);
    const facing = Math.abs(cos) >= Math.abs(sin) ? WallView.Front : sin > 0 ? WallView.Left : WallView.Right;
    if (facing !== wall.view) return [];
    const [x, bottom, z] = object.position;
    const [width, height, depth] = object.dimensions;
    const corners = [[0, 0], [width, 0], [0, depth], [width, depth]].map(([localX, localZ]) => {
      const worldX = x + localX * cos + localZ * sin;
      const worldZ = z - localX * sin + localZ * cos;
      return wall.view === WallView.Front ? worldX : wall.view === WallView.Left ? room.depth - worldZ : worldZ;
    });
    const left = Math.min(...corners);
    const projectedWidth = Math.max(...corners) - left;
    return [{ object, left, bottom, width: projectedWidth, height,
      outsideWall: left < -0.001 || left + projectedWidth > wall.width + 0.001 || bottom < -0.001 || bottom + height > room.height + 0.001 }];
  }).sort((a, b) => a.left - b.left || a.bottom - b.bottom || a.object.id.localeCompare(b.object.id));
}

const MIN_GAP_METERS = 0.005;

export function getElevationGaps(
  modules: ModuleElevation[],
  wall: MeasurementWall
): {
  horizontalGaps: HorizontalGapMeasurement[];
  verticalGaps: VerticalGapMeasurement[];
} {
  const horizontalGaps: HorizontalGapMeasurement[] = [];
  const verticalGaps: VerticalGapMeasurement[] = [];

  const upperModules = modules.filter(
    m => m.object.objectProperties?.movingBehaviour === 'cupboard' || m.bottom >= 0.5
  );
  const lowerModules = modules.filter(
    m => m.object.objectProperties?.movingBehaviour !== 'cupboard' && m.bottom < 0.5
  );

  const computeRowHorizontalGaps = (row: ModuleElevation[], prefix: string) => {
    if (row.length === 0) return;
    const sorted = [...row].sort((a, b) => a.left - b.left);

    const first = sorted[0];
    if (first.left >= MIN_GAP_METERS) {
      horizontalGaps.push({
        id: `${prefix}-left-wall`,
        left: 0,
        width: first.left,
        y: first.bottom + first.height / 2,
      });
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const currentRight = current.left + current.width;
      const gap = next.left - currentRight;
      if (gap >= MIN_GAP_METERS) {
        const overlapBottom = Math.max(current.bottom, next.bottom);
        const overlapTop = Math.min(current.bottom + current.height, next.bottom + next.height);
        const midY =
          overlapTop > overlapBottom
            ? (overlapBottom + overlapTop) / 2
            : (current.bottom + current.height / 2 + next.bottom + next.height / 2) / 2;
        horizontalGaps.push({
          id: `${prefix}-${current.object.id}-${next.object.id}`,
          left: currentRight,
          width: gap,
          y: midY,
        });
      }
    }

    const last = sorted[sorted.length - 1];
    const lastRight = last.left + last.width;
    const rightWallGap = wall.width - lastRight;
    if (rightWallGap >= MIN_GAP_METERS) {
      horizontalGaps.push({
        id: `${prefix}-right-wall`,
        left: lastRight,
        width: rightWallGap,
        y: last.bottom + last.height / 2,
      });
    }
  };

  computeRowHorizontalGaps(lowerModules, 'lower');
  computeRowHorizontalGaps(upperModules, 'upper');

  const usedVerticalKeys = new Set<string>();

  for (const upper of upperModules) {
    const overlappingLowers = lowerModules.filter(lower => {
      const overlapStart = Math.max(upper.left, lower.left);
      const overlapEnd = Math.min(upper.left + upper.width, lower.left + lower.width);
      return overlapEnd - overlapStart >= 0.01 && lower.bottom + lower.height <= upper.bottom + 0.005;
    });

    if (overlappingLowers.length > 0) {
      let highestLower = overlappingLowers[0];
      for (const candidate of overlappingLowers) {
        if (candidate.bottom + candidate.height > highestLower.bottom + highestLower.height) {
          highestLower = candidate;
        }
      }
      const lowerTop = highestLower.bottom + highestLower.height;
      const vGap = upper.bottom - lowerTop;
      if (vGap >= MIN_GAP_METERS) {
        const overlapStart = Math.max(upper.left, highestLower.left);
        const overlapEnd = Math.min(
          upper.left + upper.width,
          highestLower.left + highestLower.width
        );
        const midX = (overlapStart + overlapEnd) / 2;
        const key = `${Math.round(lowerTop * 1000)}-${Math.round(upper.bottom * 1000)}-${Math.round(midX * 100)}`;
        if (!usedVerticalKeys.has(key)) {
          usedVerticalKeys.add(key);
          verticalGaps.push({
            id: `vgap-${upper.object.id}-${highestLower.object.id}`,
            x: midX,
            bottom: lowerTop,
            height: vGap,
          });
        }
      }
    } else if (upper.bottom >= MIN_GAP_METERS) {
      const midX = upper.left + upper.width / 2;
      verticalGaps.push({
        id: `vgap-floor-${upper.object.id}`,
        x: midX,
        bottom: 0,
        height: upper.bottom,
      });
    }
  }

  return { horizontalGaps, verticalGaps };
}

export function formatMeasurement(meters: number): string {
  return String(Math.round(meters * 1000));
}
