import * as THREE from 'three';
import { GLTFExporter, GLTFLoader } from 'three-stdlib';
import { Room3dProps } from '@/components/DesignScreen/3dView/Room3d';
import { DesignObject, TextureOverride } from '@/components/DesignScreen/3dView/DesignObjects';
import { getMeshSlotName } from '@/services/materialSlots';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

const wallThickness = 0.2;
const floorThickness = 0.2;

function addRoomToScene(scene: THREE.Scene, room3d: Room3dProps) {
  const wallMat = new THREE.MeshStandardMaterial({ color: '#a9a58f' });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#e0e3e3' });

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(room3d.width, room3d.height, wallThickness),
    wallMat
  );
  backWall.position.set(0, room3d.height / 2, -0.1);
  backWall.name = 'back_wall';
  scene.add(backWall);

  if (room3d.leftWall) {
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, room3d.height, room3d.depth + wallThickness),
      wallMat
    );
    leftWall.position.set(
      -room3d.width / 2 - wallThickness / 2,
      room3d.height / 2,
      room3d.depth / 2 - wallThickness / 2
    );
    leftWall.name = 'left_wall';
    scene.add(leftWall);
  }

  if (room3d.rightWall) {
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, room3d.height, room3d.depth + wallThickness),
      wallMat
    );
    rightWall.position.set(
      room3d.width / 2 + wallThickness / 2,
      room3d.height / 2,
      room3d.depth / 2 - wallThickness / 2
    );
    rightWall.name = 'right_wall';
    scene.add(rightWall);
  }

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(
      room3d.width + wallThickness * 2,
      floorThickness,
      room3d.depth + wallThickness
    ),
    floorMat
  );
  floor.position.set(0, -floorThickness / 2, room3d.depth / 2 - wallThickness / 2);
  floor.name = 'floor';
  scene.add(floor);
}

function loadGLBFromUrl(url: string): Promise<THREE.Group> {
  return new Promise<THREE.Group>(async (resolve, reject) => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => resolve(gltf.scene),
        (error) => reject(error)
      );
    } catch (err) {
      reject(err);
    }
  });
}

function applyTextureOverrides(
  group: THREE.Group,
  textureOverrides: TextureOverride[]
) {
  if (!textureOverrides || textureOverrides.length === 0) return;

  const textureLoader = new THREE.TextureLoader();

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const slotName = getMeshSlotName(child);
      const override = textureOverrides.find(
        (t) => t.meshName === slotName || t.meshName === child.name
      );
      if (override && override.fileURL) {
        const texture = textureLoader.load(override.fileURL);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        if (override.scaleU > 0 && override.scaleV > 0) {
          texture.repeat.set(override.scaleU, override.scaleV);
        }

        const newMat = (child.material as THREE.MeshStandardMaterial).clone();
        newMat.map = texture;
        newMat.needsUpdate = true;
        child.material = newMat;
      }
    }
  });
}

async function addFurnitureToScene(
  scene: THREE.Scene,
  designObjects: DesignObject[],
  room3d: Room3dProps,
  onProgress?: (current: number, total: number) => void
) {
  const origin: [number, number, number] = [-(room3d.width) / 2, 0, 0];
  const total = designObjects.length;

  for (let i = 0; i < total; i++) {
    const obj = designObjects[i];

    try {
      const modelGroup = await loadGLBFromUrl(obj.modelUrl);

      const container = new THREE.Group();
      container.position.set(
        origin[0] + obj.position[0],
        origin[1] + obj.position[1],
        origin[2] + obj.position[2]
      );
      container.rotation.set(0, obj.rotation || 0, 0);

      modelGroup.rotation.set(0, -Math.PI / 2, 0);
      modelGroup.scale.set(0.01, 0.01, 0.01);

      applyTextureOverrides(modelGroup, obj.textureOverrides || []);

      container.add(modelGroup);
      container.name = obj.name;
      scene.add(container);
    } catch (err) {
      console.warn(`Failed to load model ${obj.name}:`, err);
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(...obj.dimensions),
        new THREE.MeshStandardMaterial({ color: '#ff0000', transparent: true, opacity: 0.5 })
      );
      placeholder.position.set(
        origin[0] + obj.position[0] + obj.dimensions[0] / 2,
        origin[1] + obj.position[1] + obj.dimensions[1] / 2,
        origin[2] + obj.position[2] + obj.dimensions[2] / 2
      );
      placeholder.rotation.set(0, obj.rotation || 0, 0);
      placeholder.name = obj.name + '_placeholder';
      scene.add(placeholder);
    }

    onProgress?.(i + 1, total);
  }
}

function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

async function saveGLB(uint8Array: Uint8Array): Promise<void> {
  const filename = `designer_scene_${Date.now()}.glb`;

  if (Platform.OS === 'web') {
    const blob = new Blob([uint8Array], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = `${FileSystem.documentDirectory}${filename}`;
  const base64 = uint8ArrayToBase64(uint8Array);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (isSharingAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'model/gltf-binary',
      dialogTitle: 'Export 3D Scene',
      UTI: 'public.gltf-binary',
    });
  } else {
    Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
  }
}

async function buildExportScene(
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onProgress?: (current: number, total: number) => void
): Promise<THREE.Scene> {
  const scene = new THREE.Scene();
  addRoomToScene(scene, room3d);
  await addFurnitureToScene(scene, designObjects, room3d, onProgress);
  return scene;
}

export async function exportSceneAsGLB(
  room3d: Room3dProps,
  designObjects: DesignObject[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const scene = await buildExportScene(room3d, designObjects, onProgress);

  return new Promise<void>((resolve, reject) => {
    const exporter = new GLTFExporter();

    exporter.parse(
      scene,
      async (result) => {
        try {
          if (result instanceof ArrayBuffer) {
            await saveGLB(new Uint8Array(result));
          } else {
            console.warn('GLTFExporter returned JSON instead of binary');
            const jsonStr = JSON.stringify(result, null, 2);
            if (Platform.OS === 'web') {
              const blob = new Blob([jsonStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `designer_scene_${Date.now()}.gltf`;
              link.click();
              URL.revokeObjectURL(url);
            }
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      (error) => {
        console.error('GLTF export error:', error);
        reject(error);
      },
      { binary: true, trs: false, onlyVisible: true }
    );
  });
}


