import type { FieldMap, FieldMapImage, WorkspaceData } from '../models/domain'

/** Tiny synthetic PNG used solely to exercise portable local-image bytes. */
export const SYNTHETIC_FIELD_MAP_IMAGE: FieldMapImage = {
  fileName: 'synthetic-research-sketch.png',
  mimeType: 'image/png',
  size: 68,
  width: 1,
  height: 1,
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=',
}

export function syntheticFieldMap(workspace: WorkspaceData, id = 'synthetic-field-map'): FieldMap {
  const site = workspace.fieldSites[0]
  if (!site) throw new Error('Synthetic field-map fixture requires a field site.')
  return {
    id,
    projectId: site.projectId,
    title: 'Synthetic local research sketch',
    image: { ...SYNTHETIC_FIELD_MAP_IMAGE },
    markers: [{ fieldSiteId: site.id, x: 0.25, y: 0.75 }],
    createdAt: workspace.exportedAt,
    updatedAt: workspace.exportedAt,
    isDemo: false,
  }
}

/** A legal PNG tEXt ancillary chunk pads the file, while retaining the tiny bitmap. */
export function paddedSyntheticFieldMapImage(size: number): FieldMapImage {
  const original = Uint8Array.from(atob(SYNTHETIC_FIELD_MAP_IMAGE.base64), (character) => character.charCodeAt(0))
  const dataLength = size - original.length - 12
  if (dataLength < 2) throw new Error('Padding requires a tEXt keyword and separator.')
  const chunk = new Uint8Array(dataLength + 12)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, dataLength)
  chunk.set(new TextEncoder().encode('tEXt'), 4)
  chunk[8] = 83
  chunk[9] = 0
  chunk.fill(120, 10, chunk.length - 4)
  let crc = 0xffffffff
  for (const byte of chunk.subarray(4, chunk.length - 4)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0)
  const bytes = new Uint8Array(size)
  bytes.set(original.subarray(0, 33))
  bytes.set(chunk, 33)
  bytes.set(original.subarray(33), 33 + chunk.length)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return { ...SYNTHETIC_FIELD_MAP_IMAGE, size: bytes.length, base64: btoa(binary) }
}
