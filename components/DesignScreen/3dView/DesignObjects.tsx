import React, { useMemo } from 'react';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { ObjectMaterialType, ObjectProperties } from '../../../services/api';
import { resolveInstanceOverrides } from '../../../services/designMaterialDefaults';
import { MaterialSlotInfo } from '../../../services/materialSlots';
import { DesignObject3D } from './remote3dModel';
import { Room3dProps } from './Room3d';

export interface ObjectTemplate {
    id: string;
    version: number;
    name: string;
    modelUrl: string;
    thumbnailUrl?: string;
    width: number;
    height: number;
    depth: number;
    variantOf?: string;
    categoryId?: string;
    objectProperties?: ObjectProperties;
}

export interface AppliedMaterial {
    fileURL: string;
    scaleU: number;
    scaleV: number;
}

export interface MaterialOverrides {
    [slot: number]: string;
}

export interface GlobalMaterials {
    [slotName: string]: string;
}

export function isMaterialAlias(value: string): boolean {
    return value.startsWith('ref:');
}

export function resolveGlobalMaterials(globalMaterials: GlobalMaterials): GlobalMaterials {
    const resolveSlot = (slot: string, seen: Set<string>): string | undefined => {
        const value = globalMaterials[slot];
        if (!value) return undefined;
        if (!isMaterialAlias(value)) return value;
        if (seen.has(slot)) return undefined;
        const target = value.substring(4);
        return resolveSlot(target, new Set([...seen, slot]));
    };

    const resolved: GlobalMaterials = {};
    for (const slot of Object.keys(globalMaterials)) {
        const materialId = resolveSlot(slot, new Set());
        if (materialId) resolved[slot] = materialId;
    }
    return resolved;
}

export interface DesignObject {
    materialParts?: import('../../../services/materialParts').MaterialPart[];
    budgetEntries?: import('../../../services/budget').ModelBudgetEntry[];
    id: string;
    modelId: string;
    version: number;
    name: string;
    position: [number, number, number];
    rotation: number;
    dimensions: [number, number, number];
    color: string;
    modelUrl: string;
    objectProperties?: ObjectProperties;
    slots?: MaterialSlotInfo[];
    materialOverrides?: MaterialOverrides;
    hidden?: boolean;
}

export function createDesignObject(template: ObjectTemplate, position?: [number, number, number]): DesignObject {
    return {
        id: generateUUID(),
        modelId: template.id,
        version: template.version,
        name: template.name,
        position: position ?? [0, 0, 0],
        rotation: 0,
        dimensions: [template.width, template.height, template.depth],
        color: getRandomColor(),
        modelUrl: template.modelUrl,
        objectProperties: template.objectProperties,
        materialOverrides: {},
        hidden: false,
    };
}

export function duplicateDesignObject(
    object: DesignObject,
    allObjects: DesignObject[],
    room3d: Room3dProps
): DesignObject {
    const newPosition = calculateDuplicatePosition(object, allObjects, room3d);
    return {
        id: generateUUID(),
        modelId: object.modelId,
        version: object.version,
        name: object.name,
        position: newPosition,
        rotation: object.rotation,
        dimensions: [...object.dimensions],
        color: object.color,
        modelUrl: object.modelUrl,
        objectProperties: object.objectProperties ? { ...object.objectProperties } : undefined,
        slots: object.slots ? object.slots.map(s => ({ ...s })) : undefined,
        materialOverrides: object.materialOverrides ? { ...object.materialOverrides } : {},
        materialParts: object.materialParts ? object.materialParts.map(p => ({ ...p })) : undefined,
        budgetEntries: object.budgetEntries ? object.budgetEntries.map(b => ({ ...b })) : undefined,
        hidden: false,
    };
}

