import { Platform } from 'react-native';
import {
  formatMeasurement,
  getElevationGaps,
  MeasurementWall,
  ModuleElevation,
  WallView,
} from './measurements';
import type { Room3dProps } from '../components/DesignScreen/3dView/Room3d';
import {
  ElevationCaptureResult,
  encodeRgbaToPngBytes,
} from '../components/DesignScreen/Measurements/MeasurementModels';
import { base64ToUint8Array, uint8ArrayToBase64 } from './imageExport';

export type MeasurementResolutionPreset = 'standard' | 'high' | 'ultra' | 'custom';

export interface MeasurementExportOptions {
  resolutionPreset: MeasurementResolutionPreset;
  customWidth: number;
  projectName?: string;
}

export interface MeasurementGeometryLayout {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  baseScale: number;
  originX: number;
  originY: number;
  drawingWidth: number;
  drawingHeight: number;
  wallTop: number;
}

export interface MeasurementDocumentDimensions {
  diagramWidth: number;
  diagramHeight: number;
  totalBaseWidth: number;
  totalBaseHeight: number;
  aspectRatio: number;
  targetWidth: number;
  targetHeight: number;
  scaleFactor: number;
}

export function computeWallGeometry(
  wall: MeasurementWall,
  room: Room3dProps,
  modules: ModuleElevation[],
  referenceWidth: number = 960
): MeasurementGeometryLayout {
  const minX = Math.min(0, ...modules.map((m) => m.left));
  const maxX = Math.max(wall.width, ...modules.map((m) => m.left + m.width));
  const minY = Math.min(0, ...modules.map((m) => m.bottom));
  const maxY = Math.max(room.height, ...modules.map((m) => m.bottom + m.height));

  const spanX = Math.max(0.1, maxX - minX);
  const spanY = Math.max(0.1, maxY - minY);

  const baseScale = Math.max(
    48,
    Math.min(Math.max(360, referenceWidth - 160) / spanX, 460 / spanY)
  );
  const originX = 64 - minX * baseScale;
  const originY = 72 + maxY * baseScale;
  const drawingWidth = Math.round(Math.max(640, spanX * baseScale + 160));
  const drawingHeight = Math.round(spanY * baseScale + 160);
  const wallTop = originY - room.height * baseScale;

  return {
    minX,
    maxX,
    minY,
    maxY,
    baseScale,
    originX,
    originY,
    drawingWidth,
    drawingHeight,
    wallTop,
  };
}

export function getPresetTargetWidth(preset: MeasurementResolutionPreset, customWidth: number): number {
  switch (preset) {
    case 'standard':
      return 1280;
    case 'high':
      return 1920;
    case 'ultra':
      return 2880;
    case 'custom':
    default:
      return Math.max(480, Math.min(4096, Math.round(customWidth || 1600)));
  }
}

export function computeDocumentDimensions(
  geometry: MeasurementGeometryLayout,
  options: MeasurementExportOptions
): MeasurementDocumentDimensions {
  const diagramWidth = geometry.drawingWidth;
  const diagramHeight = geometry.drawingHeight;

  const totalBaseWidth = diagramWidth;
  const totalBaseHeight = diagramHeight;

  const aspectRatio = totalBaseWidth / Math.max(1, totalBaseHeight);
  const targetWidth = getPresetTargetWidth(options.resolutionPreset, options.customWidth);
  const targetHeight = Math.max(240, Math.round(targetWidth / aspectRatio));
  const scaleFactor = targetWidth / totalBaseWidth;

  return {
    diagramWidth,
    diagramHeight,
    totalBaseWidth,
    totalBaseHeight,
    aspectRatio,
    targetWidth,
    targetHeight,
    scaleFactor,
  };
}

function loadWebImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function fillPixelRect(
  buf: Uint8Array,
  bufW: number,
  bufH: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number = 255
) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(bufW, Math.round(x + w));
  const y1 = Math.min(bufH, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const idx = (py * bufW + px) * 4;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }
}

function strokePixelRect(
  buf: Uint8Array,
  bufW: number,
  bufH: number,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
  r: number,
  g: number,
  b: number
) {
  const t = Math.max(1, Math.round(thickness));
  fillPixelRect(buf, bufW, bufH, x, y, w, t, r, g, b);
  fillPixelRect(buf, bufW, bufH, x, y + h - t, w, t, r, g, b);
  fillPixelRect(buf, bufW, bufH, x, y, t, h, r, g, b);
  fillPixelRect(buf, bufW, bufH, x + w - t, y, t, h, r, g, b);
}

