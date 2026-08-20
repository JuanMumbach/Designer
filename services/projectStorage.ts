import { DesignObject, TextureOverride } from '@/components/DesignScreen/3dView/DesignObjects';
import { Room3dProps } from '@/components/DesignScreen/3dView/Room3d';
import { createProject, createProjectVersion, MaterialData, Project } from '@/services/api';
import { uploadFileToFirebase } from '@/services/firebaseSetup';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export interface ProjectMetadata {
  version: string;
  savedAt: string;
}

export interface ProjectRoom {
  width: number;
  height: number;
  depth: number;
  leftWall: boolean;
  rightWall: boolean;
}

export interface ProjectTextureOverride {
  slotName: string;
  materialId: string;
  version: number;
}

export interface ProjectInstance {
  id: string;
  name: string;
  modelId: string;
  version: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  objectProperties?: any;
  textureOverrides?: ProjectTextureOverride[];
}

export interface ProjectStateDTO {
  metadata: ProjectMetadata;
  room: ProjectRoom;
  instances: ProjectInstance[];
}

export function serializeProjectState(room3d: Room3dProps, designObjects: DesignObject[]): ProjectStateDTO {
  return {
    metadata: {
      version: '2.0.0',
      savedAt: new Date().toISOString(),
    },
    room: {
      width: room3d.width,
      height: room3d.height,
      depth: room3d.depth,
      leftWall: room3d.leftWall,
      rightWall: room3d.rightWall,
    },
    instances: designObjects.map((obj) => ({
      id: obj.id,
      name: obj.name,
      modelId: obj.modelId,
      version: obj.version,
      position: obj.position,
      rotation: [0, obj.rotation, 0],
      scale: obj.dimensions,
      color: obj.color,
      objectProperties: obj.objectProperties,
      textureOverrides: (obj.textureOverrides ?? [])
        .filter((ov) => !!ov.meshName && !!ov.materialId && typeof ov.version === 'number')
        .map((ov) => ({
          slotName: ov.meshName,
          materialId: ov.materialId,
          version: ov.version,
        })),
    })),
  };
}

export async function deserializeProjectState(
  dto: ProjectStateDTO,
  getModelUrl: (modelId: string, version: number) => Promise<string | undefined>,
  getMaterialData: (materialId: string, version: number) => Promise<MaterialData | undefined>
): Promise<{ room: Room3dProps; objects: DesignObject[] }> {
  const objects = await Promise.all(dto.instances.map(async (inst) => {
    const modelUrl = await getModelUrl(inst.modelId, inst.version);

    const overrides = await Promise.all((inst.textureOverrides ?? []).map(async (ov) => {
      if (!ov || typeof ov.slotName !== 'string' || !ov.materialId || typeof ov.version !== 'number') {
        return null;
      }
      const materialData = await getMaterialData(ov.materialId, ov.version);
      if (!materialData) {
        console.warn(`Could not resolve material ${ov.materialId} v${ov.version} for slot "${ov.slotName}".`);
        return null;
      }
      const override: TextureOverride = {
        meshName: ov.slotName,
        materialId: ov.materialId,
        version: ov.version,
        fileURL: materialData.fileURL,
        scaleU: materialData.scaleU,
        scaleV: materialData.scaleV,
      };
      return override;
    }));

    return {
      id: inst.id,
      modelId: inst.modelId,
      version: inst.version,
      name: inst.name,
      position: inst.position,
      rotation: inst.rotation[1],
      dimensions: inst.scale,
      color: inst.color || '#ffffff',
      modelUrl: modelUrl || '', // What if modelUrl is undefined?
      objectProperties: inst.objectProperties,
      textureOverrides: overrides.filter((o): o is TextureOverride => o !== null),
    };
  }));

  return {
    room: {
      width: dto.room.width,
      height: dto.room.height,
      depth: dto.room.depth,
      leftWall: dto.room.leftWall,
      rightWall: dto.room.rightWall,
    },
    objects,
  };
}

export async function saveProject(projectState: ProjectStateDTO, filename: string = 'project.json'): Promise<void> {
  try {
    const jsonString = JSON.stringify(projectState, null, 2);

    if (Platform.OS === 'web') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Project',
        UTI: 'public.json',
      });
    } else {
      Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
    }
  } catch (error) {
    console.error('Error saving project:', error);
    Alert.alert('Error', 'Failed to save the project.');
  }
}

export async function loadProject(): Promise<ProjectStateDTO | null> {
  try {
    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (!files || files.length === 0) {
            resolve(null);
            return;
          }
          const file = files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const parsed = JSON.parse(event.target?.result as string);
              resolve(parsed as ProjectStateDTO);
            } catch (err) {
              Alert.alert('Error', 'Invalid JSON file format.');
              resolve(null);
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const selectedFile = result.assets[0];
    const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri);
    const projectState = JSON.parse(fileContent);

    if (!projectState.metadata || !projectState.room || !Array.isArray(projectState.instances)) {
      Alert.alert('Error', 'Invalid project file structure.');
      return null;
    }

    return projectState as ProjectStateDTO;
  } catch (error) {
    console.error('Error loading project:', error);
    Alert.alert('Error', 'Failed to load the project.');
    return null;
  }
}

export async function saveProjectToCloud(
  projectState: ProjectStateDTO,
  projectId: string,
  creatorId: string,
  description?: string,
  filename: string = 'project.json'
): Promise<string> {
  const jsonString = JSON.stringify(projectState, null, 2);
  let uri: string;

  if (Platform.OS === 'web') {
    const blob = new Blob([jsonString], { type: 'application/json' });
    uri = URL.createObjectURL(blob);
  } else {
    uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  try {
    const fileURL = await uploadFileToFirebase(uri, 'projects', filename);
    await createProjectVersion(projectId, {
      content: fileURL,
      creatorId,
      ...(description ? { description } : {}),
    });
    return fileURL;
  } finally {
    if (Platform.OS === 'web') {
      URL.revokeObjectURL(uri);
    }
  }
}

export async function createProjectInCloud(
  projectState: ProjectStateDTO,
  options: {
    name: string;
    workspaceId: string;
    creatorId: string;
    description?: string;
  }
): Promise<{ project: Project; fileURL: string }> {
  const project = await createProject({
    name: options.name,
    workspaceId: options.workspaceId,
    creatorId: options.creatorId,
  });
  const safeName = options.name.trim().replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileURL = await saveProjectToCloud(
    projectState,
    project.id,
    options.creatorId,
    options.description,
    `${safeName || 'project'}.json`
  );
  return { project, fileURL };
}

export async function loadProjectFromCloud(
  fileURL: string
): Promise<ProjectStateDTO | null> {
  try {
    const response = await fetch(fileURL);
    if (!response.ok) {
      throw new Error(`Failed to download project: ${response.status}`);
    }
    const fileContent = await response.text();
    const projectState = JSON.parse(fileContent);

    if (!projectState.metadata || !projectState.room || !Array.isArray(projectState.instances)) {
      Alert.alert('Error', 'Invalid project file structure.');
      return null;
    }

    return projectState as ProjectStateDTO;
  } catch (error) {
    console.error('Error loading project from cloud:', error);
    Alert.alert('Error', 'Failed to load the project from cloud.');
    return null;
  }
}
