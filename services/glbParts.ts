import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface GlbPart {
  materialIndex: number;
  materialName: string | null;
  identifier: string;
  displayName: string;
}

const GLB_MAGIC = 0x46546c67;

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const base64Lookup = (() => {
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }
  return lookup;
})();

function base64ToBytes(base64: string): Uint8Array {
  let bufferLength = Math.floor((base64.length * 3) / 4);
  const len = base64.length;
  if (len > 0 && base64[len - 1] === '=') bufferLength--;
  if (len > 1 && base64[len - 2] === '=') bufferLength--;
  const bytes = new Uint8Array(bufferLength);
  let offset = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const code = base64.charCodeAt(i);
    if (code === 61) break;
    if (code >= 128) continue;
    const value = base64Lookup[code];
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

export async function readGlbBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web' && uri.startsWith('file://')) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToBytes(base64);
  }
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch the .glb file (HTTP ${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export function sanitizeNodeName(name: string): string {
  return name.replace(/\s/g, '_').replace(/[\[\].:/]/g, '');
}

function parseGlbJson(bytes: Uint8Array): Record<string, unknown> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC || bytes.byteLength < 20) {
    throw new Error('The selected file is not a valid .glb file.');
  }
  const jsonLength = view.getUint32(12, true);
  const jsonStart = 20;
  if (jsonStart + jsonLength > bytes.byteLength) {
    throw new Error('The selected .glb file appears to be truncated.');
  }
  const jsonText = new TextDecoder('utf-8').decode(
    bytes.subarray(jsonStart, jsonStart + jsonLength)
  );
  return JSON.parse(jsonText);
}

export function extractGlbParts(bytes: Uint8Array): GlbPart[] {
  const gltf = parseGlbJson(bytes);
  const meshes = Array.isArray(gltf.meshes) ? (gltf.meshes as unknown[]) : [];
  const materials = Array.isArray(gltf.materials) ? (gltf.materials as unknown[]) : [];

  const namesUsed: Record<string, number> = {};
  const createUniqueName = (name: string): string => {
    if (name in namesUsed) {
      const next = ++namesUsed[name];
      return `${name}_${next}`;
    }
    namesUsed[name] = 0;
    return name;
  };

  const parts: GlbPart[] = [];
  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
    const meshDef = meshes[meshIndex] as
      | { name?: string; primitives?: unknown[] }
      | undefined;
    const meshName = meshDef?.name
      ? sanitizeNodeName(meshDef.name)
      : `mesh_${meshIndex}`;
    const primitives = Array.isArray(meshDef?.primitives)
      ? (meshDef.primitives as { material?: number }[])
      : [];

    for (const primitive of primitives) {
      const materialIndex = primitive?.material;
      const hasMaterial =
        typeof materialIndex === 'number' &&
        Number.isInteger(materialIndex) &&
        materialIndex >= 0;
      const materialDef = hasMaterial
        ? (materials[materialIndex as number] as { name?: string } | undefined)
        : undefined;
      const materialName = materialDef?.name ?? null;
      const identifier = createUniqueName(meshName);

      parts.push({
        materialIndex: hasMaterial ? (materialIndex as number) : -1,
        materialName,
        identifier,
        displayName: materialName ? materialName : identifier,
      });
    }
  }

  parts.sort((a, b) => a.materialIndex - b.materialIndex);
  return parts;
}