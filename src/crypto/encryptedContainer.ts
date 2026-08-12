import { z } from 'zod'
import type { WorkspaceData } from '../models/domain'
import { WORKSPACE_APPLICATION } from '../models/domain'
import { validateWorkspace } from '../utils/workspace-transfer'
import {
  AES_GCM_IV_BYTES,
  AES_GCM_KEY_BITS,
  AES_GCM_TAG_BITS,
  AES_GCM_TAG_BYTES,
  ENCRYPTED_BACKUP_PURPOSE,
  ENCRYPTED_CONTAINER_VERSION,
  ENCRYPTED_PAYLOAD_VERSION,
  LEGACY_ENCRYPTED_PAYLOAD_VERSION,
  LOCAL_WORKSPACE_PURPOSE,
  MAX_CIPHERTEXT_BYTES,
  MAX_KEY_INVOCATIONS,
  MAX_PASSPHRASE_CODE_POINTS,
  MAX_PLAINTEXT_BYTES,
  MAX_PROTECTED_HEADER_BYTES,
  MIN_NEW_PASSPHRASE_CODE_POINTS,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_BYTES,
  type SupportedEncryptedPayloadVersion,
} from './constants'
import {
  bytesEqual,
  decodeBase64Url,
  decodeCiphertextBase64Url,
  decodeProtectedBase64Url,
  decodeUtf8Fatal,
  encodeBase64Url,
} from './encoding'
import {
  EncryptedContainerAuthenticationError,
  EncryptedContainerFormatError,
  EncryptedPayloadValidationError,
  PassphrasePolicyError,
  WebCryptoUnavailableError,
} from './errors'

export interface BinaryEncryptedContainer {
  protected: Uint8Array
  iv: Uint8Array
  ciphertext: Uint8Array
}

interface KdfHeader {
  name: 'PBKDF2'
  hash: 'SHA-256'
  iterations: typeof PBKDF2_ITERATIONS
  salt: string
  normalization: 'NFC'
}

interface CipherHeader {
  name: 'AES-GCM'
  keyLength: typeof AES_GCM_KEY_BITS
  tagLength: typeof AES_GCM_TAG_BITS
}

export interface LocalProtectedHeader {
  application: typeof WORKSPACE_APPLICATION
  purpose: typeof LOCAL_WORKSPACE_PURPOSE
  containerVersion: typeof ENCRYPTED_CONTAINER_VERSION
  payloadVersion: SupportedEncryptedPayloadVersion
  bindingId: string
  storageRevision: number
  keyInvocation: number
  kdf: KdfHeader
  cipher: CipherHeader
}

export interface BackupProtectedHeader {
  application: typeof WORKSPACE_APPLICATION
  purpose: typeof ENCRYPTED_BACKUP_PURPOSE
  containerVersion: typeof ENCRYPTED_CONTAINER_VERSION
  payloadVersion: SupportedEncryptedPayloadVersion
  kdf: KdfHeader
  cipher: CipherHeader
}

export type ProtectedHeader = LocalProtectedHeader | BackupProtectedHeader

export interface LocalContainerExpectations {
  bindingId: string
  storageRevision: number
  keyInvocation: number
}

const canonicalBase64UrlSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/u)
  .refine((value) => !value.includes('=') && value.length % 4 !== 1)

const kdfHeaderSchema = z
  .object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.literal(PBKDF2_ITERATIONS),
    salt: canonicalBase64UrlSchema,
    normalization: z.literal('NFC'),
  })
  .strict()

const cipherHeaderSchema = z
  .object({
    name: z.literal('AES-GCM'),
    keyLength: z.literal(AES_GCM_KEY_BITS),
    tagLength: z.literal(AES_GCM_TAG_BITS),
  })
  .strict()

const encryptedPayloadVersionSchema = z.union([
  z.literal(LEGACY_ENCRYPTED_PAYLOAD_VERSION),
  z.literal(ENCRYPTED_PAYLOAD_VERSION),
])

const localProtectedHeaderSchema = z
  .object({
    application: z.literal(WORKSPACE_APPLICATION),
    purpose: z.literal(LOCAL_WORKSPACE_PURPOSE),
    containerVersion: z.literal(ENCRYPTED_CONTAINER_VERSION),
    payloadVersion: encryptedPayloadVersionSchema,
    bindingId: z.string().uuid(),
    storageRevision: z.number().int().nonnegative().safe(),
    keyInvocation: z.number().int().min(1).max(MAX_KEY_INVOCATIONS).safe(),
    kdf: kdfHeaderSchema,
    cipher: cipherHeaderSchema,
  })
  .strict()

