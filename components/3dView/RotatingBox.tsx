import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh } from "three";


type RotatingBoxProps = {
  position?: [number, number, number];
};

export default function RotatingBox({ position }: RotatingBoxProps) {
  const meshRef = useRef<Mesh>(null!);

  

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;

      
      const now = new Date();
      const distance = 3; // Distance from the center
      const oscilationFactor = 5; // Speed of oscillation
      const oscillationAmplitude = .5; // Amplitude of oscillation
      var x = Math.sin(now.getSeconds() + now.getMilliseconds()/1000) * distance;
      x += Math.cos((now.getSeconds() + now.getMilliseconds()/1000)*oscilationFactor) * oscillationAmplitude;
      var z = Math.cos(now.getSeconds() + now.getMilliseconds()/1000) * distance;
      z += Math.sin((now.getSeconds() + now.getMilliseconds()/1000)*oscilationFactor) * oscillationAmplitude;
      var y = Math.sin(now.getSeconds() + now.getMilliseconds()/1000) * 2
      y += Math.cos((now.getSeconds() + now.getMilliseconds()/1000)*oscilationFactor) * oscillationAmplitude;
      position = [x, y+distance, z];
      meshRef.current.position.set(position[0], position[1], position[2]);
    }
  });

  return (
    <>
    <mesh castShadow ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="white" />
    </mesh>
    </>
  );
}