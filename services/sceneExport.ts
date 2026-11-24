import * as THREE from 'three';
import { GLTFExporter, GLTFLoader } from 'three-stdlib';
import { Room3dProps } from '@/components/DesignScreen/3dView/Room3d';
import { resolveWallTileZones } from '@/components/DesignScreen/3dView/wallTiles';
import { AppliedMaterial, DesignObject, GlobalMaterials, MaterialOverrides, resolveGlobalMaterials } from '@/components/DesignScreen/3dView/DesignObjects';
import {
  buildSlotIndexMaps,
  resolveMeshSlot,
} from '@/services/materialSlots';
import { extractGlbParts, sanitizeNodeName } from '@/services/glbParts';
import { fitScaleFromSize, measureModelSizeInParent } from '@/services/modelFit';
import { normalizeTypeName, resolveMaterialValue } from '@/services/designMaterialDefaults';
import { ObjectMaterialType } from '@/services/api';
import { resolveActiveVariants, resolveVariantMeshes } from '@/services/variants';
import { exportSceneToCollada } from '@/services/colladaExporter';
import { createZipArchive, sanitizeFilenamePart, uint8ArrayToBase64 } from '@/services/imageExport';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

const wallThickness = 0.2;
const floorThickness = 0.2;

const TILE_DEPTH = 0.01;

async function addRoomToScene(
  scene: THREE.Scene,
  room3d: Room3dProps,
  designObjects: DesignObject[] = [],
  materialDataById?: Record<string, AppliedMaterial>,
  globalMaterials?: GlobalMaterials
) {
  const resolvedGlobals = globalMaterials ? resolveGlobalMaterials(globalMaterials) : {};
  const defaultGlobalTileId = resolvedGlobals['wall_tile'];
  const defaultGlobalWallId = resolvedGlobals['wall_base'];

  const createMat = async (materialId?: string, fallbackColor = '#a9a58f', width = 1, height = 1, tileScaleMultiplier?: number) => {
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor });
    const applied = materialId && materialDataById ? materialDataById[materialId] : undefined;
    if (applied?.fileURL) {
      try {
        const tex = await loadTextureAsync(applied.fileURL);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        const imgWidth = (tex.image as any)?.width || 1024;
        const imgHeight = (tex.image as any)?.height || 1024;
        const scaleU = applied.scaleU > 0 ? applied.scaleU : imgWidth;
        const scaleV = applied.scaleV > 0 ? applied.scaleV : imgHeight;
        const mult = tileScaleMultiplier !== undefined ? tileScaleMultiplier : 1;
        tex.repeat.set(
          Math.max(0.001, (scaleU * width * mult) / imgWidth),
          Math.max(0.001, (scaleV * height * mult) / imgHeight)
        );
        tex.offset.set(0, 0);
        mat.map = tex;
        mat.color.set('#ffffff');
        mat.needsUpdate = true;
      } catch (err) {
        console.warn('Failed to load wall export texture:', err);
      }
    }
    return mat;
  };

  const backConfig = room3d.walls?.back;
  const backMat = await createMat(backConfig?.materialId || defaultGlobalWallId, backConfig?.color || '#a9a58f', room3d.width, room3d.height);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#e0e3e3' });

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(room3d.width, room3d.height, wallThickness),
    backMat
  );
  backWall.position.set(0, room3d.height / 2, -0.1);
  backWall.name = 'back_wall';
  scene.add(backWall);

  const backTiles = resolveWallTileZones('back', room3d, designObjects, backConfig?.defaultTileMaterialId || defaultGlobalTileId);
  for (const tile of backTiles) {
    const tileMat = await createMat(tile.materialId, tile.color || '#e5e7eb', tile.width, tile.height, tile.tileScale ?? backConfig?.defaultTileScale ?? 1);
    const tileMesh = new THREE.Mesh(
      new THREE.BoxGeometry(tile.width, tile.height, TILE_DEPTH),
      tileMat
    );
    const centerX = -room3d.width / 2 + tile.start + tile.width / 2;
    const centerY = tile.bottom + tile.height / 2;
    tileMesh.position.set(centerX, centerY, TILE_DEPTH / 2);
    tileMesh.name = `tile_${tile.id}`;
    scene.add(tileMesh);
  }

  if (room3d.leftWall) {
    const leftConfig = room3d.walls?.left;
    const leftMat = await createMat(leftConfig?.materialId || defaultGlobalWallId, leftConfig?.color || '#a9a58f', room3d.depth, room3d.height);
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, room3d.height, room3d.depth + wallThickness),
      leftMat
    );
    leftWall.position.set(
      -room3d.width / 2 - wallThickness / 2,
      room3d.height / 2,
      room3d.depth / 2 - wallThickness / 2
    );
    leftWall.name = 'left_wall';
    scene.add(leftWall);

    const leftTiles = resolveWallTileZones('left', room3d, designObjects, leftConfig?.defaultTileMaterialId || defaultGlobalTileId);
    for (const tile of leftTiles) {
      const tileMat = await createMat(tile.materialId, tile.color || '#e5e7eb', tile.width, tile.height, tile.tileScale ?? leftConfig?.defaultTileScale ?? 1);
      const tileMesh = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_DEPTH, tile.height, tile.width),
        tileMat
      );
      const centerZ = tile.start + tile.width / 2;
      const centerY = tile.bottom + tile.height / 2;
      tileMesh.position.set(-room3d.width / 2 + TILE_DEPTH / 2, centerY, centerZ);
      tileMesh.name = `tile_${tile.id}`;
      scene.add(tileMesh);
    }
  }

  if (room3d.rightWall) {
    const rightConfig = room3d.walls?.right;
    const rightMat = await createMat(rightConfig?.materialId || defaultGlobalWallId, rightConfig?.color || '#a9a58f', room3d.depth, room3d.height);
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, room3d.height, room3d.depth + wallThickness),
      rightMat
    );
    rightWall.position.set(
      room3d.width / 2 + wallThickness / 2,
      room3d.height / 2,
      room3d.depth / 2 - wallThickness / 2
    );
    rightWall.name = 'right_wall';
    scene.add(rightWall);

    const rightTiles = resolveWallTileZones('right', room3d, designObjects, rightConfig?.defaultTileMaterialId || defaultGlobalTileId);
    for (const tile of rightTiles) {
      const tileMat = await createMat(tile.materialId, tile.color || '#e5e7eb', tile.width, tile.height, tile.tileScale ?? rightConfig?.defaultTileScale ?? 1);
      const tileMesh = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_DEPTH, tile.height, tile.width),
        tileMat
      );
      const centerZ = tile.start + tile.width / 2;
      const centerY = tile.bottom + tile.height / 2;
      tileMesh.position.set(room3d.width / 2 - TILE_DEPTH / 2, centerY, centerZ);
      tileMesh.name = `tile_${tile.id}`;
      scene.add(tileMesh);
    }
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

