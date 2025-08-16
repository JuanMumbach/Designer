import { Canvas, useFrame, useThree } from "@react-three/fiber";
import Room3d from "./3dView/Room3d";
import RotatingBox from "./3dView/RotatingBox";

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
    <Canvas shadows style={{ background: "lightblue" }} camera={{ position: [0, 3, 5] }}>
        <CameraController />
        <ambientLight intensity={.5}/>
        <pointLight castShadow position={[0, 5, 2]} intensity={75} />
        <RotatingBox onClick={handleBoxClick} />
        <Room3d />
    </Canvas>
  );
}
