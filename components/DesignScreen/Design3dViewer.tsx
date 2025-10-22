import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from 'react';
import * as THREE from 'three';
import DesignObjects, { DesignObjectInstanceProps } from "./3dView/DesignObjects";
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


export const defaultCounterObjects: DesignObjectInstanceProps[] = [];
export const defaultCupboardObjects: DesignObjectInstanceProps[] = [];
export const cupboardLineHeight : number = 1.5;


export default function Design3dView({ room3d, counterObjects, cupboardObjects}: {room3d: Room3dProps} & { counterObjects: DesignObjectInstanceProps[] } & { cupboardObjects: DesignObjectInstanceProps[] }) {

  const cupboardOrigin : [number, number, number] = [RoomOrigin({room3d})[0], RoomOrigin({room3d})[1] + cupboardLineHeight, RoomOrigin({room3d})[2]];

  
  console.log("Design3dView render, myDesignObjects:", counterObjects);
  let roomOrigin = RoomOrigin({room3d});
  let rightCorner : [number, number, number] = [roomOrigin[0] + room3d.width, roomOrigin[1], roomOrigin[2]];
  return (
    <Canvas shadows style={{ background: "darkgray" }} camera={{ position: [0, 3, 3] }}>
        <CameraController room3d={room3d}/>
        <ambientLight intensity={.25}/>
        <pointLight castShadow position={[0, 3, room3d.depth*.75]} intensity={(room3d.depth*room3d.width)*2} />
        <Room3d {...room3d}/>
        <DesignObjects objects={counterObjects} origin={roomOrigin} />
        <DesignObjects objects={cupboardObjects} origin={cupboardOrigin} />
        <DesignObjects objects={counterObjects} origin={roomOrigin} rightToLeft={true} onZAxis={true}/>
        <DesignObjects objects={counterObjects} origin={rightCorner} rightToLeft={false} onZAxis={true}/>
        <mesh position={roomOrigin}>
        <sphereGeometry args={[.1, 16, 16]} />
          <meshStandardMaterial color="lightblue" />
        </mesh>
        <OrbitControls {...cameraControlsProps} />
        <fog attach="fog" args={["darkgray", 5, 20]} />
    </Canvas>
  );
}
