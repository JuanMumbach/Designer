import { OrbitControls } from '@react-three/drei/native';
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from 'three';
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

export default function Design3dView() {
  return (
    <Canvas shadows style={{ background: "darkgray" }} camera={{ position: [0, 3, 5] }}>
        <CameraController/>
        <ambientLight intensity={.5}/>
        <pointLight castShadow position={[0, 5, 2]} intensity={75} />
        <RotatingBox onClick={handleBoxClick} />
        <Room3d />
        <OrbitControls {...cameraControlsProps} />
        <fog attach="fog" args={["darkgray", 5, 20]} />
    </Canvas>
  );
}
