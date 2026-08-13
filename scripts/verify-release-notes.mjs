import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const sentinels = []
let file
let remote
let tag

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === '--file') {
    file = args[++index]
  } else if (arg === '--remote') {
    remote = args[++index]
    tag = args[++index]
  } else if (arg === '--sentinel') {
    sentinels.push(args[++index])
  } else {
    throw new Error(`Unknown argument: ${arg}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Release Notes verification failed: ${message}`)
}

function decodeUtf8(bytes, source) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`Release Notes verification failed: ${source} is not valid UTF-8`)
  }
  assert(Buffer.from(text, 'utf8').equals(bytes), `${source} did not round-trip as UTF-8`)
  return text
}

function verifyBody(body, source) {
  assert(body.trim().length > 0, `${source} is empty`)
  assert(!/\?{8,}/u.test(body), `${source} contains a run of eight or more question marks`)
  for (const sentinel of sentinels) {
    assert(sentinel && body.includes(sentinel), `${source} is missing sentinel ${JSON.stringify(sentinel)}`)
  }
}

assert((file ? 1 : 0) + (remote ? 1 : 0) === 1, 'choose exactly one of --file or --remote')
assert(sentinels.length > 0, 'provide at least one --sentinel')
assert(
  sentinels.some((sentinel) => [...sentinel].some((character) => character.codePointAt(0) > 0x7f)),
  'provide at least one non-ASCII --sentinel',
)

if (file) {
  const bytes = await readFile(file)
  const body = decodeUtf8(bytes, file)
  verifyBody(body, file)
  console.log(`UTF8_RELEASE_NOTES_PRECHECK=PASS source=${file}`)
} else {
  assert(remote.includes('/'), '--remote must be an owner/repository pair')
  assert(tag, '--remote requires a tag')
  const response = spawnSync(
    'gh',
    ['api', `repos/${remote}/releases/tags/${tag}`],
    { encoding: 'buffer', windowsHide: true },
  )
  assert(response.error === undefined, `could not run gh: ${response.error?.message ?? 'unknown error'}`)
  assert(response.status === 0, `GitHub API read failed with status ${response.status}`)
  const payload = JSON.parse(decodeUtf8(response.stdout, `GitHub API ${remote} ${tag}`))
  assert(payload.tag_name === tag, `remote tag ${payload.tag_name} did not match ${tag}`)
  verifyBody(payload.body, `GitHub API body for ${tag}`)
  console.log(`RELEASE_UTF8_REMOTE_VERIFY=PASS release_id=${payload.id} tag=${payload.tag_name}`)
}