const backupProtectedHeaderSchema = z
  .object({
    application: z.literal(WORKSPACE_APPLICATION),
    purpose: z.literal(ENCRYPTED_BACKUP_PURPOSE),
    containerVersion: z.literal(ENCRYPTED_CONTAINER_VERSION),
    payloadVersion: encryptedPayloadVersionSchema,
    kdf: kdfHeaderSchema,
    cipher: cipherHeaderSchema,
  })
  .strict()

function getWebCrypto(): Crypto {
  const cryptoApi = globalThis.crypto
  if (
    !cryptoApi ||
    !cryptoApi.subtle ||
    typeof cryptoApi.getRandomValues !== 'function'
  ) {
    throw new WebCryptoUnavailableError()
  }
  return cryptoApi
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return getWebCrypto().getRandomValues(new Uint8Array(length))
}

export function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize('NFC')
}

function passphraseCodePoints(passphrase: string): number {
  return [...passphrase].length
}

export function validateNewPassphrase(passphrase: string): string {
  const normalized = normalizePassphrase(passphrase)
  const length = passphraseCodePoints(normalized)
  if (
    length < MIN_NEW_PASSPHRASE_CODE_POINTS ||
    length > MAX_PASSPHRASE_CODE_POINTS
  ) {
    throw new PassphrasePolicyError(
      `A new passphrase must contain ${MIN_NEW_PASSPHRASE_CODE_POINTS} to ${MAX_PASSPHRASE_CODE_POINTS} Unicode code points after NFC normalization.`,
    )
  }
  return normalized
}

function normalizeUnlockPassphrase(passphrase: string): string {
  const normalized = normalizePassphrase(passphrase)
  const length = passphraseCodePoints(normalized)
  if (length === 0 || length > MAX_PASSPHRASE_CODE_POINTS) {
    throw new EncryptedContainerAuthenticationError()
  }
  return normalized
}

async function deriveAesKey(normalizedPassphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const cryptoApi = getWebCrypto()
  const passphraseBytes = new TextEncoder().encode(normalizedPassphrase)
  const saltBytes = new Uint8Array(salt)
  try {
    const keyMaterial = await cryptoApi.subtle.importKey(
      'raw',
      passphraseBytes,
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    return await cryptoApi.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: saltBytes,
      },
      keyMaterial,
      { name: 'AES-GCM', length: AES_GCM_KEY_BITS },
      false,
      ['encrypt', 'decrypt'],
    )
  } finally {
    passphraseBytes.fill(0)
  }
}

function createKdfHeader(salt: Uint8Array): KdfHeader {
  return {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: encodeBase64Url(salt),
    normalization: 'NFC',
  }
}

function createCipherHeader(): CipherHeader {
  return {
    name: 'AES-GCM',
    keyLength: AES_GCM_KEY_BITS,
    tagLength: AES_GCM_TAG_BITS,
  }
}

function canonicalHeaderObject(header: ProtectedHeader): ProtectedHeader {
  if (header.purpose === LOCAL_WORKSPACE_PURPOSE) {
    return {
      application: WORKSPACE_APPLICATION,
      purpose: LOCAL_WORKSPACE_PURPOSE,
      containerVersion: ENCRYPTED_CONTAINER_VERSION,
      payloadVersion: header.payloadVersion,
      bindingId: header.bindingId,
      storageRevision: header.storageRevision,
      keyInvocation: header.keyInvocation,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: header.kdf.salt,
        normalization: 'NFC',
      },
      cipher: createCipherHeader(),
    }
  }
  return {
    application: WORKSPACE_APPLICATION,
    purpose: ENCRYPTED_BACKUP_PURPOSE,
    containerVersion: ENCRYPTED_CONTAINER_VERSION,
    payloadVersion: header.payloadVersion,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: header.kdf.salt,
      normalization: 'NFC',
    },
    cipher: createCipherHeader(),
  }
}