export async function renderMeasurementExportImage(params: {
  wall: MeasurementWall;
  room: Room3dProps;
  modules: ModuleElevation[];
  geometry: MeasurementGeometryLayout;
  options: MeasurementExportOptions;
  modelCapture: ElevationCaptureResult | null;
}): Promise<{ bytes: Uint8Array; base64: string; dataUrl: string; width: number; height: number }> {
  const { wall, room, modules, geometry, options, modelCapture } = params;
  const docDims = computeDocumentDimensions(geometry, options);
  const { targetWidth, targetHeight, scaleFactor, diagramWidth, diagramHeight } = docDims;
  const { horizontalGaps, verticalGaps } = getElevationGaps(modules, wall);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.scale(scaleFactor, scaleFactor);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, diagramWidth, diagramHeight);

      if (modelCapture?.dataUrl) {
        try {
          const img = await loadWebImage(modelCapture.dataUrl);
          ctx.drawImage(img, 0, 0, diagramWidth, diagramHeight);
        } catch (err) {
          console.warn('Could not draw elevation model capture onto 2D canvas:', err);
        }
      }

      const { originX, originY, baseScale, wallTop } = geometry;
      const wallPxW = wall.width * baseScale;
      const wallPxH = room.height * baseScale;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(originX, wallTop, wallPxW, wallPxH);

      const hDimY = wallTop - 28;
      ctx.beginPath();
      ctx.moveTo(originX, hDimY);
      ctx.lineTo(originX + wallPxW, hDimY);
      ctx.moveTo(originX, hDimY - 5);
      ctx.lineTo(originX, hDimY + 5);
      ctx.moveTo(originX + wallPxW, hDimY - 5);
      ctx.lineTo(originX + wallPxW, hDimY + 5);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      const hLabel = `${formatMeasurement(wall.width)} mm`;
      ctx.font = '600 11px sans-serif';
      const hTextW = ctx.measureText(hLabel).width + 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(originX + wallPxW / 2 - hTextW / 2, hDimY - 8, hTextW, 16);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hLabel, originX + wallPxW / 2, hDimY);

      const vDimX = originX + wallPxW + 24;
      ctx.beginPath();
      ctx.moveTo(vDimX, wallTop);
      ctx.lineTo(vDimX, wallTop + wallPxH);
      ctx.moveTo(vDimX - 5, wallTop);
      ctx.lineTo(vDimX + 5, wallTop);
      ctx.moveTo(vDimX - 5, wallTop + wallPxH);
      ctx.lineTo(vDimX + 5, wallTop + wallPxH);
      ctx.stroke();

      const vLabel = `${formatMeasurement(room.height)} mm`;
      const vTextW = ctx.measureText(vLabel).width + 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(vDimX + 6, wallTop + wallPxH / 2 - 9, vTextW, 18);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(vLabel, vDimX + 8, wallTop + wallPxH / 2);

      modules.forEach((module, index) => {
        const modX = originX + module.left * baseScale;
        const modY = originY - (module.bottom + module.height) * baseScale;
        const modW = module.width * baseScale;
        const modH = module.height * baseScale;

        if (!modelCapture?.dataUrl) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(modX, modY, modW, modH);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.25;
          ctx.strokeRect(modX, modY, modW, modH);
        }

        const tagLabel = `M${index + 1}`;
        ctx.font = '700 11px sans-serif';
        const tagW = ctx.measureText(tagLabel).width + 6;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(modX + 3, modY + 3, tagW, 15);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(tagLabel, modX + 6, modY + 5);

        if (modW >= 68 && modH >= 58) {
          const sizeLabel = `${formatMeasurement(module.width)} × ${formatMeasurement(module.height)}`;
          ctx.font = '500 10px sans-serif';
          const sizeW = ctx.measureText(sizeLabel).width + 8;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.fillRect(modX + modW / 2 - sizeW / 2, modY + modH - 18, sizeW, 14);
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sizeLabel, modX + modW / 2, modY + modH - 11);
        }
      });

      horizontalGaps.forEach((gap) => {
        const startX = originX + gap.left * baseScale;
        const gapPxW = gap.width * baseScale;
        const endX = startX + gapPxW;
        const lineY = originY - gap.y * baseScale;

        ctx.save();
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, lineY);
        ctx.lineTo(endX, lineY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(startX, lineY - 5);
        ctx.lineTo(startX, lineY + 5);
        ctx.moveTo(endX, lineY - 5);
        ctx.lineTo(endX, lineY + 5);
        ctx.stroke();

        const gapText = `${formatMeasurement(gap.width)} mm`;
        ctx.font = '600 10px sans-serif';
        const textW = ctx.measureText(gapText).width + 8;
        const midX = startX + gapPxW / 2;
        const labelY = gapPxW >= textW + 6 ? lineY : lineY - 12;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.fillRect(midX - textW / 2, labelY - 7, textW, 14);
        ctx.strokeStyle = '#bfdbfe';
        ctx.lineWidth = 0.75;
        ctx.strokeRect(midX - textW / 2, labelY - 7, textW, 14);

        ctx.fillStyle = '#1d4ed8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gapText, midX, labelY);
        ctx.restore();
      });

      verticalGaps.forEach((vgap) => {
        const lineX = originX + vgap.x * baseScale;
        const topY = originY - (vgap.bottom + vgap.height) * baseScale;
        const bottomY = originY - vgap.bottom * baseScale;
        const gapPxH = bottomY - topY;

        ctx.save();
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(lineX, topY);
        ctx.lineTo(lineX, bottomY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(lineX - 5, topY);
        ctx.lineTo(lineX + 5, topY);
        ctx.moveTo(lineX - 5, bottomY);
        ctx.lineTo(lineX + 5, bottomY);
        ctx.stroke();

        const gapText = `${formatMeasurement(vgap.height)} mm`;
        ctx.font = '600 10px sans-serif';
        const textW = ctx.measureText(gapText).width + 8;
        const midY = topY + gapPxH / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.fillRect(lineX - textW / 2, midY - 7, textW, 14);
        ctx.strokeStyle = '#bfdbfe';
        ctx.lineWidth = 0.75;
        ctx.strokeRect(lineX - textW / 2, midY - 7, textW, 14);

        ctx.fillStyle = '#1d4ed8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gapText, lineX, midY);
        ctx.restore();
      });

      ctx.fillStyle = '#000000';
      ctx.font = '500 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Floor · 0 mm', originX, originY + 14);

      ctx.fillStyle = '#333333';
      ctx.font = '400 10px sans-serif';
      const leftEdgeText =
        wall.view === WallView.Left
          ? 'Room opening'
          : wall.view === WallView.Right
          ? 'Front wall'
          : 'Left edge';
      const rightEdgeText =
        wall.view === WallView.Left
          ? 'Front wall'
          : wall.view === WallView.Right
          ? 'Room opening'
          : 'Right edge';
      ctx.fillText(leftEdgeText, originX, originY + 34);
      ctx.textAlign = 'right';
      ctx.fillText(rightEdgeText, originX + wallPxW, originY + 34);
      ctx.textAlign = 'left';

      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const bytes = base64ToUint8Array(base64);
      return { bytes, base64, dataUrl, width: targetWidth, height: targetHeight };
    }
  }

  const outW = targetWidth;
  const outH = targetHeight;
  const rgba = new Uint8Array(outW * outH * 4);
  rgba.fill(255);

  const scaledDiagramW = Math.round(diagramWidth * scaleFactor);
  const scaledDiagramH = Math.round(diagramHeight * scaleFactor);

  if (modelCapture?.pixels && modelCapture.width > 0 && modelCapture.height > 0) {
    const srcW = modelCapture.width;
    const srcH = modelCapture.height;
    const srcPixels = modelCapture.pixels;
    for (let dy = 0; dy < scaledDiagramH; dy++) {
      if (dy < 0 || dy >= outH) continue;
      const sy = Math.min(srcH - 1, Math.floor((dy / scaledDiagramH) * srcH));
      for (let dx = 0; dx < scaledDiagramW; dx++) {
        if (dx < 0 || dx >= outW) continue;
        const sx = Math.min(srcW - 1, Math.floor((dx / scaledDiagramW) * srcW));
        const srcIdx = (sy * srcW + sx) * 4;
        const alpha = srcPixels[srcIdx + 3] / 255;
        if (alpha > 0) {
          const dstIdx = (dy * outW + dx) * 4;
          rgba[dstIdx] = Math.round(srcPixels[srcIdx] * alpha + 255 * (1 - alpha));
          rgba[dstIdx + 1] = Math.round(srcPixels[srcIdx + 1] * alpha + 255 * (1 - alpha));
          rgba[dstIdx + 2] = Math.round(srcPixels[srcIdx + 2] * alpha + 255 * (1 - alpha));
          rgba[dstIdx + 3] = 255;
        }
      }
    }
  }

  const wallX = geometry.originX * scaleFactor;
  const wallY = geometry.wallTop * scaleFactor;
  const wallW = wall.width * geometry.baseScale * scaleFactor;
  const wallH = room.height * geometry.baseScale * scaleFactor;

  strokePixelRect(rgba, outW, outH, wallX, wallY, wallW, wallH, Math.max(1, 2 * scaleFactor), 0, 0, 0);

  horizontalGaps.forEach((gap) => {
    const gx = (geometry.originX + gap.left * geometry.baseScale) * scaleFactor;
    const gw = gap.width * geometry.baseScale * scaleFactor;
    const gy = (geometry.originY - gap.y * geometry.baseScale) * scaleFactor;
    fillPixelRect(rgba, outW, outH, gx, gy, gw, Math.max(1, 2 * scaleFactor), 29, 78, 216);
  });

  verticalGaps.forEach((vgap) => {
    const vx = (geometry.originX + vgap.x * geometry.baseScale) * scaleFactor;
    const vy = (geometry.originY - (vgap.bottom + vgap.height) * geometry.baseScale) * scaleFactor;
    const vh = vgap.height * geometry.baseScale * scaleFactor;
    fillPixelRect(rgba, outW, outH, vx, vy, Math.max(1, 2 * scaleFactor), vh, 29, 78, 216);
  });

  const bytes = encodeRgbaToPngBytes(outW, outH, rgba);
  const base64 = uint8ArrayToBase64(bytes);
  const dataUrl = `data:image/png;base64,${base64}`;
  return { bytes, base64, dataUrl, width: outW, height: outH };
}
