import { ENCRYPTED_CONTAINER_VERSION } from '../crypto'
import { DATABASE_SCHEMA_VERSION } from '../db/database'
import { WORKSPACE_SCHEMA_VERSION } from '../models/domain'

export const buildInfo = Object.freeze({
  appVersion: __APP_VERSION__,
  buildSha: __BUILD_SHA__,
  buildDate: __BUILD_DATE__,
  portableSchemaVersion: WORKSPACE_SCHEMA_VERSION,
  databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
  encryptedContainerVersion: ENCRYPTED_CONTAINER_VERSION,
})
