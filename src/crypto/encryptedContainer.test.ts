/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import {
  MAX_CIPHERTEXT_BYTES,
  PBKDF2_SALT_BYTES,
} from './constants'
import {
  createEncryptedBackup,
  createLocalWorkspaceContainer,
  inspectBackupProtectedHeader,
  inspectLocalProtectedHeader,
  openEncryptedBackup,
  openLocalWorkspaceContainer,
  parseEncryptedBackupContainer,
  serializeEncryptedBackupContainer,
  validateNewPassphrase,
  type BinaryEncryptedContainer,
  type LocalContainerExpectations,
} from './encryptedContainer'
import { decodeBase64Url, encodeBase64Url } from './encoding'
import {
  EncryptedContainerAuthenticationError,
  EncryptedContainerFormatError,
  GENERIC_AUTHENTICATION_FAILURE_MESSAGE,
  PassphrasePolicyError,
} from './errors'
import {
  createSyntheticLegacyV3Backup,
  createSyntheticLegacyV3LocalContainer,
} from './legacyV3TestFixture.test-helper'

const PASSPHRASE = 'Correct horse battery staple 2026'
const OTHER_PASSPHRASE = 'correct horse battery staple 2026'
const ANCHOR = new Date('2026-08-12T08:00:00.000Z')

beforeAll(() => {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.randomUUID !== 'function') {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    })
  }
})

function cloneContainer(container: BinaryEncryptedContainer): BinaryEncryptedContainer {
  return {
    protected: new Uint8Array(container.protected),
    iv: new Uint8Array(container.iv),
    ciphertext: new Uint8Array(container.ciphertext),
  }
}

function localExpectations(): LocalContainerExpectations {
  return {
    bindingId: globalThis.crypto.randomUUID(),
    storageRevision: 0,
    keyInvocation: 1,
  }
}

function rewriteHeader(
  container: BinaryEncryptedContainer,
  mutate: (header: Record<string, unknown>) => void,
): BinaryEncryptedContainer {
  const next = cloneContainer(container)
  const header = JSON.parse(new TextDecoder().decode(next.protected)) as Record<
    string,
    unknown
  >
  mutate(header)
  next.protected = new TextEncoder().encode(JSON.stringify(header))
  return next
}

