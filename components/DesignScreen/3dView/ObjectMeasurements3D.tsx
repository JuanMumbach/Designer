import React from 'react';
import { Line } from '@react-three/drei/native';

interface ObjectMeasurements3DProps {
  object: any; // DesignObject
  allObjects: any[]; // DesignObject[]
  room3d: any; // Room3dProps
  origin: [number, number, number];
}

/**
 * Renders measurement lines and labels for a selected object
 * showing distances to walls, nearest same-kind objects, and floor.
 */
export default function ObjectMeasurements3D({
  object,
  allObjects,
  room3d,
  origin
}: ObjectMeasurements3DProps) {
  const { objectProperties = {}, position, dimensions, rotation = 0 } = object;
  const movingBehaviour = objectProperties.movingBehaviour;
  
  // Extract key properties
  const [objX, objY, objZ] = position;
  const [objWidth, objHeight] = dimensions;
  
  // Filter: same kind (same movingBehaviour), same rotation (within epsilon), same z (wall)
  const EPSILON = 0.01;
  const sameKind = allObjects
    .filter(o => o.id !== object.id &&
                o.objectProperties?.movingBehaviour === movingBehaviour &&
                Math.abs((o.rotation || 0) - rotation) < EPSILON &&
                Math.abs(o.position[2] - objZ) < EPSILON) // Same z (wall)
    .sort((a, b) => a.position[0] - b.position[0]); // Sort by x position

  // Find left and right neighbors
  const objLeft = objX;
  const objRight = objX + objWidth;
  
  // Left side: find nearest object to the left, or wall
  const leftCandidates = sameKind.filter(o => o.position[0] + o.dimensions[0] <= objLeft);
  let leftDistance: number | null = null;
  if (leftCandidates.length > 0) {
    const nearestLeft = leftCandidates[leftCandidates.length - 1]; // Rightmost of left objects
    leftDistance = objLeft - (nearestLeft.position[0] + nearestLeft.dimensions[0]);
  } else if (room3d.leftWall) {
    leftDistance = objLeft; // Distance from left wall (x=0)
  }
  
  // Right side: find nearest object to the right, or wall
  const rightCandidates = sameKind.filter(o => o.position[0] >= objRight);
  let rightDistance: number |null = null;
  if (rightCandidates.length > 0) {
    const nearestRight = rightCandidates[0]; // Leftmost of right objects
    rightDistance = nearestRight.position[0] - objRight;
  } else if (room3d.rightWall) {
    rightDistance = room3d.width - objRight;
  }
  
  // Floor distance (if elevated)
  let floorDistance: number | null = null;
  if (objY > 0.01) { // Above floor
    floorDistance = objY;
  }

  // Render measurements
  const measurementHeight = 0.2; // Height of measurement lines above object
  const localLineY = objHeight + measurementHeight;
  const localObjLeft = 0;
  const localObjRight = objWidth;
  const localObjCenterX = objWidth / 2;
  const localObjBottomY = 0;
  const localFloorY = -objY;
  const localZ = 0;
  
  // Group all measurements together
  const measurementElements: JSX.Element[] = [];
  
  // Left measurement
  if (leftDistance !== null) {
    const startX = localObjLeft;
    const endX = localObjLeft - leftDistance; // Going left (negative x direction)
    
    // Main horizontal line
    measurementElements.push(
      <Line
        key="left-main"
        points={[ [startX, localLineY, localZ], [endX, localLineY, localZ] ]}
        lineWidth={2}
        color="black"
        depthTest={false}
      />
    );
    // Upper tick
    measurementElements.push(
      <Line
        key="left-tick-up"
        points={[ [endX, localLineY + measurementHeight/2, localZ], [endX, localLineY - measurementHeight/2, localZ] ]}
        lineWidth={1}
        color="black"
        depthTest={false}
      />
    );
    // Lower tick
    measurementElements.push(
      <Line
        key="left-tick-down"
        points={[ [startX, localLineY + measurementHeight/2, localZ], [startX, localLineY - measurementHeight/2, localZ] ]}
        lineWidth={1}
        color="black"
        depthTest={false}
      />
    );
  }
  
  // Right measurement
  if (rightDistance !== null) {
    const startX = localObjRight;
    const endX = localObjRight + rightDistance; // Going right (positive x direction)
    
    // Main horizontal line
    measurementElements.push(
      <Line
        key="right-main"
        points={[ [startX, localLineY, localZ], [endX, localLineY, localZ] ]}
        lineWidth={2}
        color="black"
        depthTest={false}
      />
    );
    // Upper tick
    measurementElements.push(
      <Line
        key="right-tick-up"
        points={[ [endX, localLineY + measurementHeight/2, localZ], [endX, localLineY - measurementHeight/2, localZ] ]}
        lineWidth={1}
        color="black"
        depthTest={false}
      />
    );
    // Lower tick
    measurementElements.push(
      <Line
        key="right-tick-down"
        points={[ [startX, localLineY + measurementHeight/2, localZ], [startX, localLineY - measurementHeight/2, localZ] ]}
        lineWidth={1}
        color="black"
        depthTest={false}
      />
    );
  }
  
  // Floor measurement
  if (floorDistance !== null) {
    // Vertical line from object bottom to floor
    measurementElements.push(
      <Line
        key="floor-main"
        points={[ [localObjCenterX, localObjBottomY, localZ], [localObjCenterX, localFloorY, localZ] ]}
        lineWidth={2}
        color="black"
        depthTest={false}
      />
    );
    // Left tick
    measurementElements.push(
      <Line
        key="floor-tick-left"
        points={[ [localObjCenterX - 0.1, localObjBottomY, localZ], [localObjCenterX + 0.1, localObjBottomY, localZ] ]}
        lineWidth={1}
        color="black"
        depthTest={false}
      />
    );
    // Right tick
    measurementElements.push(
      <Line
        key="floor-tick-right"
        points={[ [localObjCenterX - 0.1, localFloorY, localZ], [localObjCenterX + 0.1, localFloorY, localZ] ]}
        lineWidth={1}
        color="black"
        depthTest={false}
      />
    );
  }
  
  // For MVP, just return the lines (no text labels yet)
  // In a full implementation, we'd add Html or Text components from drei
  return (
    <>
      {measurementElements}
    </>
  );
}
