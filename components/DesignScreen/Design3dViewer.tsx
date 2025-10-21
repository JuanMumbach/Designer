import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from 'react';
import * as THREE from 'three';
import DesignObjects, { DesignObjectInstanceProps, NewInstance, objectTypes } from "./3dView/DesignObjects";
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
    minPolarAngle: Math.PI / 4+.2,
    maxPolarAngle: Math.PI / 4+.2,
    rotateSpeed: 0.25,
  };

function CameraController() {
  const { camera } = useThree();

  useFrame(() => {
    camera.lookAt(0, 1, 0);
    camera.updateProjectionMatrix();
  });

  return null;
}

const handleBoxClick = () => {
    console.log("Box clicked!");
  }


export const counterLineObjects: DesignObjectInstanceProps[] = [];
export const cupboardLineObjects: DesignObjectInstanceProps[] = [];
export const cupboardLineHeight : number = 1.5;

counterLineObjects.push(NewInstance(objectTypes[0], .6));
counterLineObjects.push(NewInstance(objectTypes[1]));
counterLineObjects.push(NewInstance(objectTypes[1]));
counterLineObjects.push(NewInstance(objectTypes[0], .6));
cupboardLineObjects.push(NewInstance(objectTypes[2]));
cupboardLineObjects.push(NewInstance(objectTypes[3]));
cupboardLineObjects.push(NewInstance(objectTypes[2]));
cupboardLineObjects.push(NewInstance(objectTypes[2]));
cupboardLineObjects.push(NewInstance(objectTypes[3], .6));

export default function Design3dView( room3d : Room3dProps ) {

  const cupboardOrigin : [number, number, number] = [RoomOrigin({room3d})[0], RoomOrigin({room3d})[1] + cupboardLineHeight, RoomOrigin({room3d})[2]];

  console.log("Design3dView render, myDesignObjects:", counterLineObjects);
  return (
    <Canvas shadows style={{ background: "darkgray" }} camera={{ position: [0, 3, 3] }}>
        <CameraController/>
        <ambientLight intensity={.5}/>
        <pointLight castShadow position={[0, 3, 3.5]} intensity={70} />
        <Room3d {...room3d}/>
        <DesignObjects objects={counterLineObjects} origin={RoomOrigin({room3d})} />
        <DesignObjects objects={cupboardLineObjects} origin={cupboardOrigin} />
        <mesh position={RoomOrigin({room3d})}>
        <sphereGeometry args={[.1, 16, 16]} />
          <meshStandardMaterial color="lightblue" />
        </mesh>
        <OrbitControls {...cameraControlsProps} />
        <fog attach="fog" args={["darkgray", 5, 20]} />
    </Canvas>
  );
}
