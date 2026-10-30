import React, { Suspense, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useGLTF } from '@react-three/drei/native';
import { Canvas, useThree } from '@react-three/fiber';
import { encode as encodePng } from 'fast-png';
import * as THREE from 'three';
import type { ModuleElevation } from '../../../services/measurements';
import { WallView } from '../../../services/measurements';
import { useDownload3dModel } from '../3dView/remote3dModel';
import { createElevationModel } from './elevationModel';
import { createElevationCamera } from './elevationCamera';

export interface ElevationCaptureResult {
  width: number;
  height: number;
  dataUrl?: string;
  pixels?: Uint8Array;
}

export interface ElevationCaptureApi {
  captureElevation: (targetWidth: number, targetHeight: number) => Promise<ElevationCaptureResult | null>;
}

interface ModelBoundaryProps {
  children: React.ReactNode;
  onError: () => void;
}

class ModelBoundary extends React.Component<ModelBoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function LoadedModel({ uri, module, wall, onReady }: {
  uri: string; module: ModuleElevation; wall: WallView; onReady: () => void;
}) {
  const { scene } = useGLTF(uri);
  const model = useMemo(() => createElevationModel(scene, module.object, wall), [scene, module.object, wall]);
  useEffect(() => {
    onReady();
    return model.dispose;
  }, [model, onReady]);
  return <primitive object={model.scene} dispose={null} />;
}

function ElevationModel({ module, wall, scale, originX, originY, drawingHeight, onStatus }: {
  module: ModuleElevation; wall: WallView; scale: number; originX: number; originY: number; drawingHeight: number;
  onStatus: (id: string, status: 'ready' | 'unavailable') => void;
}) {
  const { object } = module;
  const { localUri, isLoading, error } = useDownload3dModel(object.modelUrl, object.id);
  const statusKey = `${object.id}:${object.modelUrl}`;
  const onError = React.useCallback(() => onStatus(statusKey, 'unavailable'), [statusKey, onStatus]);
  const onReady = React.useCallback(() => onStatus(statusKey, 'ready'), [statusKey, onStatus]);
  useEffect(() => {
    if (error || (!isLoading && !localUri)) onError();
  }, [error, isLoading, localUri, onError]);
  if (!localUri || isLoading || error) return null;
  const centerX = object.position[0] + object.dimensions[0] / 2 * Math.cos(object.rotation) + object.dimensions[2] / 2 * Math.sin(object.rotation);
  const centerZ = object.position[2] - object.dimensions[0] / 2 * Math.sin(object.rotation) + object.dimensions[2] / 2 * Math.cos(object.rotation);
  const depth = wall === WallView.Front ? centerZ : wall === WallView.Left ? centerX : -centerX;
  return <group position={[
    originX + (module.left + module.width / 2) * scale,
    drawingHeight - originY + (module.bottom + module.height / 2) * scale,
    depth * scale,
  ]} scale={scale}>
    <ModelBoundary key={object.modelUrl} onError={onError}>
      <Suspense fallback={null}><LoadedModel uri={localUri} module={module} wall={wall} onReady={onReady} /></Suspense>
    </ModelBoundary>
  </group>;
}

function ElevationCaptureController({
  captureRef,
}: {
  captureRef?: React.MutableRefObject<ElevationCaptureApi | null>;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!captureRef) return;

    captureRef.current = {
      captureElevation: async (targetWidth: number, targetHeight: number) => {
        const outW = Math.max(64, Math.min(4096, Math.round(targetWidth)));
        const outH = Math.max(64, Math.min(4096, Math.round(targetHeight)));

        const prevSize = new THREE.Vector2();
        gl.getSize(prevSize);
        const prevPixelRatio = gl.getPixelRatio();

        try {
          gl.setPixelRatio(1);
          gl.setSize(outW, outH, false);
          gl.render(scene, camera);

          if (Platform.OS === 'web') {
            const canvas = gl.domElement as HTMLCanvasElement | undefined;
            if (canvas && typeof canvas.toDataURL === 'function') {
              const dataUrl = canvas.toDataURL('image/png');
              return { width: outW, height: outH, dataUrl };
            }
          }

          const glContext = gl.getContext();
          const drawW = glContext.drawingBufferWidth || outW;
          const drawH = glContext.drawingBufferHeight || outH;
          const rawPixels = new Uint8Array(drawW * drawH * 4);
          glContext.readPixels(0, 0, drawW, drawH, glContext.RGBA, glContext.UNSIGNED_BYTE, rawPixels);

          const flipped = new Uint8Array(drawW * drawH * 4);
          const rowSize = drawW * 4;
          for (let y = 0; y < drawH; y++) {
            const srcOffset = y * rowSize;
            const dstOffset = (drawH - 1 - y) * rowSize;
            flipped.set(rawPixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
          }

          return { width: drawW, height: drawH, pixels: flipped };
        } catch (err) {
          console.warn('Elevation capture failed:', err);
          return null;
        } finally {
          gl.setPixelRatio(prevPixelRatio);
          if (prevSize.x > 0 && prevSize.y > 0) {
            gl.setSize(prevSize.x, prevSize.y, false);
          }
          gl.render(scene, camera);
        }
      },
    };

    return () => {
      captureRef.current = null;
    };
  }, [captureRef, gl, scene, camera]);

  return null;
}

export function encodeRgbaToPngBytes(width: number, height: number, data: Uint8Array): Uint8Array {
  const encoded = encodePng({
    width,
    height,
    data,
    channels: 4,
    depth: 8,
  });
  return encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
}

export default function MeasurementModels({ modules, wall, scale, originX, originY, width, height, onStatus, captureRef }: {
  modules: ModuleElevation[]; wall: WallView; scale: number; originX: number; originY: number; width: number; height: number;
  onStatus: (id: string, status: 'ready' | 'unavailable') => void;
  captureRef?: React.MutableRefObject<ElevationCaptureApi | null>;
}) {
  const camera = useMemo(() => createElevationCamera(width, height), [width, height]);
  const onError = React.useCallback(() => {
    modules.forEach(module => onStatus(`${module.object.id}:${module.object.modelUrl}`, 'unavailable'));
  }, [modules, onStatus]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <ModelBoundary onError={onError}>
    <Canvas orthographic frameloop="demand" dpr={1} camera={camera}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} style={styles.canvas}>
      <ElevationCaptureController captureRef={captureRef} />
      {modules.map(module => <ElevationModel key={`${module.object.id}:${module.object.modelUrl}`} module={module} wall={wall}
        scale={scale} originX={originX} originY={originY} drawingHeight={height} onStatus={onStatus} />)}
    </Canvas>
    </ModelBoundary>
  </View>;
}

const styles = StyleSheet.create({ canvas: { width: '100%', height: '100%' } });
