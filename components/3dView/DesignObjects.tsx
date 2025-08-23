import { Box } from '@react-three/drei/native';
import React from 'react';
import { ColorRepresentation } from 'three';

// Define the interface for your furniture data.
export interface DesignObjectProps {
  id: string;
  type: string;
  position: [number, number, number];
  dimensions: [number, number, number];
}

// The component now receives the list of objects as a prop.
export default function DesignObjects({ objects }: { objects: DesignObjectProps[] }) {
  return (
    <>
      {objects.map((obj) => {
        let color: ColorRepresentation = "white";
        let args = obj.dimensions;

        switch (obj.type) {
          case "wall":
            color = "#8b4513";
            break;
          case "cabinetWithDoors80":
            color = "#c0c0c0";
            break;
          case "drawers60_3":
            color = "#a9a9a9";
            break;
          case "cabinet60":
            color = "#d3d3d3";
            break;
          case "drawers60_2":
            color = "#a9a9a9";
            break;
          default:
            color = "#ffffff";
            break;
        }

        return (
          <Box key={obj.id} position={obj.position} args={args}>
            <meshStandardMaterial attach="material" color={color} />
          </Box>
        );
      })}
    </>
  );
}