function serializeProtectedHeader(header: ProtectedHeader): Uint8Array {
  const parsed =
    header.purpose === LOCAL_WORKSPACE_PURPOSE
      ? localProtectedHeaderSchema.safeParse(header)
      : backupProtectedHeaderSchema.safeParse(header)
  if (!parsed.success) {
    throw new EncryptedContainerFormatError('The protected header is unsupported or invalid.')
  }
  decodeBase64Url(parsed.data.kdf.salt, PBKDF2_SALT_BYTES, 'kdf.salt')
  const encoded = new TextEncoder().encode(
    JSON.stringify(canonicalHeaderObject(parsed.data)),
  )
  if (encoded.byteLength > MAX_PROTECTED_HEADER_BYTES) {
    throw new EncryptedContainerFormatError('The protected header exceeds its size limit.')
  }
  return encoded
}

function parseProtectedHeader(
  bytes: Uint8Array,
  purpose: typeof LOCAL_WORKSPACE_PURPOSE,
): LocalProtectedHeader
function parseProtectedHeader(
  bytes: Uint8Array,
  purpose: typeof ENCRYPTED_BACKUP_PURPOSE,
): BackupProtectedHeader
function parseProtectedHeader(
  bytes: Uint8Array,
  purpose: typeof LOCAL_WORKSPACE_PURPOSE | typeof ENCRYPTED_BACKUP_PURPOSE,
): ProtectedHeader {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PROTECTED_HEADER_BYTES) {
    throw new EncryptedContainerFormatError('The protected header has an invalid length.')
  }

  let input: unknown
  try {
    input = JSON.parse(decodeUtf8Fatal(bytes, 'protected header')) as unknown
  } catch (error) {
    if (error instanceof EncryptedContainerFormatError) throw error
    throw new EncryptedContainerFormatError('The protected header is not valid JSON.')
  }

  const parsed =
    purpose === LOCAL_WORKSPACE_PURPOSE
      ? localProtectedHeaderSchema.safeParse(input)
      : backupProtectedHeaderSchema.safeParse(input)
  if (!parsed.success) {
    throw new EncryptedContainerFormatError('The protected header is unsupported or invalid.')
  }

  const header = parsed.data as ProtectedHeader
  const salt = decodeBase64Url(header.kdf.salt, PBKDF2_SALT_BYTES, 'kdf.salt')
  if (salt.byteLength !== PBKDF2_SALT_BYTES) {
    throw new EncryptedContainerFormatError('kdf.salt has an invalid length.')
  }

  if (!bytesEqual(bytes, serializeProtectedHeader(header))) {
    throw new EncryptedContainerFormatError('The protected header is not canonical.')
  }
  return header
}

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) &&
    Object.prototype.toString.call(value) === '[object Uint8Array]'
  )
}

function cloneAndValidateContainer(container: BinaryEncryptedContainer): BinaryEncryptedContainer {
  if (!isUint8Array(container.protected)) {
    throw new EncryptedContainerFormatError('The protected header must be a byte array.')
  }
  if (!isUint8Array(container.iv)) {
    throw new EncryptedContainerFormatError('The IV must be a byte array.')
  }
  if (!isUint8Array(container.ciphertext)) {
    throw new EncryptedContainerFormatError('The ciphertext must be a byte array.')
  }
  if (
    container.protected.byteLength === 0 ||
    container.protected.byteLength > MAX_PROTECTED_HEADER_BYTES
  ) {
    throw new EncryptedContainerFormatError('The protected header has an invalid length.')
  }
  if (container.iv.byteLength !== AES_GCM_IV_BYTES) {
    throw new EncryptedContainerFormatError('The AES-GCM IV must be 12 bytes.')
  }
  if (
    container.ciphertext.byteLength < AES_GCM_TAG_BYTES ||
    container.ciphertext.byteLength > MAX_CIPHERTEXT_BYTES
  ) {
    throw new EncryptedContainerFormatError('The ciphertext has an invalid length.')
  }
  return {
    protected: new Uint8Array(container.protected),
    iv: new Uint8Array(container.iv),
    ciphertext: new Uint8Array(container.ciphertext),
  }
}

function validatedPayload(
  workspace: unknown,
  authenticatedPayloadVersion: SupportedEncryptedPayloadVersion,
  operation: string,
): WorkspaceData {
  if (
    typeof workspace !== 'object' ||
    workspace === null ||
    Array.isArray(workspace) ||
    (workspace as Record<string, unknown>)['version'] !== authenticatedPayloadVersion
  ) {
    throw new EncryptedPayloadValidationError(
      `The ${operation} payload does not match authenticated portable workspace v${authenticatedPayloadVersion}.`,
    )
  }
  const result = validateWorkspace(workspace)
  if (!result.success) {
    throw new EncryptedPayloadValidationError(`The ${operation} workspace failed validation.`)
  }
  return result.data
}

