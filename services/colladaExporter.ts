import { encode as encodePng } from 'fast-png';
import * as THREE from 'three';
import { base64ToUint8Array } from './imageExport';

export interface ColladaTextureAsset {
  path: string;
  filename: string;
  extension: 'jpg' | 'png';
  data: Uint8Array;
}

export interface ColladaExportResult {
  dae: string;
  textures: ColladaTextureAsset[];
}

export interface ColladaExportOptions {
  textureDirectory?: string;
  authoringTool?: string;
  upAxis?: 'Y_UP' | 'Z_UP';
  unitMeter?: number;
  unitName?: string;
}

interface ExtractedImageData {
  extension: 'jpg' | 'png';
  data: Uint8Array;
}

interface ProcessedMaterial {
  id: string;
  hasDiffuseTexture: boolean;
}

interface ProcessedGeometry {
  id: string;
  hasUv: boolean;
  materialBindings: { symbol: string; materialIndex: number }[];
}

interface MaterialLike extends THREE.Material {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  specular?: THREE.Color;
  shininess?: number;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture | null;
}

interface PixelBufferImage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatFloat(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const clamped = Math.abs(value) < 1e-7 ? 0 : value;
  return Number(clamped.toFixed(6)).toString();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isIdentityMatrix(m: THREE.Matrix4): boolean {
  const e = m.elements;
  const eps = 1e-7;
  return (
    Math.abs(e[0] - 1) < eps &&
    Math.abs(e[1]) < eps &&
    Math.abs(e[2]) < eps &&
    Math.abs(e[3]) < eps &&
    Math.abs(e[4]) < eps &&
    Math.abs(e[5] - 1) < eps &&
    Math.abs(e[6]) < eps &&
    Math.abs(e[7]) < eps &&
    Math.abs(e[8]) < eps &&
    Math.abs(e[9]) < eps &&
    Math.abs(e[10] - 1) < eps &&
    Math.abs(e[11]) < eps &&
    Math.abs(e[12]) < eps &&
    Math.abs(e[13]) < eps &&
    Math.abs(e[14]) < eps &&
    Math.abs(e[15] - 1) < eps
  );
}

function detectImageExtension(bytes: Uint8Array): 'jpg' | 'png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

function mapWrapMode(wrap: THREE.Wrapping): string {
  if (wrap === THREE.ClampToEdgeWrapping) return 'CLAMP';
  if (wrap === THREE.MirroredRepeatWrapping) return 'MIRROR';
  return 'WRAP';
}

function getUvTransformKey(texture: THREE.Texture | null | undefined): string {
  if (!texture) return 'none';
  if (texture.matrixAutoUpdate) {
    texture.updateMatrix();
  }
  const e = texture.matrix.elements;
  const flip = texture.flipY ? '1' : '0';
  return `${flip}:${e.map((v) => formatFloat(v)).join(',')}`;
}

function isPixelBufferImage(image: unknown): image is PixelBufferImage {
  if (!image || typeof image !== 'object') return false;
  const candidate = image as Partial<PixelBufferImage>;
  return (
    (candidate.data instanceof Uint8Array || candidate.data instanceof Uint8ClampedArray) &&
    typeof candidate.width === 'number' &&
    candidate.width > 0 &&
    typeof candidate.height === 'number' &&
    candidate.height > 0
  );
}

function getImageDimensions(image: unknown): { width: number; height: number } | null {
  if (!image || typeof image !== 'object') return null;
  const candidate = image as {
    naturalWidth?: number;
    naturalHeight?: number;
    width?: number;
    height?: number;
  };
  const width = candidate.naturalWidth || candidate.width || 0;
  const height = candidate.naturalHeight || candidate.height || 0;
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

async function extractTextureBytes(texture: THREE.Texture): Promise<ExtractedImageData | null> {
  const userData = texture.userData as { sourceBytes?: Uint8Array; sourceUrl?: string } | undefined;

  if (userData?.sourceBytes instanceof Uint8Array && userData.sourceBytes.length > 0) {
    const ext = detectImageExtension(userData.sourceBytes);
    if (ext) {
      return { extension: ext, data: userData.sourceBytes };
    }
  }

  const image: unknown = texture.source?.data ?? texture.image;
  const imageSrc =
    userData?.sourceUrl ||
    (image && typeof image === 'object' && 'currentSrc' in image && typeof (image as { currentSrc?: unknown }).currentSrc === 'string'
      ? (image as { currentSrc: string }).currentSrc
      : undefined) ||
    (image && typeof image === 'object' && 'src' in image && typeof (image as { src?: unknown }).src === 'string'
      ? (image as { src: string }).src
      : undefined);

  if (imageSrc) {
    if (imageSrc.startsWith('data:image/jpeg;base64,') || imageSrc.startsWith('data:image/jpg;base64,')) {
      const data = base64ToUint8Array(imageSrc);
      if (data.length > 0) return { extension: 'jpg', data };
    } else if (imageSrc.startsWith('data:image/png;base64,')) {
      const data = base64ToUint8Array(imageSrc);
      if (data.length > 0) return { extension: 'png', data };
    } else if (
      imageSrc.startsWith('http://') ||
      imageSrc.startsWith('https://') ||
      imageSrc.startsWith('blob:') ||
      imageSrc.startsWith('file:')
    ) {
      try {
        const response = await fetch(imageSrc);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const data = new Uint8Array(buffer);
          const ext = detectImageExtension(data);
          if (ext) {
            return { extension: ext, data };
          }
        }
      } catch (err) {
        console.warn('COLLADA export: failed to fetch texture bytes directly:', err);
      }
    }
  }

  if (isPixelBufferImage(image)) {
    const pixelCount = image.width * image.height;
    const channels = Math.round(image.data.length / pixelCount);
    if (channels === 1 || channels === 2 || channels === 3 || channels === 4) {
      try {
        const encoded = encodePng({
          width: image.width,
          height: image.height,
          data: image.data,
          channels,
        });
        return { extension: 'png', data: new Uint8Array(encoded) };
      } catch (err) {
        console.warn('COLLADA export: failed to encode raw pixel texture to PNG:', err);
      }
    }
  }

  if (typeof document !== 'undefined' && typeof document.createElement === 'function' && image) {
    const dims = getImageDimensions(image);
    if (dims) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image as CanvasImageSource, 0, 0, dims.width, dims.height);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.startsWith('data:image/png;base64,')) {
            const data = base64ToUint8Array(dataUrl);
            if (data.length > 0) {
              return { extension: 'png', data };
            }
          }
        }
      } catch (err) {
        console.warn('COLLADA export: failed to rasterize texture via canvas:', err);
      }
    }
  }

  return null;
}

