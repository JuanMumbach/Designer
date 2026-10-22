import { Billboard, Line, Text } from '@react-three/drei/native';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { COLORS } from '@/constants/theme';
import { DesignObject } from './DesignObjects';
import { Room3dProps } from './Room3d';
import { MeasurementSide } from '../3dViewOverlay/EditMeasurementModal';

export interface ObjectDistances {
  leftDistance: number | null;
  rightDistance: number | null;
  floorDistance: number | null;
  leftReferenceEdge: number | null;
  rightReferenceEdge: number | null;
}

const EPSILON = 0.1;

export function calculateObjectMeasurements(
  object: DesignObject,
  allObjects: DesignObject[],
  room3d: Room3dProps
): ObjectDistances {
  const { objectProperties = {}, position, dimensions, rotation = 0 } = object;
  const movingBehaviour = objectProperties.movingBehaviour;
  const [objX, objY, objZ] = position;
  const [objWidth] = dimensions;

  const isBackWall = Math.abs(rotation) < EPSILON;
  const isLeftWall = Math.abs(rotation - Math.PI / 2) < EPSILON;
  const isRightWall = Math.abs(rotation + Math.PI / 2) < EPSILON;

  let leftDistance: number | null = null;
  let rightDistance: number | null = null;
  let leftReferenceEdge: number | null = null;
  let rightReferenceEdge: number | null = null;

  if (isBackWall) {
    const sameKind = allObjects
      .filter(
        o =>
          o.id !== object.id &&
          o.objectProperties?.movingBehaviour === movingBehaviour &&
          Math.abs((o.rotation || 0) - rotation) < EPSILON &&
          Math.abs(o.position[2] - objZ) < EPSILON
      )
      .sort((a, b) => a.position[0] - b.position[0]);

    const objLeft = objX;
    const objRight = objX + objWidth;

    const leftCandidates = sameKind.filter(o => o.position[0] + o.dimensions[0] <= objLeft + 0.001);
    if (leftCandidates.length > 0) {
      const nearestLeft = leftCandidates[leftCandidates.length - 1];
      leftReferenceEdge = nearestLeft.position[0] + nearestLeft.dimensions[0];
      leftDistance = objLeft - leftReferenceEdge;
    } else if (room3d.leftWall) {
      leftReferenceEdge = 0;
      leftDistance = objLeft;
    }

    const rightCandidates = sameKind.filter(o => o.position[0] >= objRight - 0.001);
    if (rightCandidates.length > 0) {
      const nearestRight = rightCandidates[0];
      rightReferenceEdge = nearestRight.position[0];
      rightDistance = rightReferenceEdge - objRight;
    } else if (room3d.rightWall) {
      rightReferenceEdge = room3d.width;
      rightDistance = room3d.width - objRight;
    }
  } else if (isLeftWall) {
    const sameKind = allObjects
      .filter(
        o =>
          o.id !== object.id &&
          o.objectProperties?.movingBehaviour === movingBehaviour &&
          Math.abs((o.rotation || 0) - rotation) < EPSILON &&
          Math.abs(o.position[0] - objX) < EPSILON
      )
      .sort((a, b) => a.position[2] - b.position[2]);

    const objFront = objZ;
    const objBack = objZ - objWidth;

    const frontCandidates = sameKind.filter(o => o.position[2] - o.dimensions[0] >= objFront - 0.001);
    if (frontCandidates.length > 0) {
      const nearestFront = frontCandidates[0];
      leftReferenceEdge = nearestFront.position[2] - nearestFront.dimensions[0];
      leftDistance = leftReferenceEdge - objFront;
    } else {
      leftReferenceEdge = room3d.depth;
      leftDistance = room3d.depth - objFront;
    }

    const backCandidates = sameKind.filter(o => o.position[2] <= objBack + 0.001);
    if (backCandidates.length > 0) {
      const nearestBack = backCandidates[backCandidates.length - 1];
      rightReferenceEdge = nearestBack.position[2];
      rightDistance = objBack - rightReferenceEdge;
    } else {
      rightReferenceEdge = 0;
      rightDistance = objBack;
    }
  } else if (isRightWall) {
    const sameKind = allObjects
      .filter(
        o =>
          o.id !== object.id &&
          o.objectProperties?.movingBehaviour === movingBehaviour &&
          Math.abs((o.rotation || 0) - rotation) < EPSILON &&
          Math.abs(o.position[0] - objX) < EPSILON
      )
      .sort((a, b) => a.position[2] - b.position[2]);

    const objFront = objZ + objWidth;
    const objBack = objZ;

    const backCandidates = sameKind.filter(o => o.position[2] + o.dimensions[0] <= objBack + 0.001);
    if (backCandidates.length > 0) {
      const nearestBack = backCandidates[backCandidates.length - 1];
      leftReferenceEdge = nearestBack.position[2] + nearestBack.dimensions[0];
      leftDistance = objBack - leftReferenceEdge;
    } else {
      leftReferenceEdge = 0;
      leftDistance = objBack;
    }

    const frontCandidates = sameKind.filter(o => o.position[2] >= objFront - 0.001);
    if (frontCandidates.length > 0) {
      const nearestFront = frontCandidates[0];
      rightReferenceEdge = nearestFront.position[2];
      rightDistance = rightReferenceEdge - objFront;
    } else {
      rightReferenceEdge = room3d.depth;
      rightDistance = room3d.depth - objFront;
    }
  }

  let floorDistance: number | null = null;
  if (objY > 0.01) {
    floorDistance = objY;
  }

  return {
    leftDistance,
    rightDistance,
    floorDistance,
    leftReferenceEdge,
    rightReferenceEdge,
  };
}

