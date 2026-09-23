import React, { useMemo } from 'react';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { DesignObject3D } from './remote3dModel';
import { Room3dProps } from './Room3d';
import { ObjectMaterialType, ObjectProperties } from '../../../services/api';
import { MaterialSlotInfo } from '../../../services/materialSlots';
import { resolveInstanceOverrides } from '../../../services/designMaterialDefaults';

export interface ObjectTemplate {
    id: string;
    version: number;
    name: string;
    modelUrl: string;
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
  wallCulling
}: {
  objects: DesignObject[],
  origin: [number, number, number],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number, materialOverrides?: MaterialOverrides, hidden?: boolean }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
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
  wallCulling?: WallCulling
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
                             position={currentPosition}
                             origin={origin}
                             dimensions={obj.dimensions}
                             modelUrl={obj.modelUrl}
                             modelScale={0.01}
                             rotation={obj.rotation}
                             isSelected={obj.id === movingObjectId}
                             onObjectEdited={onObjectEdited}
                             onObjectDeleted={onObjectDeleted}
                             onEditObject={onEditObject}
                             room3d={room3d}
                             magnetEnabled={magnetEnabled}
                             allObjects={allObjects}
                             onDragStateChange={onDragStateChange}
                             onSlotsDiscovered={onSlotsDiscovered}
                             interactionDisabled={movingObjectId !== undefined && obj.id !== movingObjectId}
                             globalMaterials={globalMaterials}
                             globalMaterialsRaw={globalMaterialsRaw}
                             materialDataById={materialDataById}
                             slotTypesByModel={slotTypesByModel}
                             typeToDesignSlot={typeToDesignSlot}
                             forcedHidden={isAttachedToCulledWall(obj, room3d, wallCulling)}
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
  forcedHidden
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
  forcedHidden?: boolean
}) {
  const instanceOverrides = useMemo<Record<number, AppliedMaterial>>(() => {
    const overrides = obj.materialOverrides ?? {};
    return resolveInstanceOverrides(overrides, globalMaterialsRaw ?? {}, materialDataById);
  }, [obj.materialOverrides, globalMaterialsRaw, materialDataById]);

  return (
    <DesignObject3D
      obj={obj}
      onObjectInteraction={onObjectInteraction}
      position={position}
      origin={origin}
      dimensions={dimensions}
      modelScale={modelScale}
      rotation={rotation}
      isSelected={isSelected}
      onObjectEdited={onObjectEdited}
      onObjectDeleted={onObjectDeleted}
      onEditObject={onEditObject}
      room3d={room3d}
      magnetEnabled={magnetEnabled}
      allObjects={allObjects}
      onDragStateChange={onDragStateChange}
      onSlotsDiscovered={onSlotsDiscovered}
      interactionDisabled={interactionDisabled}
      instanceOverrides={instanceOverrides}
      globalMaterials={globalMaterials}
      slotTypesByModel={slotTypesByModel}
      typeToDesignSlot={typeToDesignSlot}
      forcedHidden={forcedHidden}
    />
  );
}
