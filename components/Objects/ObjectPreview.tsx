import { Box, Gltf, OrbitControls } from '@react-three/drei/native';
import { Canvas } from '@react-three/fiber';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export default function ObjectPreview({ uri }: { uri: string | null }) {
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

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

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ position: [2, 2, 2], fov: 50 }}
        style={{ background: '#e5e7eb' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <OrbitControls enableDamping />
        <axesHelper args={[1]} position={[0, 0.01, 0]} />
        <gridHelper args={[20, 20]} />
        {processedUri && (
          <Suspense
            fallback={
              <Box args={[0.5, 0.5, 0.5]}>
                <meshStandardMaterial color="#ef4444" />
              </Box>
            }
          >
            <Gltf src={processedUri} scale={0.01} />
          </Suspense>
        )}
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
