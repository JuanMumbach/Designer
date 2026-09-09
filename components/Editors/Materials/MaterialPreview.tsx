import { Box, Gltf } from '@react-three/drei/native';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import PreviewEnvironment from '../PreviewScene';
import {
  buildSlotIndexMaps,
  collectSlots,
  MaterialSlotInfo,
  resolveMeshSlot,
  SlotIndexMaps,
} from '../../../services/materialSlots';
import { extractGlbParts, readGlbBytes } from '../../../services/glbParts';

export default function MaterialPreview({
  modelUrl,
  textureUri,
  selectedSlot,
  onSlotsDiscovered,
  scaleU = 1,
  scaleV = 1,
}: {
  modelUrl: string | null;
  textureUri: string | null;
  selectedSlot: number | null;
  onSlotsDiscovered: (slots: MaterialSlotInfo[]) => void;
  scaleU?: number;
  scaleV?: number;
}) {
  const gltfRef = useRef<THREE.Group | null>(null);
  const originalMaterialsRef = useRef<Map<number, THREE.Material>>(new Map());
  const slotMapsRef = useRef<SlotIndexMaps | null>(null);
  const overrideVersionRef = useRef(0);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const slotsDiscoveredRef = useRef(false);
  const modelDimensionsRef = useRef<[number, number, number]>([1, 1, 1]);
  const [gltfLoaded, setGltfLoaded] = useState(false);
  const [slotMapsReady, setSlotMapsReady] = useState(false);
  const [processedTextureUri, setProcessedTextureUri] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const onSlotsDiscoveredRef = useRef(onSlotsDiscovered);
  onSlotsDiscoveredRef.current = onSlotsDiscovered;

  useEffect(() => {
    if (!textureUri) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setProcessedTextureUri(null);
      return;
    }

    let cancelled = false;

    const prepare = async () => {
      let result = textureUri;
      if (Platform.OS === 'web' && textureUri.startsWith('file://')) {
        const resp = await fetch(textureUri);
        const blob = await resp.blob();
        result = URL.createObjectURL(blob);
      }
      if (!cancelled) {
        if (objectUrlRef.current && objectUrlRef.current !== result) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = result.startsWith('blob:') ? result : null;
        setProcessedTextureUri(result);
      }
    };

    prepare();

    return () => {
      cancelled = true;
    };
  }, [textureUri]);

  useEffect(() => {
    setGltfLoaded(false);
    slotsDiscoveredRef.current = false;
    originalMaterialsRef.current.clear();
  }, [modelUrl]);

  useEffect(() => {
    if (!modelUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const bytes = await readGlbBytes(modelUrl);
        const maps = buildSlotIndexMaps(extractGlbParts(bytes));
        if (cancelled) return;
        slotMapsRef.current = maps;
      } catch (err) {
        console.warn('Failed to parse GLB material slots:', err);
        if (cancelled) return;
        slotMapsRef.current = null;
      } finally {
        if (!cancelled) setSlotMapsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const handleGltfReady = useCallback((group: THREE.Group | null) => {
    gltfRef.current = group;
    if (!group) return;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.material = child.material.clone();
      }
    });

    group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    modelDimensionsRef.current = [size.x || 1, size.y || 1, size.z || 1];

    setGltfLoaded(true);
  }, []);

  useEffect(() => {
    const group = gltfRef.current;
    const maps = slotMapsRef.current;
    if (!group || !maps || !gltfLoaded || !slotMapsReady) return;

    const { slots, originalMaterials } = collectSlots(group, maps);
    originalMaterialsRef.current = originalMaterials;

    if (slots.length > 0 && !slotsDiscoveredRef.current) {
      slotsDiscoveredRef.current = true;
      onSlotsDiscoveredRef.current(slots);
    }
  }, [gltfLoaded, slotMapsReady, modelUrl]);

  useEffect(() => {
    const group = gltfRef.current;
    const maps = slotMapsRef.current;
    if (!group || !gltfLoaded || !modelUrl || !maps || !slotMapsReady) return;

    overrideVersionRef.current++;
    const currentVersion = overrideVersionRef.current;

    if (!textureLoaderRef.current) {
      textureLoaderRef.current = new THREE.TextureLoader();
    }

    if (!processedTextureUri || selectedSlot === null || selectedSlot === undefined) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const slot = resolveMeshSlot(child, maps);
          if (slot === null) return;
          const orig = originalMaterialsRef.current.get(slot);
          if (orig && child.material !== orig) {
            child.material = orig;
          }
        }
      });
      return;
    }

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const slot = resolveMeshSlot(child, maps);
        if (slot === null) return;
        if (slot === selectedSlot) {
          textureLoaderRef.current!.load(processedTextureUri, (texture) => {
            if (currentVersion !== overrideVersionRef.current) return;
            const newMat = (child.material as THREE.MeshStandardMaterial).clone();
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            const dim = modelDimensionsRef.current;
            if (
              scaleU > 0 &&
              scaleV > 0 &&
              texture.image?.width &&
              texture.image?.height
            ) {
              texture.repeat.set(
                (scaleU * dim[0]) / texture.image.width,
                (scaleV * dim[1]) / texture.image.height
              );
            }
            newMat.map = texture;
            newMat.needsUpdate = true;
            child.material = newMat;
          });
        } else {
          const orig = originalMaterialsRef.current.get(slot);
          if (orig && child.material !== orig) {
            child.material = orig;
          }
        }
      }
    });
  }, [gltfLoaded, modelUrl, processedTextureUri, selectedSlot, scaleU, scaleV, slotMapsReady]);

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}
        style={{ background: '#e5e7eb' }}
      >
        <PreviewEnvironment>
          {modelUrl && (
            <Suspense
              fallback={
                <Box args={[0.5, 0.5, 0.5]}>
                  <meshStandardMaterial color="#ef4444" />
                </Box>
              }
            >
              <Gltf ref={handleGltfReady} src={modelUrl} scale={0.01} />
            </Suspense>
          )}
          {!modelUrl && (
            <mesh>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial color="#9ca3af" />
            </mesh>
          )}
        </PreviewEnvironment>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
