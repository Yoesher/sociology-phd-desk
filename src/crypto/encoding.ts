import {
  MAX_CIPHERTEXT_BYTES,
  MAX_PROTECTED_HEADER_BYTES,
} from './constants'
import { EncryptedContainerFormatError } from './errors'

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const BASE64_CHUNK_BYTES = 0x8000

function encodedLengthLimit(byteLimit: number): number {
  return Math.ceil((byteLimit * 4) / 3)
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  let difference = 0
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.byteLength; offset += BASE64_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

export function decodeBase64Url(
  value: string,
  byteLimit: number,
  fieldName: string,
): Uint8Array {
  if (
    value.length === 0 ||
    value.length > encodedLengthLimit(byteLimit) ||
    !BASE64URL_PATTERN.test(value) ||
    value.includes('=') ||
    value.length % 4 === 1
  ) {
    throw new EncryptedContainerFormatError(`${fieldName} is not canonical base64url.`)
  }

  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  let decoded: string
  try {
    decoded = atob(padded)
  } catch {
    throw new EncryptedContainerFormatError(`${fieldName} is not valid base64url.`)
  }

  if (decoded.length > byteLimit) {
    throw new EncryptedContainerFormatError(`${fieldName} exceeds its size limit.`)
  }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
  if (encodeBase64Url(bytes) !== value) {
    throw new EncryptedContainerFormatError(`${fieldName} is not canonical base64url.`)
  }
  return bytes
}

export function decodeProtectedBase64Url(value: string): Uint8Array {
  return decodeBase64Url(value, MAX_PROTECTED_HEADER_BYTES, 'protected')
}

export function decodeCiphertextBase64Url(value: string): Uint8Array {
  return decodeBase64Url(value, MAX_CIPHERTEXT_BYTES, 'ciphertext')
}

export function decodeUtf8Fatal(bytes: Uint8Array, fieldName: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new EncryptedContainerFormatError(`${fieldName} is not valid UTF-8.`)
  }
}
