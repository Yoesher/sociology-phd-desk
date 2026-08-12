export const ENCRYPTED_CONTAINER_VERSION = 1 as const
export const LEGACY_ENCRYPTED_PAYLOAD_VERSION = 3 as const
export const ENCRYPTED_PAYLOAD_VERSION = 4 as const
export const SUPPORTED_ENCRYPTED_PAYLOAD_VERSIONS = [
  LEGACY_ENCRYPTED_PAYLOAD_VERSION,
  ENCRYPTED_PAYLOAD_VERSION,
] as const
export type SupportedEncryptedPayloadVersion =
  (typeof SUPPORTED_ENCRYPTED_PAYLOAD_VERSIONS)[number]

export const LOCAL_WORKSPACE_PURPOSE = 'encrypted-local-workspace' as const
export const ENCRYPTED_BACKUP_PURPOSE = 'encrypted-backup' as const

export const PBKDF2_ITERATIONS = 600_000 as const
export const PBKDF2_SALT_BYTES = 16 as const
export const AES_GCM_KEY_BITS = 256 as const
export const AES_GCM_IV_BYTES = 12 as const
export const AES_GCM_TAG_BITS = 128 as const
export const AES_GCM_TAG_BYTES = AES_GCM_TAG_BITS / 8

export const MIN_NEW_PASSPHRASE_CODE_POINTS = 15 as const
export const MAX_PASSPHRASE_CODE_POINTS = 1_024 as const

export const MAX_PROTECTED_HEADER_BYTES = 8 * 1_024
export const MAX_CIPHERTEXT_BYTES = 64 * 1_024 * 1_024
export const MAX_PLAINTEXT_BYTES = MAX_CIPHERTEXT_BYTES - AES_GCM_TAG_BYTES

/** NIST SP 800-38D section 8.3 limit for RBG-based GCM IV construction. */
export const MAX_KEY_INVOCATIONS = 2 ** 32
