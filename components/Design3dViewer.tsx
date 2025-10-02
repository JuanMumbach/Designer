import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from 'react';
import * as THREE from 'three';
import DesignObjects, { DesignObjectInstanceProps, NewInstance, objectTypes } from "./3dView/DesignObjects";
import Room3d, { RoomOrigin } from "./3dView/Room3d";

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


export const myDesignObjects: DesignObjectInstanceProps[] = [];


export default function Design3dView() {

  myDesignObjects.push(NewInstance(objectTypes[0], .6));
  myDesignObjects.push(NewInstance(objectTypes[1]));
  myDesignObjects.push(NewInstance(objectTypes[3]));
  myDesignObjects.push(NewInstance(objectTypes[2]));


  console.log("Design3dView render, myDesignObjects:", myDesignObjects);
  return (
    <Canvas shadows style={{ background: "darkgray" }} camera={{ position: [0, 3, 3] }}>
        <CameraController/>
        <ambientLight intensity={10}/>
        <pointLight castShadow position={[0, 3, 3.5]} intensity={70} />
        <Room3d/>
        <DesignObjects objects={myDesignObjects} origin={RoomOrigin()} />
        <mesh position={RoomOrigin()}>
        <sphereGeometry args={[.1, 16, 16]} />
          <meshStandardMaterial color="lightblue" />
        </mesh>
        <OrbitControls {...cameraControlsProps} />
        {/*<fog attach="fog" args={["darkgray", 5, 20]} />*/}
    </Canvas>
  );
}
