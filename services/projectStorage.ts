import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';
import { DesignObject } from '@/components/DesignScreen/3dView/DesignObjects';
import { Room3dProps } from '@/components/DesignScreen/3dView/Room3d';

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
  textureOverrides?: any[];
}

export interface ProjectStateDTO {
  metadata: ProjectMetadata;
  room: ProjectRoom;
  instances: ProjectInstance[];
}

export function serializeProjectState(room3d: Room3dProps, designObjects: DesignObject[]): ProjectStateDTO {
  return {
    metadata: {
      version: '1.0.0',
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
      textureOverrides: obj.textureOverrides,
    })),
  };
}

export async function deserializeProjectState(
  dto: ProjectStateDTO,
  getModelUrl: (modelId: string, version: number) => Promise<string | undefined>
): Promise<{ room: Room3dProps; objects: DesignObject[] }> {
  const objects = await Promise.all(dto.instances.map(async (inst) => {
    const modelUrl = await getModelUrl(inst.modelId, inst.version);
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
      textureOverrides: inst.textureOverrides,
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