function serializePayload(workspace: WorkspaceData): Uint8Array {
  const validated = validatedPayload(
    workspace,
    ENCRYPTED_PAYLOAD_VERSION,
    'encryption',
  )
  const bytes = new TextEncoder().encode(JSON.stringify(validated))
  if (bytes.byteLength > MAX_PLAINTEXT_BYTES) {
    bytes.fill(0)
    throw new EncryptedPayloadValidationError('The workspace exceeds the encrypted payload size limit.')
  }
  return bytes
}

async function encryptBytes(
  key: CryptoKey,
  header: ProtectedHeader,
  plaintext: Uint8Array,
): Promise<BinaryEncryptedContainer> {
  const cryptoApi = getWebCrypto()
  const protectedBytes = serializeProtectedHeader(header)
  const iv = randomBytes(AES_GCM_IV_BYTES)
  const additionalData = new Uint8Array(protectedBytes)
  const plaintextBytes = new Uint8Array(plaintext)
  try {
    const encrypted = await cryptoApi.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData,
        tagLength: AES_GCM_TAG_BITS,
      },
      key,
      plaintextBytes,
    )
    const ciphertext = new Uint8Array(encrypted)
    if (ciphertext.byteLength > MAX_CIPHERTEXT_BYTES) {
      ciphertext.fill(0)
      throw new EncryptedPayloadValidationError('The encrypted payload exceeds its size limit.')
    }
    return { protected: protectedBytes, iv, ciphertext }
  } catch (error) {
    iv.fill(0)
    if (error instanceof EncryptedPayloadValidationError) throw error
    throw error
  }
}

async function decryptBytes(
  key: CryptoKey,
  container: BinaryEncryptedContainer,
  authenticatedPayloadVersion: SupportedEncryptedPayloadVersion,
): Promise<WorkspaceData> {
  const cryptoApi = getWebCrypto()
  const iv = new Uint8Array(container.iv)
  const additionalData = new Uint8Array(container.protected)
  const ciphertext = new Uint8Array(container.ciphertext)
  let plaintext: Uint8Array | null = null
  try {
    const decrypted = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData,
        tagLength: AES_GCM_TAG_BITS,
      },
      key,
      ciphertext,
    )
    plaintext = new Uint8Array(decrypted)
    const json = new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
    const input = JSON.parse(json) as unknown
    return validatedPayload(input, authenticatedPayloadVersion, 'decrypted')
  } catch (error) {
    if (error instanceof WebCryptoUnavailableError) throw error
    throw new EncryptedContainerAuthenticationError()
  } finally {
    plaintext?.fill(0)
  }
}

function assertLocalPayloadMatches(
  workspace: WorkspaceData,
  header: LocalProtectedHeader,
  expected: LocalContainerExpectations,
): void {
  if (
    header.bindingId !== expected.bindingId ||
    header.storageRevision !== expected.storageRevision ||
    header.keyInvocation !== expected.keyInvocation ||
    workspace.workspace.revision !== header.storageRevision
  ) {
    throw new EncryptedContainerAuthenticationError()
  }
}

export class LocalWorkspaceCryptoSession {
  #key: CryptoKey | null
  readonly bindingId: string
  readonly salt: string

  constructor(key: CryptoKey, bindingId: string, salt: string) {
    this.#key = key
    this.bindingId = bindingId
    this.salt = salt
  }

  get disposed(): boolean {
    return this.#key === null
  }

  dispose(): void {
    this.#key = null
  }