async function attachGlbTextureBytes(gltf: {
  scene: THREE.Group;
  parser?: {
    associations?: Map<unknown, { textures?: number }>;
    json?: {
      textures?: { source?: number }[];
      images?: { bufferView?: number; uri?: string }[];
    };
    getDependency?: (type: string, index: number) => Promise<ArrayBuffer>;
  };
}): Promise<void> {
  const parser = gltf.parser;
  if (!parser?.associations || !parser.json || typeof parser.getDependency !== 'function') return;

  const seen = new Set<THREE.Texture>();
  const tasks: Promise<void>[] = [];

  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      const map = (mat as { map?: unknown }).map;
      if (!(map instanceof THREE.Texture) || seen.has(map)) continue;
      seen.add(map);

      const assoc = parser.associations?.get(map);
      if (typeof assoc?.textures !== 'number') continue;
      const texDef = parser.json?.textures?.[assoc.textures];
      if (typeof texDef?.source !== 'number') continue;
      const imgDef = parser.json?.images?.[texDef.source];
      if (!imgDef) continue;

      if (typeof imgDef.bufferView === 'number') {
        const bufferViewIndex = imgDef.bufferView;
        tasks.push(
          parser
            .getDependency!('bufferView', bufferViewIndex)
            .then((buf) => {
              if (buf instanceof ArrayBuffer && buf.byteLength > 0) {
                map.userData = { ...map.userData, sourceBytes: new Uint8Array(buf) };
              }
            })
            .catch(() => {})
        );
      } else if (typeof imgDef.uri === 'string') {
        map.userData = { ...map.userData, sourceUrl: imgDef.uri };
      }
    }
  });

  await Promise.all(tasks);
}

function loadGLBFromUrl(url: string): Promise<{ group: THREE.Group; bytes: Uint8Array }> {
  return new Promise<{ group: THREE.Group; bytes: Uint8Array }>(async (resolve, reject) => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        async (gltf) => {
          try {
            await attachGlbTextureBytes(gltf as unknown as Parameters<typeof attachGlbTextureBytes>[0]);
          } catch {}
          resolve({ group: gltf.scene, bytes });
        },
        (error) => reject(error)
      );
    } catch (err) {
      reject(err);
    }
  });
}