export function computeNewPositionFromMeasurement(
  object: DesignObject,
  allObjects: DesignObject[],
  room3d: Room3dProps,
  side: MeasurementSide,
  newDistance: number
): [number, number, number] {
  const clampedDistance = Math.max(0, newDistance);
  const { position, dimensions, rotation = 0 } = object;
  const [objX, objY, objZ] = position;
  const [objWidth, objHeight] = dimensions;

  if (side === 'floor') {
    const maxY = Math.max(0, room3d.height - objHeight);
    return [objX, Math.min(maxY, clampedDistance), objZ];
  }

  const distances = calculateObjectMeasurements(object, allObjects, room3d);
  const isBackWall = Math.abs(rotation) < EPSILON;
  const isLeftWall = Math.abs(rotation - Math.PI / 2) < EPSILON;
  const isRightWall = Math.abs(rotation + Math.PI / 2) < EPSILON;

  if (isBackWall) {
    let targetX = objX;
    if (side === 'left' && distances.leftReferenceEdge !== null) {
      targetX = distances.leftReferenceEdge + clampedDistance;
    } else if (side === 'right' && distances.rightReferenceEdge !== null) {
      targetX = distances.rightReferenceEdge - clampedDistance - objWidth;
    }
    const clampedX = Math.max(0, Math.min(room3d.width - objWidth, targetX));
    return [clampedX, objY, objZ];
  }

  if (isLeftWall) {
    let targetZ = objZ;
    if (side === 'left' && distances.leftReferenceEdge !== null) {
      targetZ = distances.leftReferenceEdge - clampedDistance;
    } else if (side === 'right' && distances.rightReferenceEdge !== null) {
      targetZ = distances.rightReferenceEdge + clampedDistance + objWidth;
    }
    const clampedZ = Math.max(objWidth, Math.min(room3d.depth, targetZ));
    return [objX, objY, clampedZ];
  }

  if (isRightWall) {
    let targetZ = objZ;
    if (side === 'left' && distances.leftReferenceEdge !== null) {
      targetZ = distances.leftReferenceEdge + clampedDistance;
    } else if (side === 'right' && distances.rightReferenceEdge !== null) {
      targetZ = distances.rightReferenceEdge - clampedDistance - objWidth;
    }
    const clampedZ = Math.max(0, Math.min(room3d.depth - objWidth, targetZ));
    return [objX, objY, clampedZ];
  }

  return [objX, objY, objZ];
}

function InteractiveMeasurementBadge({
  position,
  value,
  isActive,
  onSelect,
}: {
  position: [number, number, number];
  value: number;
  isActive?: boolean;
  onSelect?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const setCursor = (cursor: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.cursor = cursor;
    }
  };

  const handleTrigger = (e: any) => {
    e.stopPropagation();
    onSelect?.();
  };

  const label = value.toFixed(2);
  const fontSize = 0.22;
  const boxWidth = Math.max(0.42, label.length * 0.115 + 0.04);
  const boxHeight = fontSize + 0.04;

  const textColor = isActive || hovered ? COLORS.primary : '#111827';

  return (
    <Billboard position={position}>
      <group>
        <mesh
          position={[0, 0, 0.005]}
          renderOrder={998}
          onClick={handleTrigger}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            setCursor('pointer');
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            setCursor('auto');
          }}
        >
          <planeGeometry args={[boxWidth, boxHeight]} />
          <meshBasicMaterial
            color="#ffffff"
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <Text
          position={[0, 0, 0.01]}
          fontSize={fontSize}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          material-depthTest={false}
          material-depthWrite={false}
          material-transparent={true}
          renderOrder={999}
        >
          {label}
        </Text>
      </group>
    </Billboard>
  );
}

interface ObjectMeasurements3DProps {
  object: DesignObject;
  allObjects: DesignObject[];
  room3d: Room3dProps;
  origin: [number, number, number];
  activeSide?: MeasurementSide;
  onSelectMeasurement?: (side: MeasurementSide, currentValue: number) => void;
}

