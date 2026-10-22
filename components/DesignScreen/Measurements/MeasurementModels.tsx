import React, { Suspense, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useGLTF } from '@react-three/drei/native';
import { Canvas } from '@react-three/fiber';
import type { ModuleElevation } from '../../../services/measurements';
import { WallView } from '../../../services/measurements';
import { useDownload3dModel } from '../3dView/remote3dModel';
import { createElevationModel } from './elevationModel';
import { createElevationCamera } from './elevationCamera';

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

export default function MeasurementModels({ modules, wall, scale, originX, originY, width, height, onStatus }: {
  modules: ModuleElevation[]; wall: WallView; scale: number; originX: number; originY: number; width: number; height: number;
  onStatus: (id: string, status: 'ready' | 'unavailable') => void;
}) {
  const camera = useMemo(() => createElevationCamera(width, height), [width, height]);
  const onError = React.useCallback(() => {
    modules.forEach(module => onStatus(`${module.object.id}:${module.object.modelUrl}`, 'unavailable'));
  }, [modules, onStatus]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <ModelBoundary onError={onError}>
    <Canvas orthographic frameloop="demand" dpr={1} camera={camera}
      gl={{ antialias: true, alpha: true }} style={styles.canvas}>
      {modules.map(module => <ElevationModel key={`${module.object.id}:${module.object.modelUrl}`} module={module} wall={wall}
        scale={scale} originX={originX} originY={originY} drawingHeight={height} onStatus={onStatus} />)}
    </Canvas>
    </ModelBoundary>
  </View>;
}

const styles = StyleSheet.create({ canvas: { width: '100%', height: '100%' } });
