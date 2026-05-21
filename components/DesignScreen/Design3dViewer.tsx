import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import DesignObjectsRenderer, { DesignObject } from "./3dView/DesignObjects";
import Room3d, { Room3dProps, RoomOrigin } from "./3dView/Room3d";

const cameraControlsProps = {
    mouseButtons: {
      MIDDLE: THREE.MOUSE.ROTATE,
    },
    touches: {
      ONE: THREE.TOUCH.ROTATE,
    },
    enableDamping: false,
    minAzimuthAngle: -Math.PI / 4,
    maxAzimuthAngle: Math.PI / 4,
    minPolarAngle: Math.PI / 4+.3,
    maxPolarAngle: Math.PI / 4+.3,
    rotateSpeed: 0.25,
  };

function CameraController({room3d}: {room3d : Room3dProps}) {
  const { camera } = useThree();

  useFrame(() => {
    camera.lookAt(0, 1.5, room3d.depth / 2);
    camera.updateProjectionMatrix();
  });

  return null;
}

const handleBoxClick = () => {
    console.log("Box clicked!");
  }

export default function Design3dView({
  room3d,
  designObjects,
  onObjectInteraction,
  onObjectEdited,
  onObjectDeleted,
  onEditObject,
  movingObject,
  setMovingObject,
  magnetEnabled,
  onDragStateChange}:
  {
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onObjectInteraction: (object: DesignObject) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
  onObjectDeleted?: (id: string) => void,
  onEditObject?: (object: DesignObject) => void,
  movingObject?: DesignObject,
  setMovingObject?: (object?: DesignObject) => void,
  magnetEnabled: boolean,
  onDragStateChange?: (isDragging: boolean) => void
})
{
  const isDragging = useRef(0);
  const [, forceUpdate] = useState(0);

  const handleDragStateChange = (dragging: boolean) => {
    isDragging.current += dragging ? 1 : -1;
    if (onDragStateChange) onDragStateChange(isDragging.current > 0);
    forceUpdate(n => n + 1);
  };

  console.log("Design3dView render, designObjects:", designObjects);
  let roomOrigin = RoomOrigin({room3d});
  return (
    <Canvas
    shadows
    style={{ background: "darkgray" }}
    camera={{ position: [0, 3, 3] }}
    onPointerMissed={() => {
        console.log("Canvas clicked. Deselecting objects.");
        if (setMovingObject) setMovingObject(undefined);
      }}
    >
        <CameraController room3d={room3d}/>
        <ambientLight intensity={.25}/>
        <pointLight castShadow position={[0, 3, room3d.depth*.75]} intensity={(room3d.depth*room3d.width)*2} />
        <Room3d {...room3d}/>
        <DesignObjectsRenderer
            objects={designObjects}
            origin={roomOrigin}
            onObjectInteraction={onObjectInteraction}
            onObjectEdited={onObjectEdited}
            onObjectDeleted={onObjectDeleted}
            onEditObject={onEditObject}
            movingObjectId={movingObject?.id}
            room3d={room3d}
            magnetEnabled={magnetEnabled}
            allObjects={designObjects}
            onDragStateChange={handleDragStateChange}
        />
        <OrbitControls {...cameraControlsProps} enabled={isDragging.current === 0} />
        <fog attach="fog" args={["darkgray", 5, 20]} />
    </Canvas>
  );
}
