import { ThreeElements, useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  resolveClampedWorldTransform,
  ScreenSize2D,
  ViewportMargins,
} from './viewportClamp3d';

type GroupProps = Omit<ThreeElements['group'], 'position' | 'scale'>;

interface ViewportClampedScreenSizerProps extends GroupProps {
  localAnchor: [number, number, number];
  baseSizePx: ScreenSize2D;
  basePxPerUnit: number;
  gapPx?: number;
  preferAbove?: boolean;
  minFitFactor?: number;
  margins?: ViewportMargins;
  children: React.ReactNode;
}

export default function ViewportClampedScreenSizer({
  localAnchor,
  baseSizePx,
  basePxPerUnit,
  gapPx = 0,
  preferAbove = false,
  minFitFactor = 0.2,
  margins,
  children,
  ...groupProps
}: ViewportClampedScreenSizerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scratchLocalPosRef = useRef(new THREE.Vector3());
  const { camera, size } = useThree();

  const [anchorX, anchorY, anchorZ] = localAnchor;
  const baseWidth = baseSizePx.width;
  const baseHeight = baseSizePx.height;

  const applyClampedTransform = useCallback(
    (activeCamera: THREE.Camera, activeSize: { width: number; height: number; top: number; left: number }) => {
      const group = groupRef.current;
      const parent = group?.parent;
      if (!group || !parent) return;
      if (activeSize.width <= 0 || activeSize.height <= 0) return;

      parent.updateWorldMatrix(true, false);

      const { scalarScale } = resolveClampedWorldTransform({
        localAnchor: [anchorX, anchorY, anchorZ],
        parentMatrixWorld: parent.matrixWorld,
        camera: activeCamera,
        viewport: activeSize,
        baseSizePx: { width: baseWidth, height: baseHeight },
        basePxPerUnit,
        margins,
        gapPx,
        preferAbove,
        minFitFactor,
        outLocalPosition: scratchLocalPosRef.current,
      });

      group.position.copy(scratchLocalPosRef.current);
      group.scale.setScalar(scalarScale);
      group.updateMatrixWorld();
    },
    [
      anchorX,
      anchorY,
      anchorZ,
      baseWidth,
      baseHeight,
      basePxPerUnit,
      margins,
      gapPx,
      preferAbove,
      minFitFactor,
    ]
  );

  useLayoutEffect(() => {
    applyClampedTransform(camera, size);
  }, [applyClampedTransform, camera, size]);

  useFrame((state) => {
    applyClampedTransform(state.camera, state.size);
  });

  return (
    <group ref={groupRef} {...groupProps}>
      {children}
    </group>
  );
}
