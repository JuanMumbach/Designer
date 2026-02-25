import React from 'react';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { FurnitureInstance } from './remote3dModel';
import { Room3dProps } from './Room3d';

export interface FurnitureInstanceProps {
    id: string;
    type: FurnitureProps;
    name: string;
    position: [number, number, number];
    rotation: number;
    dimensions: [number, number, number];
    color: string;
}

export enum FurnitureType {
    Counter = "Counter",
    Cupboard = "Cupboard",
}

export interface FurnitureProps {
    id: string;
    name: string;
    type: FurnitureType;
    modelUrl: string;
    width: number;
    height: number;
    depth: number;
    variantOf?: string;
}

export function NewFurnitureInstance(type: FurnitureProps, position?: [number, number, number]): FurnitureInstanceProps {
    return {
        id: generateUUID(),
        type: type,
        name: type.name,
        position: position ? position : [0, 0, 0],
        rotation: 0,
        dimensions: [type.width, type.height, type.depth],
        color: getRandomColor(),
    };
}


export var furnitureModels: FurnitureProps[] = [
    { 
        id: generateUUID(), 
        type: FurnitureType.Counter, 
        name: "Counter60",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/bajo60con2puertas.glb?alt=media&token=b0cfe920-1841-43dd-aa60-d05afa483417", 
        width: .6, 
        height: .9, 
        depth: .6 
    },
    { 
        id: generateUUID(), 
        type: FurnitureType.Counter, 
        name: "Counter60tallplinth",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/bajo60con2puertasZocalon.glb?alt=media&token=6ace8545-e3a5-4a8f-8b7b-51510dead445", 
        width: .6, 
        height: .9, 
        depth: .6 
    },
    { 
        id: generateUUID(), 
        type: FurnitureType.Cupboard, 
        name: "Cupboard60hdoors",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/alacena60con2puertas.glb?alt=media&token=573dfc44-90d6-4fb8-9389-6be1500c9dbd", 
        width: .6, 
        height: .6, 
        depth: .3 
    },
    { 
        id: generateUUID(), 
        type: FurnitureType.Cupboard, 
        name: "Cupboard60vdoors",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/alacena60con2puertasLevadizas.glb?alt=media&token=9d18bf97-138a-48cb-bc24-4e424fc33a6c", 
        width: .6, 
        height: .6, 
        depth: .3
    }
];

function getRandomColor() {
    let rand: number = Math.random();
    if (rand as number < 0.3) return "#ffc6c6";
    if (rand as number < 0.6) return "#ccffcc";
    if (rand as number < 0.8) return "#cbcbff";
    return "#ffffff";
}


export default function FurnitureInstantiator({ 
  objects, 
  origin, 
  onObjectInteraction,
  onObjectEdited,
  movingObjectId,
  room3d
}: { 
  objects: FurnitureInstanceProps[], 
  origin: [number, number, number], 
  onObjectInteraction: (object: FurnitureInstanceProps) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number] }) => void,
  movingObjectId?: string,
  room3d: Room3dProps
}) {

    return (
        <>
            {objects.map((obj) => {
                let currentPosition : [number, number, number] = obj.position; 
                
                return (
                        <FurnitureInstance
                            key={obj.id}
                            obj={obj}
                            onObjectInteraction={onObjectInteraction}
                            position={currentPosition}
                            origin={origin}
                            dimensions={obj.dimensions}
                            modelUrl={obj.type.modelUrl}
                            modelScale={0.01}
                            rotation={obj.rotation}
                            isSelected={obj.id === movingObjectId}
                            onObjectEdited={onObjectEdited}
                            room3d={room3d}
                        />
                    )
            })}
        </>
    );
}