export function calculateDuplicatePosition(
    object: DesignObject,
    allObjects: DesignObject[],
    room3d: Room3dProps
): [number, number, number] {
    const EPSILON = 0.1;
    const [width, , depth] = object.dimensions;
    const [objX, objY, objZ] = object.position;
    const rotation = object.rotation || 0;
    const movingBehaviour = object.objectProperties?.movingBehaviour;

    const isBackWall = Math.abs(rotation) < EPSILON;
    const isLeftWall = Math.abs(rotation - Math.PI / 2) < EPSILON;
    const isRightWall = Math.abs(rotation + Math.PI / 2) < EPSILON;

    const sameLayer = allObjects.filter(
        o =>
            o.id !== object.id &&
            o.objectProperties?.movingBehaviour === movingBehaviour &&
            Math.abs((o.rotation || 0) - rotation) < EPSILON
    );

    if (isBackWall) {
        const isOccupied = (x: number) =>
            sameLayer.some(
                o =>
                    Math.abs(o.position[2] - objZ) < EPSILON &&
                    Math.abs(o.position[1] - objY) < EPSILON &&
                    !(o.position[0] + o.dimensions[0] <= x + 0.01 || o.position[0] >= x + width - 0.01)
            );

        const rightX = Math.round((objX + width) * 100) / 100;
        const leftX = Math.round((objX - width) * 100) / 100;
        const rightFits = rightX + width <= room3d.width + 0.01;
        const leftFits = leftX >= -0.01;

        let targetX = rightX;
        if (rightFits && !isOccupied(rightX)) {
            targetX = rightX;
        } else if (leftFits && !isOccupied(leftX)) {
            targetX = leftX;
        } else if (rightFits) {
            targetX = rightX;
        } else if (leftFits) {
            targetX = leftX;
        }

        const clampedX = Math.max(0, Math.min(room3d.width - width, targetX));
        return [clampedX, objY, objZ];
    }

    if (isLeftWall) {
        const isOccupied = (z: number) =>
            sameLayer.some(
                o =>
                    Math.abs(o.position[0] - objX) < EPSILON &&
                    Math.abs(o.position[1] - objY) < EPSILON &&
                    !(o.position[2] <= z - width + 0.01 || o.position[2] - o.dimensions[0] >= z - 0.01)
            );

        const frontZ = Math.round((objZ + width) * 100) / 100;
        const backZ = Math.round((objZ - width) * 100) / 100;
        const frontFits = frontZ <= room3d.depth + 0.01;
        const backFits = backZ - width >= -0.01;

        let targetZ = frontZ;
        if (frontFits && !isOccupied(frontZ)) {
            targetZ = frontZ;
        } else if (backFits && !isOccupied(backZ)) {
            targetZ = backZ;
        } else if (frontFits) {
            targetZ = frontZ;
        } else if (backFits) {
            targetZ = backZ;
        }

        const clampedZ = Math.max(width, Math.min(room3d.depth, targetZ));
        return [objX, objY, clampedZ];
    }

    if (isRightWall) {
        const isOccupied = (z: number) =>
            sameLayer.some(
                o =>
                    Math.abs(o.position[0] - objX) < EPSILON &&
                    Math.abs(o.position[1] - objY) < EPSILON &&
                    !(o.position[2] + o.dimensions[0] <= z + 0.01 || o.position[2] >= z + width - 0.01)
            );

        const frontZ = Math.round((objZ + width) * 100) / 100;
        const backZ = Math.round((objZ - width) * 100) / 100;
        const frontFits = frontZ + width <= room3d.depth + 0.01;
        const backFits = backZ >= -0.01;

        let targetZ = frontZ;
        if (frontFits && !isOccupied(frontZ)) {
            targetZ = frontZ;
        } else if (backFits && !isOccupied(backZ)) {
            targetZ = backZ;
        } else if (frontFits) {
            targetZ = frontZ;
        } else if (backFits) {
            targetZ = backZ;
        }

        const clampedZ = Math.max(0, Math.min(room3d.depth - width, targetZ));
        return [objX, objY, clampedZ];
    }

    const dx = Math.round(width * Math.cos(rotation) * 100) / 100;
    const dz = Math.round(-width * Math.sin(rotation) * 100) / 100;

    const targetX1 = objX + dx;
    const targetZ1 = objZ + dz;
    const fits1 = targetX1 >= 0 && targetX1 + width <= room3d.width && targetZ1 >= 0 && targetZ1 + depth <= room3d.depth;

    const targetX2 = objX - dx;
    const targetZ2 = objZ - dz;
    const fits2 = targetX2 >= 0 && targetX2 + width <= room3d.width && targetZ2 >= 0 && targetZ2 + depth <= room3d.depth;

    if (fits1) return [targetX1, objY, targetZ1];
    if (fits2) return [targetX2, objY, targetZ2];

    const clampedX = Math.max(0, Math.min(room3d.width - width, targetX1));
    const clampedZ = Math.max(0, Math.min(room3d.depth - depth, targetZ1));
    return [clampedX, objY, clampedZ];
}

export const DEFAULT_CUPBOARD_HEIGHT = 1.5;

export function getInitialPosition(template: ObjectTemplate): [number, number, number] {
    const y = template.objectProperties?.movingBehaviour === 'cupboard'
        ? (template.objectProperties.height ?? DEFAULT_CUPBOARD_HEIGHT)
        : 0;
    return [0, y, 0];
}