function loadTextureAsync(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.userData = { ...texture.userData, sourceUrl: url };
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

async function applyMaterialOverrides(
  group: THREE.Group,
  materialOverrides: MaterialOverrides | undefined,
  materialDataById: Record<string, AppliedMaterial> | undefined,
  maps: ReturnType<typeof buildSlotIndexMaps>,
  globalMaterials: GlobalMaterials,
  slotTypes: ObjectMaterialType[] | null,
  typeToDesignSlot: Record<string, string>,
  dimensions: [number, number, number]
) {
  if ((!materialOverrides || Object.keys(materialOverrides).length === 0) && Object.keys(globalMaterials).length === 0) return;

  const resolvedGlobals = resolveGlobalMaterials(globalMaterials);
  const tasks: Promise<void>[] = [];

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const slot = resolveMeshSlot(child, maps);
      if (slot === null) return;

      let materialId: string | undefined;
      const overrideValue = materialOverrides?.[slot];
      if (overrideValue) {
        materialId = resolveMaterialValue(overrideValue, globalMaterials);
      }
      if (!materialId && Object.keys(globalMaterials).length > 0) {
        const slotType = slotTypes?.find(t => t.slot === slot);
        const typeName = slotType?.materialTypeName || slotType?.materialTypeId || '';
        const designKey = typeName ? typeToDesignSlot[normalizeTypeName(typeName)] : undefined;
        if (designKey && resolvedGlobals[designKey]) {
          materialId = resolvedGlobals[designKey];
        } else {
          const material = child.material as THREE.Material;
          const slotName = material.name || sanitizeNodeName(child.name);
          materialId = resolvedGlobals[slotName];
        }
      }

      const override = materialId ? materialDataById?.[materialId] : undefined;
      if (!override || !override.fileURL) return;

      tasks.push(
        loadTextureAsync(override.fileURL)
          .then((texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;

            if (
              override.scaleU > 0 &&
              override.scaleV > 0 &&
              texture.image?.width &&
              texture.image?.height
            ) {
              texture.repeat.set(
                (override.scaleU * dimensions[0]) / texture.image.width,
                (override.scaleV * dimensions[1]) / texture.image.height
              );
            }

            const newMat = (child.material as THREE.MeshStandardMaterial).clone();
            newMat.map = texture;
            newMat.needsUpdate = true;
            child.material = newMat;
          })
          .catch((err) => {
            console.warn(`Export: failed to load material texture ${override.fileURL}:`, err);
          })
      );
    }
  });

  await Promise.all(tasks);
}

async function addFurnitureToScene(
  scene: THREE.Scene,
  designObjects: DesignObject[],
  room3d: Room3dProps,
  materialDataById: Record<string, AppliedMaterial>,
  globalMaterials: GlobalMaterials,
  slotTypesByModel: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot: Record<string, string>,
  onProgress?: (current: number, total: number) => void,
  defaultHandleType?: string | null
) {
  const origin: [number, number, number] = [-(room3d.width) / 2, 0, 0];
  const total = designObjects.length;

  for (let i = 0; i < total; i++) {
    const obj = designObjects[i];
    const activeVariants = resolveActiveVariants(
      obj.variants ?? [],
      obj.objectProperties?.defaultVariants,
      obj.selectedVariants,
      defaultHandleType
    );
    const { primaryModelUrl, additiveMeshes } = resolveVariantMeshes(obj.modelUrl, activeVariants);

    try {
      const { group: modelGroup, bytes } = await loadGLBFromUrl(primaryModelUrl);

      const maps = buildSlotIndexMaps(extractGlbParts(bytes));

      const container = new THREE.Group();
      container.position.set(
        origin[0] + obj.position[0],
        origin[1] + obj.position[1],
        origin[2] + obj.position[2]
      );
      container.rotation.set(0, obj.rotation || 0, 0);

      modelGroup.rotation.set(0, -Math.PI / 2, 0);
      modelGroup.scale.set(0.01, 0.01, 0.01);
      container.add(modelGroup);

      let targetParent: THREE.Group = container;
      const fitScale = fitScaleFromSize(measureModelSizeInParent(modelGroup), obj.dimensions);
      if (fitScale) {
        const fitGroup = new THREE.Group();
        fitGroup.scale.set(fitScale[0], fitScale[1], fitScale[2]);
        fitGroup.add(modelGroup);
        container.add(fitGroup);
        targetParent = fitGroup;
      }

      const slotTypes = slotTypesByModel[`${obj.modelId}:${obj.version}`] ?? null;

      for (const variant of additiveMeshes) {
        try {
          const { group: variantGroup, bytes: variantBytes } = await loadGLBFromUrl(variant.fileURL);
          variantGroup.rotation.set(0, -Math.PI / 2, 0);
          variantGroup.scale.set(0.01, 0.01, 0.01);
          targetParent.add(variantGroup);
          try {
            const variantMaps = buildSlotIndexMaps(extractGlbParts(variantBytes));
            await applyMaterialOverrides(variantGroup, obj.materialOverrides, materialDataById, variantMaps, globalMaterials, slotTypes, typeToDesignSlot, obj.dimensions);
          } catch (materialErr) {
            console.warn(`Failed to apply materials to additive variant ${variant.name}:`, materialErr);
          }
        } catch (variantErr) {
          console.warn(`Failed to export additive variant ${variant.name}:`, variantErr);
        }
      }

      await applyMaterialOverrides(modelGroup, obj.materialOverrides, materialDataById, maps, globalMaterials, slotTypes, typeToDesignSlot, obj.dimensions);

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

async function saveBinaryFile(
  uint8Array: Uint8Array,
  filename: string,
  mimeType: string,
  dialogTitle: string,
  uti: string
): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([uint8Array], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      mimeType,
      dialogTitle,
      UTI: uti,
    });
  } else {
    Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
  }
}

