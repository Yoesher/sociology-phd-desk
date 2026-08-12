import { WORKSPACE_APPLICATION, type WorkspaceData } from '../models/domain'
import {
  AES_GCM_IV_BYTES,
  AES_GCM_KEY_BITS,
  AES_GCM_TAG_BITS,
  ENCRYPTED_BACKUP_PURPOSE,
  ENCRYPTED_CONTAINER_VERSION,
  LEGACY_ENCRYPTED_PAYLOAD_VERSION,
  LOCAL_WORKSPACE_PURPOSE,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_BYTES,
} from './constants'
import { encodeBase64Url } from './encoding'
import type { BinaryEncryptedContainer, LocalContainerExpectations } from './encryptedContainer'

function historicalWorkspaceV3(workspace: WorkspaceData): Record<string, unknown> {
  const legacy = structuredClone(workspace) as unknown as Record<string, unknown>
  legacy['version'] = LEGACY_ENCRYPTED_PAYLOAD_VERSION
  delete legacy['theoryMemos']
  return legacy
}

async function deriveLegacyFixtureKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const saltBytes = Uint8Array.from(salt)
  const material = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: saltBytes,
    },
    material,
    { name: 'AES-GCM', length: AES_GCM_KEY_BITS },
    false,
    ['encrypt'],
  )
}

async function encryptLegacyFixture(
  workspace: WorkspaceData,
  passphrase: string,
  protectedHeader: Record<string, unknown>,
  salt: Uint8Array,
): Promise<BinaryEncryptedContainer> {
  const protectedBytes = new TextEncoder().encode(JSON.stringify(protectedHeader))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const plaintext = new TextEncoder().encode(
    JSON.stringify(historicalWorkspaceV3(workspace)),
  )
  const key = await deriveLegacyFixtureKey(passphrase, salt)
  const encrypted = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: protectedBytes,
      tagLength: AES_GCM_TAG_BITS,
    },
    key,
    plaintext,
  )
  return {
    protected: protectedBytes,
    iv,
    ciphertext: new Uint8Array(encrypted),
  }
}

function kdfHeader(salt: Uint8Array): Record<string, unknown> {
  return {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: encodeBase64Url(salt),
    normalization: 'NFC',
  }
}

function cipherHeader(): Record<string, unknown> {
  return {
    name: 'AES-GCM',
    keyLength: AES_GCM_KEY_BITS,
    tagLength: AES_GCM_TAG_BITS,
  }
}

export async function createSyntheticLegacyV3LocalContainer(
  workspace: WorkspaceData,
  passphrase: string,
  expected: LocalContainerExpectations,
): Promise<BinaryEncryptedContainer> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  return encryptLegacyFixture(
    workspace,
    passphrase,
    {
      application: WORKSPACE_APPLICATION,
      purpose: LOCAL_WORKSPACE_PURPOSE,
      containerVersion: ENCRYPTED_CONTAINER_VERSION,
      payloadVersion: LEGACY_ENCRYPTED_PAYLOAD_VERSION,
      bindingId: expected.bindingId,
      storageRevision: expected.storageRevision,
      keyInvocation: expected.keyInvocation,
      kdf: kdfHeader(salt),
      cipher: cipherHeader(),
    },
    salt,
  )
}

export async function createSyntheticLegacyV3Backup(
  workspace: WorkspaceData,
  passphrase: string,
): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const container = await encryptLegacyFixture(
    workspace,
    passphrase,
    {
      application: WORKSPACE_APPLICATION,
      purpose: ENCRYPTED_BACKUP_PURPOSE,
      containerVersion: ENCRYPTED_CONTAINER_VERSION,
      payloadVersion: LEGACY_ENCRYPTED_PAYLOAD_VERSION,
      kdf: kdfHeader(salt),
      cipher: cipherHeader(),
    },
    salt,
  )
  return JSON.stringify({
    protected: encodeBase64Url(container.protected),
    iv: encodeBase64Url(container.iv),
    ciphertext: encodeBase64Url(container.ciphertext),
  })
}
