import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";

function RotatingBox() {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
}

export default function Design3dView() {
  return (
    <Canvas gl={{ alpha: false }} style={{ background: "lightblue" }}>
      <RotatingBox />
      <ambientLight />
      <pointLight position={[2, 5, 5]} intensity={50} />
    </Canvas>
  );
}
