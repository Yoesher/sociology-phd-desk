import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { BinaryEncryptedContainer } from '../crypto'

export const ENCRYPTED_VAULT_DATABASE_VERSION = 1 as const
export const ENCRYPTED_VAULT_RECORD_ID = 'encrypted-workspace' as const
export const ENCRYPTED_VAULT_DATABASE_PREFIX = 'sociology-phd-desk-private-v1'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export interface EncryptedVaultRecord extends BinaryEncryptedContainer {
  id: typeof ENCRYPTED_VAULT_RECORD_ID
  storageRevision: number
  lockEpoch: number
  keyInvocation: number
  /**
   * Monotonic reservations for every AES-GCM encryption attempt under the
   * current derived key, including attempts that never win the ciphertext CAS.
   */
  encryptionAttempts: number
}

export function encryptedVaultDatabaseName(bindingId: string): string {
  if (!UUID_PATTERN.test(bindingId)) {
    throw new Error('Encrypted workspace binding IDs must be canonical UUIDs.')
  }
  return `${ENCRYPTED_VAULT_DATABASE_PREFIX}::${bindingId.toLowerCase()}`
}

/**
 * One database instance stores exactly one opaque encrypted workspace record.
 * No research-domain table or plaintext workspace metadata belongs here.
 */
export class EncryptedVaultDatabase extends Dexie {
  vaults!: Table<EncryptedVaultRecord, typeof ENCRYPTED_VAULT_RECORD_ID>

  readonly bindingId: string

  constructor(bindingId: string) {
    super(encryptedVaultDatabaseName(bindingId))
    this.bindingId = bindingId.toLowerCase()
    this.version(ENCRYPTED_VAULT_DATABASE_VERSION).stores({
      vaults: '&id',
    })
    // Dexie's default versionchange handler permits a later operation to
    // auto-open a database after another context deleted it. This connection
    // represents one physical vault generation, so deletion or replacement
    // permanently invalidates it and subsequent operations must fail closed.
    this.on('versionchange', () => {
      this.close({ disableAutoOpen: true })
    })
  }
}

export function cloneEncryptedVaultRecord(record: EncryptedVaultRecord): EncryptedVaultRecord {
  return {
    id: ENCRYPTED_VAULT_RECORD_ID,
    storageRevision: record.storageRevision,
    lockEpoch: record.lockEpoch,
    keyInvocation: record.keyInvocation,
    encryptionAttempts: record.encryptionAttempts,
    protected: new Uint8Array(record.protected),
    iv: new Uint8Array(record.iv),
    ciphertext: new Uint8Array(record.ciphertext),
  }
}

export async function deleteEncryptedVaultDatabase(bindingId: string): Promise<void> {
  await Dexie.delete(encryptedVaultDatabaseName(bindingId))
}

export async function encryptedVaultDatabaseExists(bindingId: string): Promise<boolean> {
  return Dexie.exists(encryptedVaultDatabaseName(bindingId))
}