export let objectTemplates: ObjectTemplate[] = [
    {
        id: generateUUID(),
        version: 1,
        name: "Counter60",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/bajo60con2puertas.glb?alt=media&token=b0cfe920-1841-43dd-aa60-d05afa483417",
        width: .6,
        height: .9,
        depth: .6,
        objectProperties: { movingBehaviour: 'counter' }
    },
    {
        id: generateUUID(),
        version: 1,
        name: "Counter60tallplinth",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/bajo60con2puertasZocalon.glb?alt=media&token=6ace8545-e3a5-4a8f-8b7b-51510dead445",
        width: .6,
        height: .9,
        depth: .6,
        objectProperties: { movingBehaviour: 'counter' }
    },
    {
        id: generateUUID(),
        version: 1,
        name: "Cupboard60hdoors",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/alacena60con2puertas.glb?alt=media&token=573dfc44-90d6-4fb8-9389-6be1500c9dbd",
        width: .6,
        height: .6,
        depth: .3,
        objectProperties: { movingBehaviour: 'cupboard', height: 1.6 }
    },
    {
        id: generateUUID(),
        version: 1,
        name: "Cupboard60vdoors",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/alacena60con2puertasLevadizas.glb?alt=media&token=9d18bf97-138a-48cb-bc24-4e424fc33a6c",
        width: .6,
        height: .6,
        depth: .3,
        objectProperties: { movingBehaviour: 'cupboard', height: 1.6 }
    }
];

function getRandomColor() {
    let rand: number = Math.random();
    if (rand as number < 0.3) return "#ffc6c6";
    if (rand as number < 0.6) return "#ccffcc";
    if (rand as number < 0.8) return "#cbcbff";
    return "#ffffff";
}

export interface WallCulling {
    left: boolean;
    right: boolean;
}

export default function DesignObjectsRenderer({
  objects,
  origin,
  onObjectInteraction,
  onObjectEdited,
  onObjectDeleted,
  onEditObject,
  onObjectDuplicate,
  movingObjectId,
  room3d,
  magnetEnabled,
  allObjects,
  onDragStateChange,
  onSlotsDiscovered,
  globalMaterials,
  globalMaterialsRaw,
  materialDataById,
  slotTypesByModel,
  typeToDesignSlot,
  wallCulling,
  activeMeasurementSide,
  onSelectMeasurement,
  onDeselect
}: {
  objects: DesignObject[],
  origin: [number, number, number],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides, hidden?: boolean }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  onObjectDuplicate?: (object: DesignObject) => void,
  movingObjectId?: string,
  room3d: Room3dProps,
  magnetEnabled: boolean,
  allObjects: DesignObject[],
  onDragStateChange?: (isDragging: boolean) => void,
  onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
  globalMaterials?: Record<string, AppliedMaterial>,
  globalMaterialsRaw?: GlobalMaterials,
  materialDataById?: Record<string, AppliedMaterial>,
  slotTypesByModel?: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot?: Record<string, string>,
  wallCulling?: WallCulling,
  activeMeasurementSide?: import('../3dViewOverlay/EditMeasurementModal').MeasurementSide,
  onSelectMeasurement?: (object: DesignObject, side: import('../3dViewOverlay/EditMeasurementModal').MeasurementSide, currentValue: number) => void,
  onDeselect?: () => void
}) {

    return (
        <>
            {objects.map((obj) => {
                let currentPosition : [number, number, number] = obj.position;

                 return (
                         <DesignObjectWithMaterials
                             key={obj.id}
                             obj={obj}
                             onObjectInteraction={onObjectInteraction}
                             onDeselect={onDeselect}
                             position={currentPosition}
                             origin={origin}
                             dimensions={obj.dimensions}
                             modelUrl={obj.modelUrl}
                             modelScale={0.1}
                             rotation={obj.rotation}
                             isSelected={obj.id === movingObjectId}
                             onObjectEdited={onObjectEdited}
                             onObjectDeleted={onObjectDeleted}
                             onEditObject={onEditObject}
                             onObjectDuplicate={onObjectDuplicate}
                             room3d={room3d}
                             magnetEnabled={magnetEnabled}
                             allObjects={allObjects}
                             onDragStateChange={onDragStateChange}
                             onSlotsDiscovered={onSlotsDiscovered}
                             globalMaterials={globalMaterials}
                             globalMaterialsRaw={globalMaterialsRaw}
                             materialDataById={materialDataById}
                             slotTypesByModel={slotTypesByModel}
                             typeToDesignSlot={typeToDesignSlot}
                             forcedHidden={isAttachedToCulledWall(obj, room3d, wallCulling)}
                             activeMeasurementSide={obj.id === movingObjectId ? activeMeasurementSide : undefined}
                             onSelectMeasurement={onSelectMeasurement ? (side, val) => onSelectMeasurement(obj, side, val) : undefined}
                         />
                     )
            })}
        </>
    );
}

