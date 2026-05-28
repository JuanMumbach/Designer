import React from 'react';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { DesignObject3D } from './remote3dModel';
import { Room3dProps } from './Room3d';
import { ObjectProperties } from '../../../services/api';

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

export interface TextureOverride {
    meshName: string;
    materialId: string;
    fileURL: string;
    scaleU: number;
    scaleV: number;
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
    textureOverrides?: TextureOverride[];
    meshNames?: string[];
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
  onMeshesDiscovered
}: {
  objects: DesignObject[],
  origin: [number, number, number],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  movingObjectId?: string,
  room3d: Room3dProps,
  magnetEnabled: boolean,
  allObjects: DesignObject[],
  onDragStateChange?: (isDragging: boolean) => void,
  onMeshesDiscovered?: (id: string, meshNames: string[]) => void
}) {

    return (
        <>
            {objects.map((obj) => {
                let currentPosition : [number, number, number] = obj.position;

                 return (
                         <DesignObject3D
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
                             onMeshesDiscovered={onMeshesDiscovered}
                             interactionDisabled={movingObjectId !== undefined && obj.id !== movingObjectId}
                         />
                     )
            })}
        </>
    );
}