function computeVertexNormalsArray(
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  indexAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null
): Float32Array {
  const vertexCount = posAttr.count;
  const normals = new Float32Array(vertexCount * 3);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  const accumulate = (a: number, b: number, c: number) => {
    vA.fromBufferAttribute(posAttr, a);
    vB.fromBufferAttribute(posAttr, b);
    vC.fromBufferAttribute(posAttr, c);
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.cross(ab);

    normals[a * 3] += cb.x;
    normals[a * 3 + 1] += cb.y;
    normals[a * 3 + 2] += cb.z;

    normals[b * 3] += cb.x;
    normals[b * 3 + 1] += cb.y;
    normals[b * 3 + 2] += cb.z;

    normals[c * 3] += cb.x;
    normals[c * 3 + 1] += cb.y;
    normals[c * 3 + 2] += cb.z;
  };

  if (indexAttr) {
    const triLimit = Math.floor(indexAttr.count / 3) * 3;
    for (let i = 0; i < triLimit; i += 3) {
      accumulate(indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2));
    }
  } else {
    const triLimit = Math.floor(vertexCount / 3) * 3;
    for (let i = 0; i < triLimit; i += 3) {
      accumulate(i, i + 1, i + 2);
    }
  }

  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-8) {
      normals[i * 3] = nx / len;
      normals[i * 3 + 1] = ny / len;
      normals[i * 3 + 2] = nz / len;
    } else {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }
  }

  return normals;
}

function hasVisibleMeshDescendant(object: THREE.Object3D): boolean {
  if (!object.visible) return false;
  if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry) {
    const pos = object.geometry.attributes.position;
    if (pos && pos.count >= 3) return true;
  }
  for (const child of object.children) {
    if (hasVisibleMeshDescendant(child)) return true;
  }
  return false;
}

