import { Box, Gltf } from '@react-three/drei/native';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import PreviewEnvironment from '../PreviewScene';

export default function MaterialPreview({
  modelUrl,
  textureUri,
  selectedMesh,
  onMeshesDiscovered,
  scaleU = 1,
  scaleV = 1,
}: {
  modelUrl: string | null;
  textureUri: string | null;
  selectedMesh: string | null;
  onMeshesDiscovered: (names: string[]) => void;
  scaleU?: number;
  scaleV?: number;
}) {
  const gltfRef = useRef<THREE.Group | null>(null);
  const originalMaterialsRef = useRef<Map<string, THREE.Material>>(new Map());
  const overrideVersionRef = useRef(0);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);
  const meshesDiscoveredRef = useRef(false);
  const modelDimensionsRef = useRef<[number, number, number]>([1, 1, 1]);
  const [gltfLoaded, setGltfLoaded] = useState(false);
  const [processedTextureUri, setProcessedTextureUri] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const onMeshesDiscoveredRef = useRef(onMeshesDiscovered);
  onMeshesDiscoveredRef.current = onMeshesDiscovered;

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
    meshesDiscoveredRef.current = false;
    originalMaterialsRef.current.clear();
  }, [modelUrl]);

  const handleGltfReady = useCallback((group: THREE.Group | null) => {
    gltfRef.current = group;
    if (!group) return;

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.material = child.material.clone();
      }
    });

    const names: string[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name) {
        names.push(child.name);
        if (!originalMaterialsRef.current.has(child.name)) {
          originalMaterialsRef.current.set(child.name, child.material.clone());
        }
      }
    });

    group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    modelDimensionsRef.current = [size.x || 1, size.y || 1, size.z || 1];

    setGltfLoaded(true);

    if (names.length > 0 && !meshesDiscoveredRef.current) {
      meshesDiscoveredRef.current = true;
      onMeshesDiscoveredRef.current(names);
    }
  }, []);

  useEffect(() => {
    const group = gltfRef.current;
    if (!group || !gltfLoaded || !modelUrl) return;

    overrideVersionRef.current++;
    const currentVersion = overrideVersionRef.current;

    if (!textureLoaderRef.current) {
      textureLoaderRef.current = new THREE.TextureLoader();
    }

    if (!processedTextureUri || !selectedMesh) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name) {
          const orig = originalMaterialsRef.current.get(child.name);
          if (orig && child.material !== orig) {
            child.material = orig;
          }
        }
      });
      return;
    }

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name) {
        if (child.name === selectedMesh) {
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
          const orig = originalMaterialsRef.current.get(child.name);
          if (orig && child.material !== orig) {
            child.material = orig;
          }
        }
      }
    });
  }, [gltfLoaded, modelUrl, processedTextureUri, selectedMesh, scaleU, scaleV]);

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
