export const GENERIC_AUTHENTICATION_FAILURE_MESSAGE =
  'The encrypted workspace could not be authenticated. The passphrase may be incorrect, or the data may be damaged or modified.'

export class WebCryptoUnavailableError extends Error {
  constructor() {
    super('Secure Web Crypto APIs are unavailable. Encrypted workspaces cannot be opened here.')
    this.name = 'WebCryptoUnavailableError'
  }
}

export class PassphrasePolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PassphrasePolicyError'
  }
}

export class EncryptedContainerFormatError extends Error {
  constructor(message = 'The encrypted container format is unsupported or invalid.') {
    super(message)
    this.name = 'EncryptedContainerFormatError'
  }
}

export class EncryptedContainerAuthenticationError extends Error {
  constructor() {
    super(GENERIC_AUTHENTICATION_FAILURE_MESSAGE)
    this.name = 'EncryptedContainerAuthenticationError'
  }
}

export class EncryptedPayloadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncryptedPayloadValidationError'
  }
}
