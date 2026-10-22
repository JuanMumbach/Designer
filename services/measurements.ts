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

export function formatMeasurement(meters: number): string {
  return String(Math.round(meters * 1000));
}
