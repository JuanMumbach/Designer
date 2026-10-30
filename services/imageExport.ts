import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

export interface ExportImageItem {
  filename: string;
  dataUrl?: string;
  base64?: string;
  bytes?: Uint8Array;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function sanitizeFilenamePart(value: string, fallback = 'Item'): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export function buildImageFilename(
  projectName: string | undefined,
  viewName: string,
  width: number,
  height: number
): string {
  const safeProject = sanitizeFilenamePart(projectName || 'Project', 'Project');
  const safeView = sanitizeFilenamePart(viewName || 'View', 'View');
  return `${safeProject}_${safeView}_${Math.round(width)}x${Math.round(height)}.png`;
}

function getItemBytes(item: ExportImageItem): Uint8Array {
  if (item.bytes) return item.bytes;
  if (item.base64) return base64ToUint8Array(item.base64);
  if (item.dataUrl) return base64ToUint8Array(item.dataUrl);
  return new Uint8Array(0);
}

function getItemBase64(item: ExportImageItem): string {
  if (item.base64) return item.base64.replace(/^data:[^;]+;base64,/, '');
  if (item.dataUrl) return item.dataUrl.replace(/^data:[^;]+;base64,/, '');
  if (item.bytes) return uint8ArrayToBase64(item.bytes);
  return '';
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDosTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

export function createZipArchive(files: { filename: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  const { dosTime, dosDate } = dateToDosTime(now);

  const usedNames = new Map<string, number>();
  const entries = files.map((file) => {
    let finalName = file.filename;
    const count = usedNames.get(finalName) ?? 0;
    usedNames.set(finalName, count + 1);
    if (count > 0) {
      const dotIdx = finalName.lastIndexOf('.');
      if (dotIdx > 0) {
        finalName = `${finalName.slice(0, dotIdx)}_${count}${finalName.slice(dotIdx)}`;
      } else {
        finalName = `${finalName}_${count}`;
      }
    }
    const nameBytes = encoder.encode(finalName);
    const crc = crc32(file.data);
    return {
      nameBytes,
      data: file.data,
      crc,
    };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const entry of entries) {
    localSize += 30 + entry.nameBytes.length + entry.data.length;
    centralSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localSize + centralSize + 22;
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  let localOffset = 0;
  const offsets: number[] = [];

  for (const entry of entries) {
    offsets.push(localOffset);
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 0x0800, true);
    view.setUint16(localOffset + 8, 0, true);
    view.setUint16(localOffset + 10, dosTime, true);
    view.setUint16(localOffset + 12, dosDate, true);
    view.setUint32(localOffset + 14, entry.crc, true);
    view.setUint32(localOffset + 18, entry.data.length, true);
    view.setUint32(localOffset + 22, entry.data.length, true);
    view.setUint16(localOffset + 26, entry.nameBytes.length, true);
    view.setUint16(localOffset + 28, 0, true);
    buffer.set(entry.nameBytes, localOffset + 30);
    buffer.set(entry.data, localOffset + 30 + entry.nameBytes.length);
    localOffset += 30 + entry.nameBytes.length + entry.data.length;
  }

  const centralDirStart = localOffset;
  let centralOffset = centralDirStart;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const headerOffset = offsets[i];
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint16(centralOffset + 4, 20, true);
    view.setUint16(centralOffset + 6, 20, true);
    view.setUint16(centralOffset + 8, 0x0800, true);
    view.setUint16(centralOffset + 10, 0, true);
    view.setUint16(centralOffset + 12, dosTime, true);
    view.setUint16(centralOffset + 14, dosDate, true);
    view.setUint32(centralOffset + 16, entry.crc, true);
    view.setUint32(centralOffset + 20, entry.data.length, true);
    view.setUint32(centralOffset + 24, entry.data.length, true);
    view.setUint16(centralOffset + 28, entry.nameBytes.length, true);
    view.setUint16(centralOffset + 30, 0, true);
    view.setUint16(centralOffset + 32, 0, true);
    view.setUint16(centralOffset + 34, 0, true);
    view.setUint16(centralOffset + 36, 0, true);
    view.setUint32(centralOffset + 38, 0, true);
    view.setUint32(centralOffset + 42, headerOffset, true);
    buffer.set(entry.nameBytes, centralOffset + 46);
    centralOffset += 46 + entry.nameBytes.length;
  }

  const eocdOffset = centralOffset;
  view.setUint32(eocdOffset, 0x06054b50, true);
  view.setUint16(eocdOffset + 4, 0, true);
  view.setUint16(eocdOffset + 6, 0, true);
  view.setUint16(eocdOffset + 8, entries.length, true);
  view.setUint16(eocdOffset + 10, entries.length, true);
  view.setUint32(eocdOffset + 12, centralSize, true);
  view.setUint32(eocdOffset + 16, centralDirStart, true);
  view.setUint16(eocdOffset + 20, 0, true);

  return buffer;
}

export async function downloadSingleImage(item: ExportImageItem): Promise<void> {
  if (Platform.OS === 'web') {
    const bytes = getItemBytes(item);
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const base64 = getItemBase64(item);
  const fileUri = `${FileSystem.cacheDirectory}${item.filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (isSharingAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/png',
      dialogTitle: item.filename,
      UTI: 'public.png',
    });
  } else {
    Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
  }
}

export async function downloadImagesIndividually(items: ExportImageItem[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await downloadSingleImage(items[i]);
    if (Platform.OS === 'web' && i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

export async function downloadImagesAsZip(
  items: ExportImageItem[],
  zipFilename: string = 'Exported_Images.zip'
): Promise<void> {
  const archiveBytes = createZipArchive(
    items.map((item) => ({
      filename: item.filename,
      data: getItemBytes(item),
    }))
  );

  if (Platform.OS === 'web') {
    const blob = new Blob([archiveBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const finalZipName = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  const fileUri = `${FileSystem.cacheDirectory}${finalZipName}`;
  const base64 = uint8ArrayToBase64(archiveBytes);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (isSharingAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/zip',
      dialogTitle: finalZipName,
      UTI: 'public.zip-archive',
    });
  } else {
    Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
  }
}
