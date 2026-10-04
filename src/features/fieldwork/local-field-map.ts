import type { FieldMapImage } from '../../models/domain'

export const MAX_FIELD_MAP_IMAGE_BYTES = 2 * 1024 * 1024
export const MAX_WORKSPACE_FIELD_MAP_IMAGE_BYTES = 4 * 1024 * 1024
export const MAX_FIELD_MAP_BYTES = MAX_FIELD_MAP_IMAGE_BYTES
export const MAX_WORKSPACE_FIELD_MAP_BYTES = MAX_WORKSPACE_FIELD_MAP_IMAGE_BYTES
export const MAX_FIELD_MAP_EDGE = 8192
export const MAX_FIELD_MAP_PIXELS = 16_000_000

const boundedDimensions = (width: number, height: number) =>
  Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
  width <= MAX_FIELD_MAP_EDGE && height <= MAX_FIELD_MAP_EDGE && width * height <= MAX_FIELD_MAP_PIXELS

const isControlCharacter = (character: string) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127

function imageHeader(bytes: Uint8Array): Pick<FieldMapImage, 'mimeType' | 'width' | 'height'> | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length >= 45 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) {
    if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null
    const width = view.getUint32(16), height = view.getUint32(20)
    if (!boundedDimensions(width, height) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28]! > 1) return null
    const allowedDepths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }
    if (!allowedDepths[bytes[25]!]?.includes(bytes[24]!)) return null
    let offset = 8, hasData = false
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset)
      if (size > bytes.length - offset - 12) return null
      const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
      if (['acTL', 'fcTL', 'fdAT'].includes(kind)) return null
      if (offset !== 8 && kind === 'IHDR') return null
      if (kind === 'IDAT' && size > 0) hasData = true
      offset += size + 12
      if (kind === 'IEND') return size === 0 && offset === bytes.length && hasData ? { mimeType: 'image/png', width, height } : null
    }
    return null
  }
  if (bytes.length < 16 || bytes[0] !== 255 || bytes[1] !== 216) return null
  let offset = 2, dimensions: { width: number; height: number } | null = null, hasScan = false
  while (offset < bytes.length) {
    if (bytes[offset] !== 255) { if (!hasScan) return null; offset++; continue }
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === undefined) return null
    if (marker === 0 || (marker >= 208 && marker <= 215)) { if (!hasScan) return null; continue }
    if (marker === 217) return dimensions && hasScan && offset === bytes.length ? { mimeType: 'image/jpeg', ...dimensions } : null
    if (marker === 216 || offset + 2 > bytes.length) return null
    const size = view.getUint16(offset)
    if (size < 2 || offset + size > bytes.length) return null
    if ([192, 193, 194].includes(marker)) {
      if (size < 11 || bytes[offset + 2] !== 8 || size !== 8 + 3 * bytes[offset + 7]!) return null
      const height = view.getUint16(offset + 3), width = view.getUint16(offset + 5)
      if (!boundedDimensions(width, height) || (dimensions && (dimensions.width !== width || dimensions.height !== height))) return null
      dimensions = { width, height }
    } else if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) return null
    if (marker === 218) { if (!dimensions) return null; hasScan = true }
    offset += size
  }
  return null
}

export function isValidFieldMapImage(value: unknown): value is FieldMapImage {
  if (!value || typeof value !== 'object') return false
  const image = value as FieldMapImage
  if (typeof image.fileName !== 'string' || !image.fileName.trim() || image.fileName.length > 255 || /[/\\]/.test(image.fileName) || Array.from(image.fileName).some(isControlCharacter)) return false
  if (!Number.isInteger(image.size) || image.size < 16 || image.size > MAX_FIELD_MAP_BYTES || !boundedDimensions(image.width, image.height)) return false
  if (typeof image.base64 !== 'string' || image.base64.length > Math.ceil(MAX_FIELD_MAP_BYTES / 3) * 4 || image.base64.length % 4 !== 0) return false
  const padding = image.base64.endsWith('==') ? 2 : image.base64.endsWith('=') ? 1 : 0
  if (image.base64.length * 3 / 4 - padding !== image.size) return false
  try {
    const binary = atob(image.base64)
    if (btoa(binary) !== image.base64) return false
    const header = imageHeader(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
    return Boolean(header && image.mimeType === header.mimeType && image.width === header.width && image.height === header.height)
  } catch { return false }
}

export async function readLocalFieldMapImage(file: File): Promise<FieldMapImage> {
  if (file.size < 16 || file.size > MAX_FIELD_MAP_BYTES) throw new Error('map-image-size')
  if (file.type && file.type !== 'image/png' && file.type !== 'image/jpeg') throw new Error('map-image-invalid')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const header = imageHeader(bytes)
  if (!header || bytes.length !== file.size || (file.type && file.type !== header.mimeType)) throw new Error('map-image-invalid')
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  const fileName = Array.from(file.name.split(/[\\/]/).pop() || '').filter((character) => !isControlCharacter(character)).join('').trim().slice(0, 255) || (header.mimeType === 'image/png' ? 'map.png' : 'map.jpg')
  const image = { ...header, fileName, size: bytes.length, base64: btoa(binary) }
  if (!isValidFieldMapImage(image)) throw new Error('map-image-invalid')
  // Dimensions are bounded before decoding, avoiding a small compressed image with huge pixels.
  const bitmap = await createImageBitmap(new Blob([bytes], { type: image.mimeType }), { imageOrientation: 'none' })
  try {
    if (bitmap.width !== image.width || bitmap.height !== image.height) throw new Error('map-image-invalid')
  } finally { bitmap.close() }
  return image
}

export function fieldMapPosition(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
  if (rect.width <= 0 || rect.height <= 0) return null
  return { x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) }
}