async function saveGLB(uint8Array: Uint8Array): Promise<void> {
  const filename = `designer_scene_${Date.now()}.glb`;
  await saveBinaryFile(uint8Array, filename, 'model/gltf-binary', 'Export 3D Scene', 'public.gltf-binary');
}

async function buildExportScene(
  room3d: Room3dProps,
  designObjects: DesignObject[],
  materialDataById: Record<string, AppliedMaterial>,
  globalMaterials: GlobalMaterials,
  slotTypesByModel: Record<string, ObjectMaterialType[]>,
  typeToDesignSlot: Record<string, string>,
  onProgress?: (current: number, total: number) => void,
  defaultHandleType?: string | null
): Promise<THREE.Scene> {
  const scene = new THREE.Scene();
  await addRoomToScene(scene, room3d, designObjects, materialDataById, globalMaterials);
  await addFurnitureToScene(scene, designObjects, room3d, materialDataById, globalMaterials, slotTypesByModel, typeToDesignSlot, onProgress, defaultHandleType);
  return scene;
}

export async function exportSceneAsGLB(
  room3d: Room3dProps,
  designObjects: DesignObject[],
  materialDataById: Record<string, AppliedMaterial> = {},
  globalMaterials: GlobalMaterials = {},
  slotTypesByModel: Record<string, ObjectMaterialType[]> = {},
  typeToDesignSlot: Record<string, string> = {},
  onProgress?: (current: number, total: number) => void,
  defaultHandleType?: string | null
): Promise<void> {
  const scene = await buildExportScene(room3d, designObjects, materialDataById, globalMaterials, slotTypesByModel, typeToDesignSlot, onProgress, defaultHandleType);

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

export async function exportSceneAsDAE(
  room3d: Room3dProps,
  designObjects: DesignObject[],
  materialDataById: Record<string, AppliedMaterial> = {},
  globalMaterials: GlobalMaterials = {},
  slotTypesByModel: Record<string, ObjectMaterialType[]> = {},
  typeToDesignSlot: Record<string, string> = {},
  projectName?: string,
  onProgress?: (current: number, total: number) => void,
  defaultHandleType?: string | null
): Promise<void> {
  const scene = await buildExportScene(
    room3d,
    designObjects,
    materialDataById,
    globalMaterials,
    slotTypesByModel,
    typeToDesignSlot,
    onProgress,
    defaultHandleType
  );

  const { dae, textures } = await exportSceneToCollada(scene, {
    textureDirectory: 'textures',
    authoringTool: 'Designer 3D Exporter',
    upAxis: 'Z_UP',
    unitMeter: 1,
    unitName: 'meter',
  });

  const safeProjectName = sanitizeFilenamePart(projectName || 'Project', 'Project');
  const daeBytes = new TextEncoder().encode(dae);
  const archiveFiles: { filename: string; data: Uint8Array }[] = [
    { filename: `${safeProjectName}.dae`, data: daeBytes },
    ...textures.map((tex) => ({ filename: tex.path, data: tex.data })),
  ];

  const zipBytes = createZipArchive(archiveFiles);
  await saveBinaryFile(
    zipBytes,
    `${safeProjectName}_dae.zip`,
    'application/zip',
    'Export 3D Scene (.dae)',
    'public.zip-archive'
  );
}


