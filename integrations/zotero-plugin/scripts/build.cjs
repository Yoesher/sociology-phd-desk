const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const files = [
  'SECURITY.md',
  'README.md',
  'bootstrap.js',
  'handoff.js',
  'locale/en-US/sociology-phd-desk.ftl',
  'locale/zh-CN/sociology-phd-desk.ftl',
  'manifest.json',
  'plugin.js',
]
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function u16(value) { const buffer = Buffer.alloc(2); buffer.writeUInt16LE(value); return buffer }
function u32(value) { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(value >>> 0); return buffer }

function buildArchive() {
  const localParts = []
  const centralParts = []
  let offset = 0
  for (const relative of files.slice().sort()) {
    const name = Buffer.from(relative.replaceAll('\\', '/'))
    const data = fs.readFileSync(path.join(root, relative))
    const crc = crc32(data)
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x5821),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ])
    localParts.push(local)
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x5821),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]))
    offset += local.length
  }
  const central = Buffer.concat(centralParts)
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ])
  return Buffer.concat([...localParts, central, end])
}

const first = buildArchive()
const second = buildArchive()
if (!first.equals(second)) throw new Error('Zotero XPI build is not reproducible.')
const outputDirectory = path.join(root, 'dist')
fs.mkdirSync(outputDirectory, { recursive: true })
const xpiName = 'sociology-phd-desk-zotero-0.1.0.xpi'
const xpiPath = path.join(outputDirectory, xpiName)
fs.writeFileSync(xpiPath, first)
const digest = crypto.createHash('sha256').update(first).digest('hex')
fs.writeFileSync(path.join(outputDirectory, xpiName.replace('.xpi', '.sha256')), `${digest}  ${xpiName}\n`)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const zoteroCompatibility = manifest.applications.zotero
const updateManifest = {
  addons: {
    [zoteroCompatibility.id]: {
      updates: [{
        version: manifest.version,
        update_link: `https://github.com/Yoesher/sociology-phd-desk/releases/download/v0.3.0/${xpiName}`,
        update_hash: `sha256:${digest}`,
        applications: {
          zotero: {
            strict_min_version: zoteroCompatibility.strict_min_version,
            strict_max_version: zoteroCompatibility.strict_max_version,
          },
        },
      }],
    },
  },
}
fs.writeFileSync(path.join(root, 'updates.json'), `${JSON.stringify(updateManifest, null, 2)}\n`)
console.log(`Zotero XPI reproducible build PASS: ${xpiName}; ${first.length} bytes; sha256 ${digest}`)
