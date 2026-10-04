import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FieldMapImage } from '../../models/domain'
import { fieldMapPosition, isValidFieldMapImage, MAX_FIELD_MAP_IMAGE_BYTES, readLocalFieldMapImage } from './local-field-map'

const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII='
const image: FieldMapImage = { fileName: 'SYNTHETIC.png', mimeType: 'image/png', size: 68, width: 1, height: 1, base64 }
const bytes = () => Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
function localFile(name = 'SYNTHETIC.png', type = 'image/png') {
  const content = bytes()
  const file = new File([content], name, { type })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => content.buffer })
  return file
}
afterEach(() => vi.unstubAllGlobals())

describe('bounded local map image boundary', () => {
  it('validates the real PNG fixture with canonical bytes, MIME and dimensions', () => {
    expect(isValidFieldMapImage(image)).toBe(true)
    for (const invalid of [null, {}, { ...image, size: 69 }, { ...image, width: 2 }, { ...image, mimeType: 'image/svg+xml' }, { ...image, base64: base64 + '\n' }, { ...image, fileName: '../image.png' }, { ...image, fileName: 'x'.repeat(256) }, { ...image, fileName: 'unsafe\n.png' }]) expect(isValidFieldMapImage(invalid)).toBe(false)
  })
  it('rejects truncated chunks, trailing payloads and compressed-image dimension bombs', () => {
    for (const [width, height] of [[8193, 1], [4096, 4096], [0, 1]]) {
      const content = bytes()
      const view = new DataView(content.buffer)
      view.setUint32(16, width!)
      view.setUint32(20, height!)
      expect(isValidFieldMapImage({ ...image, width, height, base64: btoa(String.fromCharCode(...content)) })).toBe(false)
    }
    const truncated = bytes().slice(0, -2)
    expect(isValidFieldMapImage({ ...image, size: truncated.length, base64: btoa(String.fromCharCode(...truncated)) })).toBe(false)
    expect(isValidFieldMapImage({ ...image, size: 69, base64: btoa(atob(base64) + 'x') })).toBe(false)
    const original = bytes()
    const animationChunk = new Uint8Array([0,0,0,8,97,99,84,76,0,0,0,1,0,0,0,0,0,0,0,0])
    const animated = new Uint8Array(original.length + animationChunk.length)
    animated.set(original.subarray(0, 33))
    animated.set(animationChunk, 33)
    animated.set(original.subarray(33), 53)
    expect(isValidFieldMapImage({ ...image, size: animated.length, base64: btoa(String.fromCharCode(...animated)) })).toBe(false)
  })
  it('checks JPEG SOF dimensions and rejects mismatched MIME or dimensions', () => {
    const content = new Uint8Array([255,216,255,192,0,11,8,0,1,0,2,1,1,17,0,255,218,0,8,1,1,0,0,63,0,0,255,217])
    const structural = { fileName: 'SYNTHETIC-marker-stream.jpg', mimeType: 'image/jpeg', width: 2, height: 1, size: content.length, base64: btoa(String.fromCharCode(...content)) }
    expect(isValidFieldMapImage(structural)).toBe(true)
    expect(isValidFieldMapImage({ ...structural, width: 1 })).toBe(false)
    expect(isValidFieldMapImage({ ...structural, mimeType: 'image/png' })).toBe(false)
  })
  it('rejects oversize and SVG files before reading or decoding', async () => {
    const read = vi.fn()
    await expect(readLocalFieldMapImage({ size: MAX_FIELD_MAP_IMAGE_BYTES + 1, arrayBuffer: read } as unknown as File)).rejects.toThrow('map-image-size')
    await expect(readLocalFieldMapImage({ size: 100, type: 'image/svg+xml', arrayBuffer: read } as unknown as File)).rejects.toThrow('map-image-invalid')
    expect(read).not.toHaveBeenCalled()
  })
  it('decodes only bounded headers, checks decoded dimensions, cleans filenames and closes the bitmap', async () => {
    const close = vi.fn()
    const decode = vi.fn().mockResolvedValue({ width: 1, height: 1, close })
    vi.stubGlobal('createImageBitmap', decode)
    expect(await readLocalFieldMapImage(localFile('path\\SYNTHETIC\n.png'))).toEqual(image)
    expect(close).toHaveBeenCalledTimes(1)
    decode.mockResolvedValue({ width: 2, height: 1, close })
    await expect(readLocalFieldMapImage(localFile())).rejects.toThrow('map-image-invalid')
    expect(close).toHaveBeenCalledTimes(2)
    decode.mockRejectedValue(new Error('SYNTHETIC decode failure'))
    await expect(readLocalFieldMapImage(localFile())).rejects.toThrow('decode failure')
  })
  it('uses the actual rendered image box for desktop and phone clicks, with bounded edges', () => {
    expect(fieldMapPosition(350, 250, { left: 100, top: 50, width: 500, height: 400 })).toEqual({ x: 0.5, y: 0.5 })
    expect(fieldMapPosition(167, 90, { left: 17, top: 30, width: 300, height: 120 })).toEqual({ x: 0.5, y: 0.5 })
    expect(fieldMapPosition(-5, 500, { left: 0, top: 0, width: 300, height: 100 })).toEqual({ x: 0, y: 1 })
    expect(fieldMapPosition(0, 0, { left: 0, top: 0, width: 0, height: 100 })).toBeNull()
  })
})
