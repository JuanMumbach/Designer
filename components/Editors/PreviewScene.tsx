import { OrbitControls } from '@react-three/drei/native';
import React, { useMemo } from 'react';
import * as THREE from 'three';

function GridWithoutCenterLines({ size = 20, divisions = 20 }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const half = size / 2;
    const step = size / divisions;
    for (let i = 0; i <= divisions; i++) {
      const pos = -half + i * step;
      if (Math.abs(pos) < 0.001) {
        pts.push(0, 0, 0, 0, 0, half);
        pts.push(-half, 0, 0, 0, 0, 0);
      } else {
        pts.push(pos, 0, -half, pos, 0, half);
        pts.push(-half, 0, pos, half, 0, pos);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [size, divisions]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#d1d5db" />
    </lineSegments>
  );
}

export default function PreviewEnvironment({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <OrbitControls enableDamping />
      <axesHelper args={[10]} scale={[1, 1, -1]} />
      <GridWithoutCenterLines />
      {children}
    </>
  );
}
