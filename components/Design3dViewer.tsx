import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from 'three';
import DesignObjects, { DesignObjectProps } from "./3dView/DesignObjects";
import Room3d from "./3dView/Room3d";
import RotatingBox from "./3dView/RotatingBox";

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
    minPolarAngle: Math.PI / 4,
    maxPolarAngle: Math.PI / 4,
    rotateSpeed: 0.25,
  };

function CameraController() {
  const { camera } = useThree();

  useFrame(() => {
    camera.lookAt(0, 0, -2.5);
    camera.updateProjectionMatrix();
  });

  return null;
}

const handleBoxClick = () => {
    console.log("Box clicked!");
  }

// The list of objects is now stored here, in the parent component.
const myDesignObjects: DesignObjectProps[] = [
  {
    id: "wall",
    type: "wall",
    position: [.1, 1.35, 2.5],
    dimensions: [.2, 2.7, 5],
  },
  {
    id: "cabinet1",
    type: "cabinetWithDoors80",
    position: [.6, .45, .3],
    dimensions: [.8, .9, .6],
  },
  {
    id: "drawers1",
    type: "drawers60_3",
    position: [1.4, .45, .3],
    dimensions: [.8, .9, .6],
  },
  {
    id: "cabinet2",
    type: "cabinet60",
    position: [2.2, .45, .3],
    dimensions: [.8, .9, .6],
  },
  {
    id: "drawers2",
    type: "drawers60_2",
    position: [3, .45, .3],
    dimensions: [.8, .9, .6],
  },
];

export default function Design3dView() {
  return (
    <Canvas shadows style={{ background: "darkgray" }} camera={{ position: [0, 3, 5] }}>
        <CameraController/>
        <ambientLight intensity={.5}/>
        <pointLight castShadow position={[0, 5, 2]} intensity={75} />
        <RotatingBox onClick={handleBoxClick} />
        <Room3d />
        <DesignObjects objects={myDesignObjects} />
        <OrbitControls {...cameraControlsProps} />
        <fog attach="fog" args={["darkgray", 5, 20]} />
    </Canvas>
  );
}
