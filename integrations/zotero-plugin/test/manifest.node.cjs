const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const updates = JSON.parse(fs.readFileSync(path.join(root, 'updates.json'), 'utf8'))

test('declares the exact verified Zotero 8 through 9 minor range and same-repository update manifest', () => {
  const application = manifest.applications.zotero
  assert.equal(application.strict_min_version, '8.0')
  assert.equal(application.strict_max_version, '9.0.*')
  assert.equal(
    application.update_url,
    'https://raw.githubusercontent.com/Yoesher/sociology-phd-desk/main/integrations/zotero-plugin/updates.json',
  )

  const update = updates.addons[application.id].updates[0]
  assert.equal(update.version, manifest.version)
  assert.deepEqual(update.applications.zotero, {
    strict_min_version: '8.0',
    strict_max_version: '9.0.*',
  })
  assert.match(update.update_link, /\/releases\/download\/v0\.3\.0\/sociology-phd-desk-zotero-0\.1\.0\.xpi$/)
})

test('pins the published update entry to the reproducible XPI SHA-256', () => {
  const application = manifest.applications.zotero
  const update = updates.addons[application.id].updates[0]
  const xpi = fs.readFileSync(path.join(root, 'dist', 'sociology-phd-desk-zotero-0.1.0.xpi'))
  const digest = crypto.createHash('sha256').update(xpi).digest('hex')
  assert.equal(update.update_hash, `sha256:${digest}`)
})