function isAttachedToCulledWall(obj: DesignObject, room3d: Room3dProps, wallCulling?: WallCulling): boolean {
    if (!wallCulling) return false;
    const ROTATION_EPSILON = 0.1;
    const POSITION_TOLERANCE = 0.05;
    const rotation = obj.rotation ?? 0;

    if (
        wallCulling.left &&
        Math.abs(rotation - Math.PI / 2) < ROTATION_EPSILON &&
        Math.abs(obj.position[0]) < POSITION_TOLERANCE
    ) {
        return true;
    }

    if (
        wallCulling.right &&
        Math.abs(rotation + Math.PI / 2) < ROTATION_EPSILON &&
        Math.abs(obj.position[0] - room3d.width) < POSITION_TOLERANCE
    ) {
        return true;
    }

    return false;
}

function DesignObjectWithMaterials({
  obj,
  position,
  origin,
  dimensions,
  modelUrl,
  modelScale,
  rotation,
  isSelected,
  onObjectInteraction,
  onObjectEdited,
  onObjectDeleted,
  onEditObject,
  onObjectDuplicate,
  room3d,
  magnetEnabled,
  allObjects,
  onDragStateChange,
  onSlotsDiscovered,
  interactionDisabled,
  globalMaterials,
  globalMaterialsRaw,
  materialDataById,
  slotTypesByModel,
  typeToDesignSlot,
  forcedHidden,
  activeMeasurementSide,
  onSelectMeasurement,
  onDeselect
}: {
  obj: DesignObject,
  position: [number, number, number],
  origin: [number, number, number],
  dimensions: [number, number, number],
  modelUrl: string,
  modelScale?: number,
  rotation?: number,
  isSelected?: boolean,
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides, hidden?: boolean }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  onObjectDuplicate?: (object: DesignObject) => void,
  room3d: Room3dProps,
  magnetEnabled: boolean,
  allObjects: DesignObject[],
  onDragStateChange?: (isDragging: boolean) => void,
  onSlotsDiscovered?: (id: string, slots: MaterialSlotInfo[]) => void,
  interactionDisabled?: boolean,
  globalMaterials?: Record<string, AppliedMaterial>,
  globalMaterialsRaw?: GlobalMaterials,
  materialDataById?: Record<string, AppliedMaterial>,
  slotTypesByModel?: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot?: Record<string, string>,
  forcedHidden?: boolean,
  activeMeasurementSide?: import('../3dViewOverlay/EditMeasurementModal').MeasurementSide,
  onSelectMeasurement?: (side: import('../3dViewOverlay/EditMeasurementModal').MeasurementSide, currentValue: number) => void,
  onDeselect?: () => void
}) {
  const instanceOverrides = useMemo<Record<number, AppliedMaterial>>(() => {
    const overrides = obj.materialOverrides ?? {};
    return resolveInstanceOverrides(overrides, globalMaterialsRaw ?? {}, materialDataById);
  }, [obj.materialOverrides, globalMaterialsRaw, materialDataById]);

  return (
    <DesignObject3D
      obj={obj}
      onObjectInteraction={onObjectInteraction}
      onDeselect={onDeselect}
      position={position}
      origin={origin}
      dimensions={dimensions}
      modelScale={modelScale}
      rotation={rotation}
      isSelected={isSelected}
      onObjectEdited={onObjectEdited}
      onObjectDeleted={onObjectDeleted}
      onEditObject={onEditObject}
      onObjectDuplicate={onObjectDuplicate}
      room3d={room3d}
      magnetEnabled={magnetEnabled}
      allObjects={allObjects}
      onDragStateChange={onDragStateChange}
      onSlotsDiscovered={onSlotsDiscovered}
      interactionDisabled={interactionDisabled}
      instanceOverrides={instanceOverrides}
      globalMaterials={globalMaterials}
      globalMaterialsRaw={globalMaterialsRaw}
      materialDataById={materialDataById}
      slotTypesByModel={slotTypesByModel}
      typeToDesignSlot={typeToDesignSlot}
      forcedHidden={forcedHidden}
      activeMeasurementSide={activeMeasurementSide}
      onSelectMeasurement={onSelectMeasurement}
    />
  );
}