export default function ObjectMeasurements3D({
  object,
  allObjects,
  room3d,
  activeSide,
  onSelectMeasurement,
}: ObjectMeasurements3DProps) {
  const { position, dimensions } = object;
  const [, objY] = position;
  const [objWidth, objHeight] = dimensions;

  const { leftDistance, rightDistance, floorDistance } = calculateObjectMeasurements(
    object,
    allObjects,
    room3d
  );

  const measurementHeight = 0.2;
  const textOffsetY = 0.16;
  const textOffsetX = 0.28;
  const localLineY = objHeight / 2;
  const localObjLeft = 0;
  const localObjRight = objWidth;
  const localObjCenterX = objWidth / 2;
  const localObjBottomY = 0;
  const localFloorY = -objY;
  const localZ = 0;

  const measurementElements: React.ReactNode[] = [];

  const MIN_VISIBLE_DISTANCE = 0.005;

  if (leftDistance !== null && leftDistance >= MIN_VISIBLE_DISTANCE) {
    const startX = localObjLeft;
    const endX = localObjLeft - leftDistance;
    const lineColor = activeSide === 'left' ? COLORS.primary : 'black';

    measurementElements.push(
      <Line
        key="left-main"
        points={[
          [startX, localLineY, localZ],
          [endX, localLineY, localZ],
        ]}
        lineWidth={2}
        color={lineColor}
        depthTest={false}
      />,
      <Line
        key="left-tick-up"
        points={[
          [endX, localLineY + measurementHeight / 2, localZ],
          [endX, localLineY - measurementHeight / 2, localZ],
        ]}
        lineWidth={1}
        color={lineColor}
        depthTest={false}
      />,
      <Line
        key="left-tick-down"
        points={[
          [startX, localLineY + measurementHeight / 2, localZ],
          [startX, localLineY - measurementHeight / 2, localZ],
        ]}
        lineWidth={1}
        color={lineColor}
        depthTest={false}
      />,
      <InteractiveMeasurementBadge
        key="left-label"
        position={[(startX + endX) / 2, localLineY + textOffsetY, localZ]}
        value={leftDistance}
        isActive={activeSide === 'left'}
        onSelect={() => onSelectMeasurement?.('left', leftDistance)}
      />
    );
  }

  if (rightDistance !== null && rightDistance >= MIN_VISIBLE_DISTANCE) {
    const startX = localObjRight;
    const endX = localObjRight + rightDistance;
    const lineColor = activeSide === 'right' ? COLORS.primary : 'black';

    measurementElements.push(
      <Line
        key="right-main"
        points={[
          [startX, localLineY, localZ],
          [endX, localLineY, localZ],
        ]}
        lineWidth={2}
        color={lineColor}
        depthTest={false}
      />,
      <Line
        key="right-tick-up"
        points={[
          [endX, localLineY + measurementHeight / 2, localZ],
          [endX, localLineY - measurementHeight / 2, localZ],
        ]}
        lineWidth={1}
        color={lineColor}
        depthTest={false}
      />,
      <Line
        key="right-tick-down"
        points={[
          [startX, localLineY + measurementHeight / 2, localZ],
          [startX, localLineY - measurementHeight / 2, localZ],
        ]}
        lineWidth={1}
        color={lineColor}
        depthTest={false}
      />,
      <InteractiveMeasurementBadge
        key="right-label"
        position={[(startX + endX) / 2, localLineY + textOffsetY, localZ]}
        value={rightDistance}
        isActive={activeSide === 'right'}
        onSelect={() => onSelectMeasurement?.('right', rightDistance)}
      />
    );
  }

  if (floorDistance !== null && floorDistance >= MIN_VISIBLE_DISTANCE) {
    const lineColor = activeSide === 'floor' ? COLORS.primary : 'black';

    measurementElements.push(
      <Line
        key="floor-main"
        points={[
          [localObjCenterX, localObjBottomY, localZ],
          [localObjCenterX, localFloorY, localZ],
        ]}
        lineWidth={2}
        color={lineColor}
        depthTest={false}
      />,
      <Line
        key="floor-tick-left"
        points={[
          [localObjCenterX - 0.1, localObjBottomY, localZ],
          [localObjCenterX + 0.1, localObjBottomY, localZ],
        ]}
        lineWidth={1}
        color={lineColor}
        depthTest={false}
      />,
      <Line
        key="floor-tick-right"
        points={[
          [localObjCenterX - 0.1, localFloorY, localZ],
          [localObjCenterX + 0.1, localFloorY, localZ],
        ]}
        lineWidth={1}
        color={lineColor}
        depthTest={false}
      />,
      <InteractiveMeasurementBadge
        key="floor-label"
        position={[localObjCenterX + textOffsetX, (localObjBottomY + localFloorY) / 2, localZ]}
        value={floorDistance}
        isActive={activeSide === 'floor'}
        onSelect={() => onSelectMeasurement?.('floor', floorDistance)}
      />
    );
  }

  return <>{measurementElements}</>;
}