  async encrypt(
    workspace: WorkspaceData,
    storageRevision: number,
    keyInvocation: number,
  ): Promise<BinaryEncryptedContainer> {
    const key = this.#key
    if (!key) throw new EncryptedContainerAuthenticationError()
    if (
      !Number.isSafeInteger(storageRevision) ||
      storageRevision < 0 ||
      !Number.isSafeInteger(keyInvocation) ||
      keyInvocation < 1 ||
      keyInvocation > MAX_KEY_INVOCATIONS ||
      workspace.workspace.revision !== storageRevision
    ) {
      throw new EncryptedPayloadValidationError('The local encrypted revision is invalid.')
    }
    const header: LocalProtectedHeader = {
      application: WORKSPACE_APPLICATION,
      purpose: LOCAL_WORKSPACE_PURPOSE,
      containerVersion: ENCRYPTED_CONTAINER_VERSION,
      payloadVersion: ENCRYPTED_PAYLOAD_VERSION,
      bindingId: this.bindingId,
      storageRevision,
      keyInvocation,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: this.salt,
        normalization: 'NFC',
      },
      cipher: createCipherHeader(),
    }
    const plaintext = serializePayload(workspace)
    try {
      return await encryptBytes(key, header, plaintext)
    } finally {
      plaintext.fill(0)
    }
  }

  async decrypt(
    containerInput: BinaryEncryptedContainer,
    expected: LocalContainerExpectations,
  ): Promise<WorkspaceData> {
    const key = this.#key
    if (!key) throw new EncryptedContainerAuthenticationError()
    const container = cloneAndValidateContainer(containerInput)
    const header = parseProtectedHeader(container.protected, LOCAL_WORKSPACE_PURPOSE)
    const workspace = await decryptBytes(key, container, header.payloadVersion)
    assertLocalPayloadMatches(workspace, header, expected)
    if (header.bindingId !== this.bindingId || header.kdf.salt !== this.salt) {
      throw new EncryptedContainerAuthenticationError()
    }
    return workspace
  }
}

export interface CreatedLocalWorkspaceContainer {
  container: BinaryEncryptedContainer
  session: LocalWorkspaceCryptoSession
}

export interface OpenedLocalWorkspaceContainer {
  workspace: WorkspaceData
  session: LocalWorkspaceCryptoSession
  payloadVersion: SupportedEncryptedPayloadVersion
}

export async function createLocalWorkspaceContainer(
  workspace: WorkspaceData,
  passphrase: string,
  expected: LocalContainerExpectations,
): Promise<CreatedLocalWorkspaceContainer> {
  const normalized = validateNewPassphrase(passphrase)
  const salt = randomBytes(PBKDF2_SALT_BYTES)
  let session: LocalWorkspaceCryptoSession | null = null
  try {
    const key = await deriveAesKey(normalized, salt)
    session = new LocalWorkspaceCryptoSession(key, expected.bindingId, encodeBase64Url(salt))
    const container = await session.encrypt(
      workspace,
      expected.storageRevision,
      expected.keyInvocation,
    )
    return { container, session }
  } catch (error) {
    session?.dispose()
    throw error
  } finally {
    salt.fill(0)
  }
}

export async function openLocalWorkspaceContainer(
  containerInput: BinaryEncryptedContainer,
  passphrase: string,
  expected: LocalContainerExpectations,
): Promise<OpenedLocalWorkspaceContainer> {
  const container = cloneAndValidateContainer(containerInput)
  const header = parseProtectedHeader(container.protected, LOCAL_WORKSPACE_PURPOSE)
  let normalized: string
  try {
    normalized = normalizeUnlockPassphrase(passphrase)
  } catch {
    throw new EncryptedContainerAuthenticationError()
  }
  const salt = decodeBase64Url(header.kdf.salt, PBKDF2_SALT_BYTES, 'kdf.salt')
  let session: LocalWorkspaceCryptoSession | null = null
  try {
    const key = await deriveAesKey(normalized, salt)
    session = new LocalWorkspaceCryptoSession(key, header.bindingId, header.kdf.salt)
    const workspace = await session.decrypt(container, expected)
    return { workspace, session, payloadVersion: header.payloadVersion }
  } catch (error) {
    session?.dispose()
    if (
      error instanceof EncryptedContainerFormatError ||
      error instanceof WebCryptoUnavailableError
    ) {
      throw error
    }
    throw new EncryptedContainerAuthenticationError()
  } finally {
    salt.fill(0)
  }
}

interface SerializedEncryptedContainer {
  protected: string
  iv: string
  ciphertext: string
}

function serializedContainerKeysAreExact(input: Record<string, unknown>): boolean {
  const keys = Object.keys(input)
  return (
    keys.length === 3 &&
    keys[0] === 'protected' &&
    keys[1] === 'iv' &&
    keys[2] === 'ciphertext'
  )
}

