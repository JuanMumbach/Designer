import { Box } from '@react-three/drei/native';
import React from 'react';
import { generateUUID } from 'three/src/math/MathUtils.js';


export interface DesignObjectInstanceProps {
  id: string;
  type: DesignObjectTypeProps;
  name: string;
  xdistance: number;
  dimensions: [number, number, number];
  color: string;
}

export interface DesignObjectTypeProps {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
}

export function NewInstance(type: DesignObjectTypeProps, xDistance? : number): DesignObjectInstanceProps {
  return {
    id: generateUUID(),
    type: type,
    name: type.name,
    xdistance: xDistance ? xDistance : 0,
    dimensions: [type.width, type.height, type.depth],
    color: getRandomColor(),
  };
}


export var objectTypes : DesignObjectTypeProps[] = [
  { id: generateUUID(), name: "Cube Small", width: .4, height: .88, depth: .6 },
  { id: generateUUID(), name: "Cube Medium", width: .6, height: .88, depth: .6 },
  { id: generateUUID(), name: "Cube Large", width: .8, height: .88, depth: .6 }, ];

function getRandomColor() {
  let rand : number = Math.random();
  if (rand as number < 0.3) return "#ffc6c6";
  if (rand as number < 0.6) return "#ccffcc";
  if (rand as number < 0.8) return "#cbcbff";
  return "#ffffff";
}

// The component now receives the list of objects as a prop.
export default function DesignObjects({ objects, origin }: { objects: DesignObjectInstanceProps[], origin: [number, number, number] }) {

  
  let positions : number[] = [];

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
          console.log("Rendering object:", obj.name, "at position:", positions[count-1]);
          return (
            <Box key={obj.id} 
              position={[
                origin[0]+positions[count-1]+obj.dimensions[0]/2,
                origin[1]+obj.dimensions[1]/2,
                origin[2]+obj.dimensions[2]/2
              ]}
              
              args={[obj.dimensions[0], obj.dimensions[1], obj.dimensions[2]]}
              >
              <meshStandardMaterial attach="material" color={obj.color}/>
            </Box>
        );
      })}
    </>
  );
}
