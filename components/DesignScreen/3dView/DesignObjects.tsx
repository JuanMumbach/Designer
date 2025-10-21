import React from 'react';
import { generateUUID } from 'three/src/math/MathUtils.js';
import { RemoteModelInstance } from './remote3dModel';

export interface DesignObjectInstanceProps {
    id: string;
    type: DesignObjectProps;
    name: string;
    xdistance: number;
    dimensions: [number, number, number];
    color: string;
}

export enum DesignObjectType {
    Counter = "Counter",
    Cupboard = "Cupboard",
}

export interface DesignObjectProps {
    id: string;
    name: string;
    type: DesignObjectType;
    modelUrl: string;
    width: number;
    height: number;
    depth: number;
    variantOf?: string;
}

export function NewInstance(type: DesignObjectProps, xDistance?: number): DesignObjectInstanceProps {
    return {
        id: generateUUID(),
        type: type,
        name: type.name,
        xdistance: xDistance ? xDistance : 0,
        dimensions: [type.width, type.height, type.depth],
        color: getRandomColor(),
    };
}


export var objectTypes: DesignObjectProps[] = [
    { 
        id: generateUUID(), 
        type: DesignObjectType.Counter, 
        name: "Counter60",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/bajo60con2puertas.glb?alt=media&token=b0cfe920-1841-43dd-aa60-d05afa483417", 
        width: .6, 
        height: .9, 
        depth: .6 
    },
    { 
        id: generateUUID(), 
        type: DesignObjectType.Counter, 
        name: "Counter60tallplinth",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/bajo60con2puertasZocalon.glb?alt=media&token=6ace8545-e3a5-4a8f-8b7b-51510dead445", 
        width: .6, 
        height: .9, 
        depth: .6 
    },
    { 
        id: generateUUID(), 
        type: DesignObjectType.Cupboard, 
        name: "Cupboard60hdoors",
        modelUrl: "https://firebasestorage.googleapis.com/v0/b/designer-models.firebasestorage.app/o/alacena60con2puertas.glb?alt=media&token=573dfc44-90d6-4fb8-9389-6be1500c9dbd", 
        width: .6, 
        height: .6, 
        depth: .3 
    },
    { 
        id: generateUUID(), 
        type: DesignObjectType.Cupboard, 
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


export default function DesignObjects({ objects, origin }: { objects: DesignObjectInstanceProps[], origin: [number, number, number] }) {


    let positions: number[] = [];

    let previousXPosition = 0;
    for (let i = 0; i < objects.length; i++) {
        let posx = previousXPosition + objects[i].xdistance;
        previousXPosition += objects[i].dimensions[0] + objects[i].xdistance;
        positions.push(posx);
    }

    var count = 0;
    return (
        <>
            {

                objects.map((obj) => {
                    count++;
                    const currentPosition = positions[count - 1]; // Posición de inicio del objeto
                    
                    console.log("Rendering object:", obj.name, "at position:", currentPosition);

                    return (
                            <RemoteModelInstance
                                key={obj.id}
                                obj={obj}
                                position={currentPosition}
                                origin={origin}
                                dimensions={obj.dimensions}
                                modelUrl={obj.type.modelUrl}
                                modelScale={0.01}
                            />
                        )
                })}
        </>
    );
}
