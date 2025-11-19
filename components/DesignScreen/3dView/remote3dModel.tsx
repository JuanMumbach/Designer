import { Box, Gltf } from '@react-three/drei/native';
import * as FileSystem from 'expo-file-system';
import React, { Suspense, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DesignObjectInstanceProps } from './DesignObjects'; // Asegúrate que la ruta sea correcta

/**
 * Hook personalizado para manejar la carga de activos remotos de forma
 * optimizada para React Native (descarga local) y Web (URL directa).
 */
export function useDownload3dModel(remoteUrl: string, assetName: string = 'asset') {
    // Uso de "use" en el nombre para adherirse a las convenciones de Hooks
    const [assetUri, setAssetUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!remoteUrl) {
            setIsLoading(false);
            return;
        }

        const loadAsset = async () => {
            setIsLoading(true);
            setError(null);

            // 1. Lógica para WEB
            if (Platform.OS === 'web') {
                // En la Web, usamos la URL de red directamente
                console.log("Cargando modelo directamente desde la red (Web).");
                setAssetUri(remoteUrl);
                setIsLoading(false);
                return; // Salir después de configurar el URI y la carga
            }

            // 2. Lógica para NATIVO (iOS/Android): Descargar primero
            try {
                // Genera una ruta de archivo local única
                const filename = assetName + remoteUrl.substring(remoteUrl.lastIndexOf('.')); 
                const localPath = FileSystem.documentDirectory + filename;

                // Opcional: Verificar si el archivo ya existe localmente
                const fileInfo = await FileSystem.getInfoAsync(localPath);
                if (fileInfo.exists) {
                    console.log("Modelo ya descargado. Usando caché local.");
                    setAssetUri(localPath);
                    return; // Retorna si está en caché
                }

                // Descargar el archivo
                console.log("Descargando modelo para uso local...");
                const { uri } = await FileSystem.downloadAsync(remoteUrl, localPath);
                setAssetUri(uri);

            } catch (err) {
                console.error("Error al descargar el archivo en nativo:", err);
                setError(err as Error);
            } finally {
                // Se asegura que la carga termine en ambos casos (éxito o error nativo)
                setIsLoading(false); 
            }
        };

        loadAsset();
    }, [remoteUrl, assetName]);

    return { localUri: assetUri, isLoading, error };
}

/**
 * Componente que envuelve el modelo 3D y maneja el estado de carga y error.
 */
export function RemoteModelInstance({ obj, position, origin, dimensions, modelScale, rotation, onObjectInteraction }: { 
    obj: DesignObjectInstanceProps, 
    position: [number, number, number], 
    origin: [number, number, number],
    dimensions: [number, number, number],
    modelScale?: number,
    modelUrl: string,
    rotation?: number
    onObjectInteraction: (object: DesignObjectInstanceProps) => void
}) {
    const url = obj.type.modelUrl;
    
    const { localUri, isLoading, error } = useDownload3dModel(url, obj.id);

    const handleInteraction = React.useCallback(() => {
        console.log("Object interaction from remote3dModel");
        onObjectInteraction(obj);
    }, [obj, onObjectInteraction]);

    const boxPosition: [number, number, number] = [
        origin[0] + position[0] + dimensions[0] / 2,
        origin[1] + position[1] + dimensions[1] / 2,
        origin[2] + position[2] + dimensions[2] / 2
    ];


    const modelPosition: [number, number, number] = [
        origin[0] + position[0],
        origin[1] + position[1],
        origin[2] + position[2]
    ];

    if (isLoading) {
        return (
            <Box key={obj.id} position={boxPosition} args={dimensions} >
                <meshStandardMaterial attach="material" color="black" />
            </Box>
        );
    }
    
    if (error || !localUri) {
        console.error("No se pudo cargar el modelo:", error);
        return (
            <Box key={obj.id} position={boxPosition} args={dimensions} >
                <meshStandardMaterial attach="material" color="red" />
            </Box>
        );
    }
    
    return (
        <Suspense key={obj.id} fallback={null}>
            <Gltf 
                src={localUri} // ✅ Se usa localUri para la ruta correcta (local o remota)
                position={modelPosition}
                rotation={[0, -Math.PI / 2 + (rotation || 0), 0]}
                scale={modelScale || 1}
                onDoubleClick={Platform.OS === 'web' ? handleInteraction : undefined}
                onPointerDown={Platform.OS !== 'web' ? (e) => {
                    // Inicia un temporizador para detectar una pulsación larga
                    const timer = setTimeout(() => {
                        handleInteraction();
                    }, 500); // 500 ms para una pulsación larga

                    // Limpia el temporizador si el usuario levanta el dedo antes
                    e.target.addEventListener('pointerup', () => clearTimeout(timer), { once: true });
                } : undefined}
            ></Gltf>
        </Suspense>
    );
}
