import { Line, Text } from '@react-three/drei/native';
import React from 'react';

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
  
  // Filter and distance calculations based on rotation
  const EPSILON = 0.1;
  const isBackWall = Math.abs(rotation) < EPSILON;
  const isLeftWall = Math.abs(rotation - Math.PI / 2) < EPSILON;
  const isRightWall = Math.abs(rotation + Math.PI / 2) < EPSILON;

  let leftDistance: number | null = null;
  let rightDistance: number | null = null;

  if (isBackWall) {
    // Back wall: parallel to X-axis
    const sameKind = allObjects
      .filter(o => o.id !== object.id &&
                  o.objectProperties?.movingBehaviour === movingBehaviour &&
                  Math.abs((o.rotation || 0) - rotation) < EPSILON &&
                  Math.abs(o.position[2] - objZ) < EPSILON)
      .sort((a, b) => a.position[0] - b.position[0]);

    const objLeft = objX;
    const objRight = objX + objWidth;

    // Left side: find nearest object to the left, or left wall
    const leftCandidates = sameKind.filter(o => o.position[0] + o.dimensions[0] <= objLeft);
    if (leftCandidates.length > 0) {
      const nearestLeft = leftCandidates[leftCandidates.length - 1];
      leftDistance = objLeft - (nearestLeft.position[0] + nearestLeft.dimensions[0]);
    } else if (room3d.leftWall) {
      leftDistance = objLeft; // Distance from left wall (x=0)
    }

    // Right side: find nearest object to the right, or right wall
    const rightCandidates = sameKind.filter(o => o.position[0] >= objRight);
    if (rightCandidates.length > 0) {
      const nearestRight = rightCandidates[0];
      rightDistance = nearestRight.position[0] - objRight;
    } else if (room3d.rightWall) {
      rightDistance = room3d.width - objRight;
    }
  } else if (isLeftWall) {
    // Left wall: parallel to Z-axis
    const sameKind = allObjects
      .filter(o => o.id !== object.id &&
                  o.objectProperties?.movingBehaviour === movingBehaviour &&
                  Math.abs((o.rotation || 0) - rotation) < EPSILON &&
                  Math.abs(o.position[0] - objX) < EPSILON)
      .sort((a, b) => a.position[2] - b.position[2]);

    const objFront = objZ; // front edge (towards depth)
    const objBack = objZ - objWidth; // back edge (towards 0)

    // Left measurement (goes towards Z = depth / front opening)
    const frontCandidates = sameKind.filter(o => o.position[2] - o.dimensions[0] >= objFront);
    if (frontCandidates.length > 0) {
      const nearestFront = frontCandidates[0]; // closest towards front
      leftDistance = (nearestFront.position[2] - nearestFront.dimensions[0]) - objFront;
    } else {
      leftDistance = room3d.depth - objFront; // Distance to front opening
    }

    // Right measurement (goes towards Z = 0 / back wall)
    const backCandidates = sameKind.filter(o => o.position[2] <= objBack);
    if (backCandidates.length > 0) {
      const nearestBack = backCandidates[backCandidates.length - 1]; // closest towards back
      rightDistance = objBack - nearestBack.position[2];
    } else {
      rightDistance = objBack; // Distance to back wall
    }
  } else if (isRightWall) {
    // Right wall: parallel to Z-axis
    const sameKind = allObjects
      .filter(o => o.id !== object.id &&
                  o.objectProperties?.movingBehaviour === movingBehaviour &&
                  Math.abs((o.rotation || 0) - rotation) < EPSILON &&
                  Math.abs(o.position[0] - objX) < EPSILON)
      .sort((a, b) => a.position[2] - b.position[2]);

    const objFront = objZ + objWidth; // front edge (towards depth)
    const objBack = objZ; // back edge (towards 0)

    // Left measurement (goes towards Z = 0 / back wall)
    const backCandidates = sameKind.filter(o => o.position[2] + o.dimensions[0] <= objBack);
    if (backCandidates.length > 0) {
      const nearestBack = backCandidates[backCandidates.length - 1]; // closest towards back
      leftDistance = objBack - (nearestBack.position[2] + nearestBack.dimensions[0]);
    } else {
      leftDistance = objBack; // Distance to back wall
    }

    // Right measurement (goes towards Z = depth / front opening)
    const frontCandidates = sameKind.filter(o => o.position[2] >= objFront);
    if (frontCandidates.length > 0) {
      const nearestFront = frontCandidates[0]; // closest towards front
      rightDistance = nearestFront.position[2] - objFront;
    } else {
      rightDistance = room3d.depth - objFront; // Distance to front opening
    }
  }
  
  // Floor distance (if elevated)
  let floorDistance: number | null = null;
  if (objY > 0.01) { // Above floor
    floorDistance = objY;
  }

  // Render measurements
  const measurementHeight = 0.2; // Height of measurement lines above object
  const textOffsetY = 0.1; // Vertical offset for text labels
  const textOffsetX = 0.25; // Horizontal offset for text labels
  const localLineY = objHeight/2;
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
    // Distance Label
    measurementElements.push(
      <Text
        key="left-label"
        position={[(startX + endX) / 2, localLineY + textOffsetY, localZ]}
        fontSize={0.25}
        color="black"
        anchorX="center"
        anchorY="middle"
        material-depthTest={false}
        material-depthWrite={false}
        material-transparent={true}
        renderOrder={999}
      >
        {leftDistance.toFixed(2)}
      </Text>
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
    // Distance Label
    measurementElements.push(
      <Text
        key="right-label"
        position={[(startX + endX) / 2, localLineY + textOffsetY, localZ]}
        fontSize={0.25}
        color="black"
        anchorX="center"
        anchorY="middle"
        material-depthTest={false}
        material-depthWrite={false}
        material-transparent={true}
        renderOrder={999}
      >
        {rightDistance.toFixed(2)}
      </Text>
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
    // Distance Label
    measurementElements.push(
      <Text
        key="floor-label"
        position={[localObjCenterX + textOffsetX, (localObjBottomY + localFloorY) / 2, localZ]}
        fontSize={0.25}
        color="black"
        anchorX="center"
        anchorY="middle"
        material-depthTest={false}
        material-depthWrite={false}
        material-transparent={true}
        renderOrder={999}
      >
        {floorDistance.toFixed(2)}
      </Text>
    );
  }
  
  // Return the measurements and labels
  return (
    <>
      {measurementElements}
    </>
  );
}