export function serializeEncryptedBackupContainer(containerInput: BinaryEncryptedContainer): string {
  const container = cloneAndValidateContainer(containerInput)
  parseProtectedHeader(container.protected, ENCRYPTED_BACKUP_PURPOSE)
  const serialized: SerializedEncryptedContainer = {
    protected: encodeBase64Url(container.protected),
    iv: encodeBase64Url(container.iv),
    ciphertext: encodeBase64Url(container.ciphertext),
  }
  return JSON.stringify(serialized)
}

export function parseEncryptedBackupContainer(json: string): BinaryEncryptedContainer {
  if (json.length > Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3) + 32_768) {
    throw new EncryptedContainerFormatError('The encrypted backup exceeds its size limit.')
  }
  const canonicalInput = json
  let input: unknown
  try {
    input = JSON.parse(canonicalInput) as unknown
  } catch {
    throw new EncryptedContainerFormatError('The encrypted backup is not valid JSON.')
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    !serializedContainerKeysAreExact(input as Record<string, unknown>)
  ) {
    throw new EncryptedContainerFormatError('The encrypted backup has unknown or missing fields.')
  }
  const record = input as Record<string, unknown>
  if (
    typeof record['protected'] !== 'string' ||
    typeof record['iv'] !== 'string' ||
    typeof record['ciphertext'] !== 'string'
  ) {
    throw new EncryptedContainerFormatError('The encrypted backup fields must be base64url strings.')
  }
  const serialized: SerializedEncryptedContainer = {
    protected: record['protected'],
    iv: record['iv'],
    ciphertext: record['ciphertext'],
  }
  if (canonicalInput !== JSON.stringify(serialized)) {
    throw new EncryptedContainerFormatError('The encrypted backup wrapper is not canonical.')
  }
  const container = cloneAndValidateContainer({
    protected: decodeProtectedBase64Url(serialized.protected),
    iv: decodeBase64Url(serialized.iv, AES_GCM_IV_BYTES, 'iv'),
    ciphertext: decodeCiphertextBase64Url(serialized.ciphertext),
  })
  parseProtectedHeader(container.protected, ENCRYPTED_BACKUP_PURPOSE)
  return container
}

export async function createEncryptedBackup(
  workspace: WorkspaceData,
  passphrase: string,
): Promise<string> {
  const normalized = validateNewPassphrase(passphrase)
  const salt = randomBytes(PBKDF2_SALT_BYTES)
  const plaintext = serializePayload(workspace)
  try {
    const key = await deriveAesKey(normalized, salt)
    const header: BackupProtectedHeader = {
      application: WORKSPACE_APPLICATION,
      purpose: ENCRYPTED_BACKUP_PURPOSE,
      containerVersion: ENCRYPTED_CONTAINER_VERSION,
      payloadVersion: ENCRYPTED_PAYLOAD_VERSION,
      kdf: createKdfHeader(salt),
      cipher: createCipherHeader(),
    }
    return serializeEncryptedBackupContainer(await encryptBytes(key, header, plaintext))
  } finally {
    salt.fill(0)
    plaintext.fill(0)
  }
}

export async function openEncryptedBackup(
  json: string,
  passphrase: string,
): Promise<WorkspaceData> {
  const container = parseEncryptedBackupContainer(json)
  const header = parseProtectedHeader(container.protected, ENCRYPTED_BACKUP_PURPOSE)
  let normalized: string
  try {
    normalized = normalizeUnlockPassphrase(passphrase)
  } catch {
    throw new EncryptedContainerAuthenticationError()
  }
  const salt = decodeBase64Url(header.kdf.salt, PBKDF2_SALT_BYTES, 'kdf.salt')
  try {
    const key = await deriveAesKey(normalized, salt)
    return await decryptBytes(key, container, header.payloadVersion)
  } catch (error) {
    if (
      error instanceof EncryptedContainerFormatError ||
      error instanceof WebCryptoUnavailableError
    ) {
      throw error
    }
    throw new EncryptedContainerAuthenticationError()
  } finally {
    salt.fill(0)
  }
}

export function inspectLocalProtectedHeader(
  containerInput: BinaryEncryptedContainer,
): LocalProtectedHeader {
  const container = cloneAndValidateContainer(containerInput)
  return parseProtectedHeader(container.protected, LOCAL_WORKSPACE_PURPOSE)
}

export function inspectBackupProtectedHeader(json: string): BackupProtectedHeader {
  const container = parseEncryptedBackupContainer(json)
  return parseProtectedHeader(container.protected, ENCRYPTED_BACKUP_PURPOSE)
}
