import { Box, Gltf } from '@react-three/drei/native';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import PreviewEnvironment from '../PreviewScene';
import {
  buildSlotIndexMaps,
  resolveMeshSlot,
  SlotIndexMaps,
} from '../../../services/materialSlots';
import { extractGlbParts, readGlbBytes } from '../../../services/glbParts';

const RED = new THREE.Color('#ff2a2a');

function restoreMaterials(anim: {
  materials: THREE.MeshStandardMaterial[];
} | null, originals: Map<THREE.MeshStandardMaterial, THREE.Color>) {
  if (!anim) return;
  for (const mat of anim.materials) {
    const orig = originals.get(mat);
    if (orig) mat.color.copy(orig);
  }
}

function SlotFlash({
  groupRef,
  maps,
  highlightSlot,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  maps: SlotIndexMaps | null;
  highlightSlot: number | null;
}) {
  const originalsRef = useRef<Map<THREE.MeshStandardMaterial, THREE.Color>>(new Map());
  const animRef = useRef<{
    start: number;
    materials: THREE.MeshStandardMaterial[];
  } | null>(null);

  useEffect(() => {
    if (highlightSlot === null || highlightSlot === undefined) {
      restoreMaterials(animRef.current, originalsRef.current);
      animRef.current = null;
      return;
    }
    const group = groupRef.current;
    if (!group || !maps) return;

    const meshes: THREE.Mesh[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (resolveMeshSlot(child, maps) === highlightSlot) {
          meshes.push(child);
        }
      }
    });
    if (meshes.length === 0) return;

    const materials = meshes.map((m) => m.material) as THREE.MeshStandardMaterial[];
    for (const mat of materials) {
      if (!originalsRef.current.has(mat)) {
        originalsRef.current.set(mat, mat.color.clone());
      }
    }
    restoreMaterials(animRef.current, originalsRef.current);
    animRef.current = { start: performance.now(), materials };
  }, [highlightSlot, groupRef, maps]);

  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;

    const pulseDuration = 0.7;
    const pulses = 3;
    const total = pulseDuration * pulses;
    const elapsed = (performance.now() - anim.start) / 1000;

    if (elapsed >= total) {
      restoreMaterials(anim, originalsRef.current);
      animRef.current = null;
      return;
    }

    const t = elapsed / total;
    const wave = Math.sin(t * Math.PI * pulses);
    for (const mat of anim.materials) {
      const orig = originalsRef.current.get(mat);
      if (orig) {
        mat.color.lerpColors(orig, RED, wave);
      }
    }
  });

  return null;
}

export default function ObjectPreview({ uri, highlightSlot }: {
  uri: string | null;
  highlightSlot?: number | null;
}) {
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const gltfGroupRef = useRef<THREE.Group | null>(null);
  const [gltfLoaded, setGltfLoaded] = useState(false);
  const [maps, setMaps] = useState<SlotIndexMaps | null>(null);

  useEffect(() => {
    if (!uri) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setProcessedUri(null);
      return;
    }

    let cancelled = false;

    const prepare = async () => {
      let result = uri;
      if (Platform.OS === 'web' && uri.startsWith('file://')) {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        result = URL.createObjectURL(blob);
      }
      if (!cancelled) {
        if (objectUrlRef.current && objectUrlRef.current !== result) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = result.startsWith('blob:') ? result : null;
        setProcessedUri(result);
      }
    };

    prepare();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    setGltfLoaded(false);
    gltfGroupRef.current = null;
    setMaps(null);
  }, [uri]);

  useEffect(() => {
    if (!processedUri) return;
    let cancelled = false;
    (async () => {
      try {
        const bytes = await readGlbBytes(processedUri);
        const parts = extractGlbParts(bytes);
        const built = buildSlotIndexMaps(parts);
        if (!cancelled) setMaps(built);
      } catch (err) {
        console.warn('Failed to parse GLB material slots:', err);
        if (!cancelled) setMaps(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [processedUri]);

  const highlightMaps = (maps && gltfLoaded) ? maps : null;

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ position: [2, 2, 2], fov: 50 }}
        style={{ background: '#e5e7eb' }}
      >
        <PreviewEnvironment>
          {processedUri && (
            <Suspense
              fallback={
                <Box args={[0.5, 0.5, 0.5]}>
                  <meshStandardMaterial color="#ef4444" />
                </Box>
              }
            >
              <Gltf
                src={processedUri}
                scale={0.01}
                ref={(group) => {
                  gltfGroupRef.current = group;
                  if (group) setGltfLoaded(true);
                }}
              />
            </Suspense>
          )}
          <SlotFlash
            groupRef={gltfGroupRef}
            maps={highlightMaps}
            highlightSlot={highlightSlot ?? null}
          />
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