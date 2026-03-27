import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from 'react';
import * as THREE from 'three';
import FurnitureInstantiator, { FurnitureInstanceProps } from "./3dView/DesignObjects";
import Room3d, { Room3dProps, RoomOrigin } from "./3dView/Room3d";

const cameraControlsProps = {
    mouseButtons: {
      //LEFT: THREE.MOUSE.ROTATE,    
      MIDDLE: THREE.MOUSE.ROTATE,  
      //RIGHT: THREE.MOUSE.PAN       
    },
    touches: {
      ONE: THREE.TOUCH.ROTATE,    
      //TWO: THREE.TOUCH.DOLLY,
      //THREE: THREE.TOUCH.PAN
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


export const defaultCounterObjects: FurnitureInstanceProps[] = [];
export const defaultCupboardObjects: FurnitureInstanceProps[] = [];
export const cupboardLineHeight : number = 1.5;


export default function Design3dView({
  room3d,
  counterObjects,
  cupboardObjects,
  onObjectInteraction,
  onObjectEdited,
  movingObject,
  setMovingObject,
  magnetEnabled}:
  {
  room3d: Room3dProps,
  counterObjects: FurnitureInstanceProps[],
  cupboardObjects: FurnitureInstanceProps[],
  onObjectInteraction: (object: FurnitureInstanceProps) => void,
  onObjectEdited?: (id: string, updates: { name: string, position: [number, number, number], rotation?: number }) => void,
  movingObject?: FurnitureInstanceProps,
  setMovingObject?: (object?: FurnitureInstanceProps) => void,
  magnetEnabled: boolean
})
{

  const cupboardOrigin : [number, number, number] = [RoomOrigin({room3d})[0], RoomOrigin({room3d})[1] + cupboardLineHeight, RoomOrigin({room3d})[2]];


  console.log("Design3dView render, myDesignObjects:", counterObjects);
  let roomOrigin = RoomOrigin({room3d});
  let rightCorner : [number, number, number] = [roomOrigin[0] + room3d.width, roomOrigin[1], roomOrigin[2]];
  const allObjects = [...counterObjects, ...cupboardObjects];
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
        <FurnitureInstantiator
            objects={counterObjects}
            origin={roomOrigin}
            onObjectInteraction={onObjectInteraction}
            onObjectEdited={onObjectEdited}
            movingObjectId={movingObject?.id}
            room3d={room3d}
            magnetEnabled={magnetEnabled}
            allObjects={allObjects}
        />
        <FurnitureInstantiator
            objects={cupboardObjects}
            origin={roomOrigin}
            onObjectInteraction={onObjectInteraction}
            onObjectEdited={onObjectEdited}
            movingObjectId={movingObject?.id}
            room3d={room3d}
            magnetEnabled={magnetEnabled}
            allObjects={allObjects}
        />
        <OrbitControls {...cameraControlsProps} />
        <fog attach="fog" args={["darkgray", 5, 20]} />
    </Canvas>
  );
}