async function expectGenericAuthenticationFailure(promise: Promise<unknown>): Promise<void> {
  let thrown: unknown
  try {
    await promise
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(EncryptedContainerAuthenticationError)
  expect((thrown as Error).message).toBe(GENERIC_AUTHENTICATION_FAILURE_MESSAGE)
}

describe('encrypted container contract', () => {
  it('authenticates v3 local and backup payloads before migrating them in memory', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const expected = localExpectations()
    const legacyLocal = await createSyntheticLegacyV3LocalContainer(
      workspace,
      PASSPHRASE,
      expected,
    )
    const opened = await openLocalWorkspaceContainer(
      legacyLocal,
      PASSPHRASE,
      expected,
    )
    expect(opened.payloadVersion).toBe(3)
    expect(opened.workspace).toEqual({
      ...workspace,
      theoryMemos: [],
      literatureExternalReferences: [],
    })
    opened.session.dispose()

    const legacyBackup = await createSyntheticLegacyV3Backup(workspace, PASSPHRASE)
    expect(await openEncryptedBackup(legacyBackup, PASSPHRASE)).toEqual({
      ...workspace,
      theoryMemos: [],
      literatureExternalReferences: [],
    })
    await expectGenericAuthenticationFailure(
      openEncryptedBackup(legacyBackup, OTHER_PASSPHRASE),
    )
    const tampered = JSON.parse(legacyBackup) as Record<string, string>
    const ciphertext = decodeBase64Url(
      tampered['ciphertext']!,
      MAX_CIPHERTEXT_BYTES,
      'ciphertext',
    )
    ciphertext[0] ^= 1
    tampered['ciphertext'] = encodeBase64Url(ciphertext)
    await expectGenericAuthenticationFailure(
      openEncryptedBackup(JSON.stringify(tampered), PASSPHRASE),
    )
  })

  it('round-trips a local workspace with fixed protected metadata', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const expected = localExpectations()
    const created = await createLocalWorkspaceContainer(workspace, PASSPHRASE, expected)
    const header = inspectLocalProtectedHeader(created.container)

    expect(header.bindingId).toBe(expected.bindingId)
    expect(header.storageRevision).toBe(0)
    expect(header.keyInvocation).toBe(1)
    expect(header.payloadVersion).toBe(5)
    expect(header.kdf.iterations).toBe(600_000)
    expect(header.cipher.keyLength).toBe(256)
    expect(created.container.iv).toHaveLength(12)

    const opened = await openLocalWorkspaceContainer(
      created.container,
      PASSPHRASE,
      expected,
    )
    expect(opened.workspace).toEqual(workspace)
    expect(opened.payloadVersion).toBe(5)
    expect(opened.session.disposed).toBe(false)
    opened.session.dispose()
    created.session.dispose()
  })

  it('normalizes NFC but preserves case and spaces exactly', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const expected = localExpectations()
    const decomposed = 'Cafe\u0301 research passphrase 2026'
    const composed = 'Caf\u00e9 research passphrase 2026'
    const created = await createLocalWorkspaceContainer(workspace, decomposed, expected)

    const opened = await openLocalWorkspaceContainer(created.container, composed, expected)
    expect(opened.workspace).toEqual(workspace)
    opened.session.dispose()

    await expectGenericAuthenticationFailure(
      openLocalWorkspaceContainer(created.container, composed.toUpperCase(), expected),
    )
    await expectGenericAuthenticationFailure(
      openLocalWorkspaceContainer(created.container, ` ${composed}`, expected),
    )
    created.session.dispose()
  })

  it('enforces the new-passphrase code-point policy after NFC normalization', () => {
    expect(validateNewPassphrase('123456789012345')).toBe('123456789012345')
    expect(() => validateNewPassphrase('12345678901234')).toThrow(PassphrasePolicyError)
    expect(() => validateNewPassphrase('x'.repeat(1025))).toThrow(PassphrasePolicyError)
    expect(validateNewPassphrase(` ${'x'.repeat(14)}`)).toBe(` ${'x'.repeat(14)}`)
  })

  it('maps wrong passphrase and authenticated-field tampering to one generic failure', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const expected = localExpectations()
    const created = await createLocalWorkspaceContainer(workspace, PASSPHRASE, expected)

    const headerTampered = rewriteHeader(created.container, (header) => {
      header['bindingId'] = globalThis.crypto.randomUUID()
    })
    const saltTampered = rewriteHeader(created.container, (header) => {
      const kdf = header['kdf'] as Record<string, unknown>
      const salt = decodeBase64Url(String(kdf['salt']), PBKDF2_SALT_BYTES, 'salt')
      salt[0] ^= 1
      kdf['salt'] = encodeBase64Url(salt)
    })
    const ivTampered = cloneContainer(created.container)
    ivTampered.iv[0] ^= 1
    const bodyTampered = cloneContainer(created.container)
    bodyTampered.ciphertext[0] ^= 1
    const tagTampered = cloneContainer(created.container)
    tagTampered.ciphertext[tagTampered.ciphertext.length - 1] ^= 1

    await expectGenericAuthenticationFailure(
      openLocalWorkspaceContainer(created.container, OTHER_PASSPHRASE, expected),
    )
    for (const container of [
      headerTampered,
      saltTampered,
      ivTampered,
      bodyTampered,
      tagTampered,
    ]) {
      await expectGenericAuthenticationFailure(
        openLocalWorkspaceContainer(container, PASSPHRASE, expected),
      )
    }
    created.session.dispose()
  })

  it('rejects unknown, noncanonical, malformed, and oversized input before decrypting', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const expected = localExpectations()
    const created = await createLocalWorkspaceContainer(workspace, PASSPHRASE, expected)
    const unknownHeader = rewriteHeader(created.container, (header) => {
      header['unknown'] = true
    })
    const noncanonicalHeader = cloneContainer(created.container)
    noncanonicalHeader.protected = new TextEncoder().encode(
      `${new TextDecoder().decode(noncanonicalHeader.protected)} `,
    )
    const oversizedCiphertext = cloneContainer(created.container)
    oversizedCiphertext.ciphertext = new Uint8Array(MAX_CIPHERTEXT_BYTES + 1)

    expect(() => inspectLocalProtectedHeader(unknownHeader)).toThrow(
      EncryptedContainerFormatError,
    )
    expect(() => inspectLocalProtectedHeader(noncanonicalHeader)).toThrow(
      EncryptedContainerFormatError,
    )
    expect(() => inspectLocalProtectedHeader(oversizedCiphertext)).toThrow(
      EncryptedContainerFormatError,
    )
    await expect(
      openLocalWorkspaceContainer(
        { ...created.container, iv: new Uint8Array(11) },
        PASSPHRASE,
        expected,
      ),
    ).rejects.toBeInstanceOf(EncryptedContainerFormatError)
    created.session.dispose()
  })

  it('uses fresh local IVs and independent backup salt/IV pairs', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const expected = localExpectations()
    const created = await createLocalWorkspaceContainer(workspace, PASSPHRASE, expected)
    const secondLocal = await created.session.encrypt(workspace, 0, 2)
    expect(encodeBase64Url(secondLocal.iv)).not.toBe(encodeBase64Url(created.container.iv))

    const firstBackup = await createEncryptedBackup(workspace, PASSPHRASE)
    const secondBackup = await createEncryptedBackup(workspace, PASSPHRASE)
    const firstHeader = inspectBackupProtectedHeader(firstBackup)
    const secondHeader = inspectBackupProtectedHeader(secondBackup)
    const firstContainer = parseEncryptedBackupContainer(firstBackup)
    const secondContainer = parseEncryptedBackupContainer(secondBackup)
    expect(firstHeader.kdf.salt).not.toBe(secondHeader.kdf.salt)
    expect(encodeBase64Url(firstContainer.iv)).not.toBe(encodeBase64Url(secondContainer.iv))
    created.session.dispose()
  })

  it('round-trips encrypted backups and rejects noncanonical wrappers and illegal base64url', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const backup = await createEncryptedBackup(workspace, PASSPHRASE)
    expect(inspectBackupProtectedHeader(backup).payloadVersion).toBe(5)
    expect(await openEncryptedBackup(backup, PASSPHRASE)).toEqual(workspace)
    await expectGenericAuthenticationFailure(openEncryptedBackup(backup, OTHER_PASSPHRASE))
    expect(() => parseEncryptedBackupContainer(` ${backup}`)).toThrow(
      EncryptedContainerFormatError,
    )
    expect(() => parseEncryptedBackupContainer(`${backup}\n`)).toThrow(
      EncryptedContainerFormatError,
    )

    const parsed = JSON.parse(backup) as Record<string, string>
    parsed['iv'] = `${parsed['iv']}=`
    expect(() => parseEncryptedBackupContainer(JSON.stringify(parsed))).toThrow(
      EncryptedContainerFormatError,
    )
    const withUnknown = JSON.parse(backup) as Record<string, unknown>
    withUnknown['unknown'] = true
    expect(() => parseEncryptedBackupContainer(JSON.stringify(withUnknown))).toThrow(
      EncryptedContainerFormatError,
    )
  })

  it('does not expose a plaintext canary in local or backup containers', async () => {
    const workspace = createDemoWorkspace(ANCHOR)
    const canary = 'PLAINTEXT-CANARY-DO-NOT-PERSIST'
    workspace.workspace.name = canary
    const expected = localExpectations()
    const created = await createLocalWorkspaceContainer(workspace, PASSPHRASE, expected)
    const localBytes = [
      ...created.container.protected,
      ...created.container.iv,
      ...created.container.ciphertext,
    ]
    expect(new TextDecoder('latin1').decode(Uint8Array.from(localBytes))).not.toContain(canary)
    const backup = await createEncryptedBackup(workspace, PASSPHRASE)
    expect(backup).not.toContain(canary)
    expect(serializeEncryptedBackupContainer(parseEncryptedBackupContainer(backup))).toBe(backup)
    created.session.dispose()
  })
})