function normalizeTextureDirectory(dir: string): string {
  const sanitized = dir
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('/');
  return sanitized || 'textures';
}

function hashBytesQuick(bytes: Uint8Array): string {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 2048));
  for (let i = 0; i < bytes.length; i += step) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return `${bytes.length}_${hash >>> 0}`;
}

export async function exportSceneToCollada(
  root: THREE.Object3D,
  options: ColladaExportOptions = {}
): Promise<ColladaExportResult> {
  const textureDirectory = normalizeTextureDirectory(options.textureDirectory ?? 'textures');
  const authoringTool = options.authoringTool ?? 'Designer 3D Exporter';
  const upAxis = options.upAxis ?? 'Z_UP';
  const unitMeter = options.unitMeter ?? 1;
  const unitName = options.unitName ?? 'meter';
  const convertToZUp = upAxis === 'Z_UP';

  const yUpToZUp = new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 0, -1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1
  );
  const zUpToYUp = new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, -1, 0, 0,
    0, 0, 0, 1
  );

  root.updateMatrixWorld(true);

  const libraryImages: string[] = [];
  const libraryEffects: string[] = [];
  const libraryMaterials: string[] = [];
  const libraryGeometries: string[] = [];
  const libraryNodes: string[] = [];
  const textures: ColladaTextureAsset[] = [];

  const textureIdByTexture = new Map<THREE.Texture, string | null>();
  const textureIdByKey = new Map<string, string>();
  const materialCache = new Map<THREE.Material, ProcessedMaterial>();
  const geometryCache = new Map<string, ProcessedGeometry>();

  let imageCounter = 0;
  let materialCounter = 0;
  let geometryCounter = 0;
  let nodeCounter = 0;

  const fallbackMaterial = new THREE.MeshStandardMaterial({ color: '#cccccc' });
  const tempMatrix = new THREE.Matrix4();
  const tempRgb = { r: 1, g: 1, b: 1 };
  const tempUv = new THREE.Vector2();

  const registerTexture = async (texture: THREE.Texture): Promise<string | null> => {
    if (textureIdByTexture.has(texture)) {
      return textureIdByTexture.get(texture) ?? null;
    }

    const userData = texture.userData as { sourceUrl?: string } | undefined;
    const sourceKey =
      userData?.sourceUrl
        ? `url:${userData.sourceUrl}`
        : texture.source?.uuid
          ? `src:${texture.source.uuid}`
          : null;

    if (sourceKey && textureIdByKey.has(sourceKey)) {
      const existingId = textureIdByKey.get(sourceKey)!;
      textureIdByTexture.set(texture, existingId);
      return existingId;
    }

    const extracted = await extractTextureBytes(texture);
    if (!extracted) {
      textureIdByTexture.set(texture, null);
      return null;
    }

    const contentKey = `bin:${extracted.extension}:${hashBytesQuick(extracted.data)}`;
    if (textureIdByKey.has(contentKey)) {
      const existingId = textureIdByKey.get(contentKey)!;
      if (sourceKey) textureIdByKey.set(sourceKey, existingId);
      textureIdByTexture.set(texture, existingId);
      return existingId;
    }

    imageCounter += 1;
    const padded = String(imageCounter).padStart(2, '0');
    const imageId = `img_${padded}`;
    const baseName = `tex_${padded}`;
    const filename = `${baseName}.${extracted.extension}`;
    const relativePath = `${textureDirectory}/${filename}`;

    textures.push({
      path: relativePath,
      filename,
      extension: extracted.extension,
      data: extracted.data,
    });

    libraryImages.push(
      `    <image id="${imageId}" name="${baseName}">\n` +
        `      <init_from>${escapeXml(relativePath)}</init_from>\n` +
        `    </image>`
    );

    textureIdByTexture.set(texture, imageId);
    textureIdByKey.set(contentKey, imageId);
    if (sourceKey) {
      textureIdByKey.set(sourceKey, imageId);
    }
    return imageId;
  };

  const registerMaterial = async (material: THREE.Material): Promise<ProcessedMaterial> => {
    const cached = materialCache.get(material);
    if (cached) return cached;

    materialCounter += 1;
    const matId = `mat_${materialCounter}`;
    const effectId = `${matId}-effect`;
    const matName = material.name?.trim() || `Material_${materialCounter}`;
    const mat = material as MaterialLike;

    let diffuseImageId: string | null = null;
    if (mat.map instanceof THREE.Texture) {
      diffuseImageId = await registerTexture(mat.map);
    }

    if (mat.color instanceof THREE.Color) {
      mat.color.getRGB(tempRgb, THREE.SRGBColorSpace);
    } else {
      tempRgb.r = 0.8;
      tempRgb.g = 0.8;
      tempRgb.b = 0.8;
    }
    const diffR = formatFloat(clamp01(tempRgb.r));
    const diffG = formatFloat(clamp01(tempRgb.g));
    const diffB = formatFloat(clamp01(tempRgb.b));

    let emR = '0';
    let emG = '0';
    let emB = '0';
    if (mat.emissive instanceof THREE.Color) {
      const intensity = typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1;
      mat.emissive.getRGB(tempRgb, THREE.SRGBColorSpace);
      emR = formatFloat(clamp01(tempRgb.r * intensity));
      emG = formatFloat(clamp01(tempRgb.g * intensity));
      emB = formatFloat(clamp01(tempRgb.b * intensity));
    }

    let specVal = 0.15;
    let shininessVal = 16;
    if (mat.specular instanceof THREE.Color) {
      mat.specular.getRGB(tempRgb, THREE.SRGBColorSpace);
      specVal = clamp01((tempRgb.r + tempRgb.g + tempRgb.b) / 3);
      shininessVal = typeof mat.shininess === 'number' ? Math.max(1, mat.shininess) : 30;
    } else if (typeof mat.roughness === 'number') {
      const smoothness = clamp01(1 - mat.roughness);
      specVal = clamp01(0.05 + smoothness * 0.45);
      shininessVal = Math.max(2, Math.round(2 + smoothness * smoothness * 64));
    }
    const specStr = formatFloat(specVal);
    const shininessStr = formatFloat(shininessVal);

    const opacity = clamp01(typeof material.opacity === 'number' ? material.opacity : 1);
    const isTransparent = Boolean(material.transparent) || opacity < 0.999;

    const surfaceSid = `${matId}-surface`;
    const samplerSid = `${matId}-sampler`;

    const profileParts: string[] = [];
    if (diffuseImageId && mat.map) {
      const wrapS = mapWrapMode(mat.map.wrapS);
      const wrapT = mapWrapMode(mat.map.wrapT);
      profileParts.push(
        `        <newparam sid="${surfaceSid}">\n` +
          `          <surface type="2D">\n` +
          `            <init_from>${diffuseImageId}</init_from>\n` +
          `          </surface>\n` +
          `        </newparam>`
      );
      profileParts.push(
        `        <newparam sid="${samplerSid}">\n` +
          `          <sampler2D>\n` +
          `            <source>${surfaceSid}</source>\n` +
          `            <wrap_s>${wrapS}</wrap_s>\n` +
          `            <wrap_t>${wrapT}</wrap_t>\n` +
          `            <minfilter>LINEAR_MIPMAP_LINEAR</minfilter>\n` +
          `            <magfilter>LINEAR</magfilter>\n` +
          `          </sampler2D>\n` +
          `        </newparam>`
      );
    }

    const diffuseXml = diffuseImageId
      ? `              <texture texture="${samplerSid}" texcoord="UVSET0"/>`
      : `              <color sid="diffuse">${diffR} ${diffG} ${diffB} 1</color>`;

    let transparencyXml = '';
    if (isTransparent) {
      if (opacity < 0.999) {
        transparencyXml =
          `            <transparent opaque="A_ONE">\n` +
          `              <color>1 1 1 1</color>\n` +
          `            </transparent>\n` +
          `            <transparency>\n` +
          `              <float>${formatFloat(opacity)}</float>\n` +
          `            </transparency>\n`;
      } else if (diffuseImageId) {
        transparencyXml =
          `            <transparent opaque="A_ONE">\n` +
          `              <texture texture="${samplerSid}" texcoord="UVSET0"/>\n` +
          `            </transparent>\n` +
          `            <transparency>\n` +
          `              <float>1</float>\n` +
          `            </transparency>\n`;
      }
    }

    const doubleSidedXml =
      material.side === THREE.DoubleSide
        ? `        <extra>\n` +
          `          <technique profile="GOOGLEEARTH">\n` +
          `            <double_sided>1</double_sided>\n` +
          `          </technique>\n` +
          `        </extra>\n`
        : '';

    const effectXml =
      `    <effect id="${effectId}" name="${escapeXml(matName)}">\n` +
      `      <profile_COMMON>\n` +
      (profileParts.length > 0 ? `${profileParts.join('\n')}\n` : '') +
      `        <technique sid="common">\n` +
      `          <phong>\n` +
      `            <emission>\n` +
      `              <color sid="emission">${emR} ${emG} ${emB} 1</color>\n` +
      `            </emission>\n` +
      `            <ambient>\n` +
      `              <color sid="ambient">0 0 0 1</color>\n` +
      `            </ambient>\n` +
      `            <diffuse>\n` +
      `${diffuseXml}\n` +
      `            </diffuse>\n` +
      `            <specular>\n` +
      `              <color sid="specular">${specStr} ${specStr} ${specStr} 1</color>\n` +
      `            </specular>\n` +
      `            <shininess>\n` +
      `              <float sid="shininess">${shininessStr}</float>\n` +
      `            </shininess>\n` +
      transparencyXml +
      `          </phong>\n` +
      `        </technique>\n` +
      doubleSidedXml +
      `      </profile_COMMON>\n` +
      `    </effect>`;

    libraryEffects.push(effectXml);
    libraryMaterials.push(
      `    <material id="${matId}" name="${escapeXml(matName)}">\n` +
        `      <instance_effect url="#${effectId}"/>\n` +
        `    </material>`
    );

    const processed: ProcessedMaterial = {
      id: matId,
      hasDiffuseTexture: diffuseImageId !== null,
    };
    materialCache.set(material, processed);
    return processed;
  };

  const registerGeometry = (
    geometry: THREE.BufferGeometry,
    materials: THREE.Material[]
  ): ProcessedGeometry | null => {
    const posAttr = geometry.attributes.position as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;
    if (!posAttr || posAttr.count < 3) return null;

    const indexAttr = geometry.index as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | null;
    const totalIndices = indexAttr ? indexAttr.count : posAttr.count;
    const rawGroups =
      geometry.groups && geometry.groups.length > 0 && materials.length > 1
        ? geometry.groups
        : [{ start: 0, count: totalIndices, materialIndex: 0 }];

    const validGroups = rawGroups.filter((g) => Math.floor(Math.min(g.count, totalIndices - g.start) / 3) > 0);
    if (validGroups.length === 0) return null;

    const uvAttr = geometry.attributes.uv as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;

    const groupTextures: (THREE.Texture | null)[] = validGroups.map((group) => {
      const matIdx = group.materialIndex ?? 0;
      const mat = materials[matIdx % materials.length] as MaterialLike | undefined;
      return mat?.map instanceof THREE.Texture ? mat.map : null;
    });

    const uvKeys = uvAttr ? groupTextures.map((tex) => getUvTransformKey(tex)) : [];
    const cacheKey = `${geometry.uuid}|${uvKeys.join('|')}|${validGroups
      .map((g) => `${g.start}:${g.count}:${g.materialIndex ?? 0}`)
      .join(',')}`;

    const cached = geometryCache.get(cacheKey);
    if (cached) return cached;

    geometryCounter += 1;
    const geomId = `geom_${geometryCounter}`;
    const geomName = geometry.name?.trim() || geomId;

    const posValues: string[] = new Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      const pz = posAttr.getZ(i);
      if (convertToZUp) {
        posValues[i * 3] = formatFloat(px);
        posValues[i * 3 + 1] = formatFloat(-pz);
        posValues[i * 3 + 2] = formatFloat(py);
      } else {
        posValues[i * 3] = formatFloat(px);
        posValues[i * 3 + 1] = formatFloat(py);
        posValues[i * 3 + 2] = formatFloat(pz);
      }
    }

    const normalAttr = geometry.attributes.normal as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;
    const normValues: string[] = new Array(posAttr.count * 3);
    if (normalAttr && normalAttr.count === posAttr.count) {
      for (let i = 0; i < posAttr.count; i++) {
        const nx = normalAttr.getX(i);
        const ny = normalAttr.getY(i);
        const nz = normalAttr.getZ(i);
        if (Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz)) {
          if (convertToZUp) {
            normValues[i * 3] = formatFloat(nx);
            normValues[i * 3 + 1] = formatFloat(-nz);
            normValues[i * 3 + 2] = formatFloat(ny);
          } else {
            normValues[i * 3] = formatFloat(nx);
            normValues[i * 3 + 1] = formatFloat(ny);
            normValues[i * 3 + 2] = formatFloat(nz);
          }
        } else {
          normValues[i * 3] = '0';
          normValues[i * 3 + 1] = convertToZUp ? '0' : '1';
          normValues[i * 3 + 2] = convertToZUp ? '1' : '0';
        }
      }
    } else {
      const computed = computeVertexNormalsArray(posAttr, indexAttr);
      for (let i = 0; i < posAttr.count; i++) {
        const nx = computed[i * 3];
        const ny = computed[i * 3 + 1];
        const nz = computed[i * 3 + 2];
        if (convertToZUp) {
          normValues[i * 3] = formatFloat(nx);
          normValues[i * 3 + 1] = formatFloat(-nz);
          normValues[i * 3 + 2] = formatFloat(ny);
        } else {
          normValues[i * 3] = formatFloat(nx);
          normValues[i * 3 + 1] = formatFloat(ny);
          normValues[i * 3 + 2] = formatFloat(nz);
        }
      }
    }

    const posSourceId = `${geomId}-positions`;
    const normSourceId = `${geomId}-normals`;
    const verticesId = `${geomId}-vertices`;

    const sourcesXml: string[] = [
      `        <source id="${posSourceId}">\n` +
        `          <float_array id="${posSourceId}-array" count="${posValues.length}">${posValues.join(' ')}</float_array>\n` +
        `          <technique_common>\n` +
        `            <accessor source="#${posSourceId}-array" count="${posAttr.count}" stride="3">\n` +
        `              <param name="X" type="float"/>\n` +
        `              <param name="Y" type="float"/>\n` +
        `              <param name="Z" type="float"/>\n` +
        `            </accessor>\n` +
        `          </technique_common>\n` +
        `        </source>`,
      `        <source id="${normSourceId}">\n` +
        `          <float_array id="${normSourceId}-array" count="${normValues.length}">${normValues.join(' ')}</float_array>\n` +
        `          <technique_common>\n` +
        `            <accessor source="#${normSourceId}-array" count="${posAttr.count}" stride="3">\n` +
        `              <param name="X" type="float"/>\n` +
        `              <param name="Y" type="float"/>\n` +
        `              <param name="Z" type="float"/>\n` +
        `            </accessor>\n` +
        `          </technique_common>\n` +
        `        </source>`,
    ];

    const uvSourceIdByKey = new Map<string, string>();
    const hasUv = Boolean(uvAttr && uvAttr.count === posAttr.count);
    if (hasUv && uvAttr) {
      let uvVariantIdx = 0;
      for (let gIdx = 0; gIdx < validGroups.length; gIdx++) {
        const key = uvKeys[gIdx];
        if (uvSourceIdByKey.has(key)) continue;

        const tex = groupTextures[gIdx];
        if (tex && tex.matrixAutoUpdate) {
          tex.updateMatrix();
        }

        const uvValues: string[] = new Array(uvAttr.count * 2);
        for (let i = 0; i < uvAttr.count; i++) {
          tempUv.set(uvAttr.getX(i), uvAttr.getY(i));
          if (tex) {
            tempUv.applyMatrix3(tex.matrix);
            if (!tex.flipY) {
              tempUv.y = 1 - tempUv.y;
            }
          }
          uvValues[i * 2] = formatFloat(tempUv.x);
          uvValues[i * 2 + 1] = formatFloat(tempUv.y);
        }

        const uvSourceId = uvVariantIdx === 0 ? `${geomId}-uvs` : `${geomId}-uvs-${uvVariantIdx}`;
        uvVariantIdx += 1;
        uvSourceIdByKey.set(key, uvSourceId);

        sourcesXml.push(
          `        <source id="${uvSourceId}">\n` +
            `          <float_array id="${uvSourceId}-array" count="${uvValues.length}">${uvValues.join(' ')}</float_array>\n` +
            `          <technique_common>\n` +
            `            <accessor source="#${uvSourceId}-array" count="${uvAttr.count}" stride="2">\n` +
            `              <param name="S" type="float"/>\n` +
            `              <param name="T" type="float"/>\n` +
            `            </accessor>\n` +
            `          </technique_common>\n` +
            `        </source>`
        );
      }
    }

    const materialBindings: { symbol: string; materialIndex: number }[] = [];
    const trianglesXml: string[] = [];

    for (let gIdx = 0; gIdx < validGroups.length; gIdx++) {
      const group = validGroups[gIdx];
      const maxCount = Math.min(group.count, totalIndices - group.start);
      const triCount = Math.floor(maxCount / 3);
      if (triCount <= 0) continue;

      const symbol = `mat_sym_${gIdx}`;
      materialBindings.push({ symbol, materialIndex: group.materialIndex ?? 0 });

      const indices: number[] = new Array(triCount * 3);
      if (indexAttr) {
        for (let k = 0; k < triCount * 3; k++) {
          indices[k] = indexAttr.getX(group.start + k);
        }
      } else {
        for (let k = 0; k < triCount * 3; k++) {
          indices[k] = group.start + k;
        }
      }

      const uvInputXml = hasUv
        ? `          <input semantic="TEXCOORD" source="#${uvSourceIdByKey.get(uvKeys[gIdx])}" offset="0" set="0"/>\n`
        : '';

      trianglesXml.push(
        `        <triangles material="${symbol}" count="${triCount}">\n` +
          `          <input semantic="VERTEX" source="#${verticesId}" offset="0"/>\n` +
          `          <input semantic="NORMAL" source="#${normSourceId}" offset="0"/>\n` +
          uvInputXml +
          `          <p>${indices.join(' ')}</p>\n` +
          `        </triangles>`
      );
    }

    if (trianglesXml.length === 0) return null;

    libraryGeometries.push(
      `    <geometry id="${geomId}" name="${escapeXml(geomName)}">\n` +
        `      <mesh>\n` +
        `${sourcesXml.join('\n')}\n` +
        `        <vertices id="${verticesId}">\n` +
        `          <input semantic="POSITION" source="#${posSourceId}"/>\n` +
        `        </vertices>\n` +
        `${trianglesXml.join('\n')}\n` +
        `      </mesh>\n` +
        `    </geometry>`
    );

    const processed: ProcessedGeometry = {
      id: geomId,
      hasUv,
      materialBindings,
    };
    geometryCache.set(cacheKey, processed);
    return processed;
  };

  const processNode = async (object: THREE.Object3D, indentLevel: number): Promise<string> => {
    if (!hasVisibleMeshDescendant(object)) return '';

    nodeCounter += 1;
    const idIndex = nodeCounter;
    const defId = `def_${idIndex}`;
    const instId = `node_${idIndex}`;
    const fallbackName = object instanceof THREE.Mesh ? `Mesh_${idIndex}` : `Group_${idIndex}`;
    const nodeName = object.name?.trim() || fallbackName;
    const indent = '  '.repeat(indentLevel);
    const innerIndent = '  '.repeat(indentLevel + 1);

    object.updateMatrix();
    const defParts: string[] = [];

    if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry) {
      const rawMaterial = object.material;
      const materials = Array.isArray(rawMaterial)
        ? rawMaterial.length > 0
          ? rawMaterial
          : [fallbackMaterial]
        : [rawMaterial || fallbackMaterial];

      const geomInfo = registerGeometry(object.geometry, materials);
      if (geomInfo) {
        const bindingsXml: string[] = [];
        for (const binding of geomInfo.materialBindings) {
          const targetMat = materials[binding.materialIndex % materials.length] || fallbackMaterial;
          const matInfo = await registerMaterial(targetMat);

          if (geomInfo.hasUv && matInfo.hasDiffuseTexture) {
            bindingsXml.push(
              `            <instance_material symbol="${binding.symbol}" target="#${matInfo.id}">\n` +
                `              <bind_vertex_input semantic="UVSET0" input_semantic="TEXCOORD" input_set="0"/>\n` +
                `            </instance_material>`
            );
          } else {
            bindingsXml.push(
              `            <instance_material symbol="${binding.symbol}" target="#${matInfo.id}"/>`
            );
          }
        }

        defParts.push(
          `      <instance_geometry url="#${geomInfo.id}" name="${escapeXml(nodeName)}">\n` +
            `        <bind_material>\n` +
            `          <technique_common>\n` +
            `${bindingsXml.join('\n')}\n` +
            `          </technique_common>\n` +
            `        </bind_material>\n` +
            `      </instance_geometry>`
        );
      }
    }

    for (const child of object.children) {
      const childInstanceXml = await processNode(child, 3);
      if (childInstanceXml) {
        defParts.push(childInstanceXml);
      }
    }

    if (defParts.length === 0) return '';

    libraryNodes.push(
      `    <node id="${defId}" name="${escapeXml(nodeName)}" type="NODE">\n` +
        `${defParts.join('\n')}\n` +
        `    </node>`
    );

    const instParts: string[] = [];
    if (!isIdentityMatrix(object.matrix)) {
      if (convertToZUp) {
        tempMatrix.multiplyMatrices(yUpToZUp, object.matrix).multiply(zUpToYUp);
      } else {
        tempMatrix.copy(object.matrix);
      }
      tempMatrix.transpose();
      const matrixValues = tempMatrix.toArray().map((v) => formatFloat(v)).join(' ');
      instParts.push(`${innerIndent}<matrix sid="transform">${matrixValues}</matrix>`);
    }
    instParts.push(`${innerIndent}<instance_node url="#${defId}"/>`);

    return (
      `${indent}<node id="${instId}" name="${escapeXml(nodeName)}" type="NODE">\n` +
      `${instParts.join('\n')}\n` +
      `${indent}</node>`
    );
  };

  const sceneNodes: string[] = [];
  if (root instanceof THREE.Scene) {
    for (const child of root.children) {
      const xml = await processNode(child, 3);
      if (xml) sceneNodes.push(xml);
    }
  } else {
    const xml = await processNode(root, 3);
    if (xml) sceneNodes.push(xml);
  }

  const timestamp = new Date().toISOString();
  const sections: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">`,
    `  <asset>`,
    `    <contributor>`,
    `      <authoring_tool>${escapeXml(authoringTool)}</authoring_tool>`,
    `    </contributor>`,
    `    <created>${timestamp}</created>`,
    `    <modified>${timestamp}</modified>`,
    `    <unit meter="${formatFloat(unitMeter)}" name="${escapeXml(unitName)}"/>`,
    `    <up_axis>${upAxis}</up_axis>`,
    `  </asset>`,
  ];

  if (libraryImages.length > 0) {
    sections.push(`  <library_images>\n${libraryImages.join('\n')}\n  </library_images>`);
  }
  if (libraryEffects.length > 0) {
    sections.push(`  <library_effects>\n${libraryEffects.join('\n')}\n  </library_effects>`);
  }
  if (libraryMaterials.length > 0) {
    sections.push(`  <library_materials>\n${libraryMaterials.join('\n')}\n  </library_materials>`);
  }
  if (libraryGeometries.length > 0) {
    sections.push(`  <library_geometries>\n${libraryGeometries.join('\n')}\n  </library_geometries>`);
  }
  if (libraryNodes.length > 0) {
    sections.push(`  <library_nodes>\n${libraryNodes.join('\n')}\n  </library_nodes>`);
  }

  sections.push(
    `  <library_visual_scenes>\n` +
      `    <visual_scene id="Scene" name="Scene">\n` +
      (sceneNodes.length > 0 ? `${sceneNodes.join('\n')}\n` : '') +
      `    </visual_scene>\n` +
      `  </library_visual_scenes>`
  );
  sections.push(`  <scene>\n    <instance_visual_scene url="#Scene"/>\n  </scene>`);
  sections.push(`</COLLADA>`);

  return {
    dae: `${sections.join('\n')}\n`,
    textures,
  };
}
