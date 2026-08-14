const test = require('node:test')
const assert = require('node:assert/strict')
const handoff = require('../handoff.js')

const regularItem = (overrides = {}) => ({
  key: 'AB12CD34',
  libraryID: 1,
  version: 7,
  itemTypeID: 42,
  dateAdded: '2026-08-14 00:00:00',
  dateModified: '2026-08-14 01:00:00',
  isRegularItem: () => true,
  getField: (field) => ({ title: 'Synthetic article', DOI: '10.1234/synthetic' })[field] || '',
  getCreators: () => [{ firstName: 'Ada', lastName: 'Scholar', creatorTypeID: 1 }],
  getTags: () => [{ tag: 'synthetic' }],
  getCollections: () => ['COLLECTION1'],
  ...overrides,
})

const adapters = {
  itemTypeName: () => 'journalArticle',
  creatorTypeName: () => 'author',
  libraryType: () => 'user',
}

test('serializes only the approved bibliographic whitelist', () => {
  const item = regularItem({ note: 'private', attachmentPath: 'C:/private.pdf' })
  const bundle = handoff.buildBundle([item], adapters, new Date('2026-08-14T00:00:00.000Z'))
  assert.equal(bundle.version, 1)
  assert.equal(bundle.items[0].title, 'Synthetic article')
  const text = JSON.stringify(bundle)
  for (const forbidden of ['note', 'attachment', 'annotation', 'fullText', 'filePath', 'storagePath']) {
    assert.equal(text.includes(forbidden), false)
  }
})

test('rejects notes, attachments, unsupported types, empty selection, and oversized batches', () => {
  assert.throws(() => handoff.buildBundle([], adapters), /Select at least one/)
  assert.throws(() => handoff.buildBundle(Array(1001).fill(regularItem()), adapters), /At most 1000/)
  assert.throws(() => handoff.buildBundle([regularItem({ isRegularItem: () => false })], adapters), /regular bibliographic/)
  assert.throws(() => handoff.buildBundle([regularItem()], { ...adapters, itemTypeName: () => 'attachment' }), /Unsupported/)
})

test('uses URL fragments for bounded handoffs and local-file fallback for large metadata', () => {
  const small = handoff.buildBundle([regularItem()], adapters)
  const url = handoff.fragmentURL(small)
  assert.match(url, /^https:\/\/yoesher\.github\.io\/sociology-phd-desk\/#\/literature\?view=inbox&zotero-handoff=/)
  assert.equal(url.split('#')[0].includes('zotero-handoff'), false)

  const large = handoff.buildBundle([regularItem({
    getField: field => field == 'title' ? 'Synthetic article' : field == 'abstractNote' ? 'x'.repeat(20000) : '',
  })], adapters)
  assert.equal(handoff.fragmentURL(large), null)
})

test('falls back to a local bundle when launching a bounded URL fails', async () => {
  const bundle = handoff.buildBundle([regularItem()], adapters)
  let saved
  const result = await handoff.deliver(bundle, {
    launch: async () => { throw new Error('URL handler unavailable') },
    save: async value => { saved = value },
  })
  assert.equal(result, 'file')
  assert.deepEqual(saved, bundle)
})

test('preserves Chinese and English metadata without importing research workflow judgments', () => {
  const bundle = handoff.buildBundle([
    regularItem({ getField: field => field == 'title' ? '中国社会学文献' : '' }),
    regularItem({ key: 'EN12CD34', getField: field => field == 'title' ? 'English sociology article' : '' }),
  ], adapters)
  assert.deepEqual(bundle.items.map(item => item.title), ['中国社会学文献', 'English sociology article'])
  assert.equal(JSON.stringify(bundle).includes('projectId'), false)
  assert.equal(JSON.stringify(bundle).includes('whyRead'), false)
})

test('supports multi-select article and book metadata with and without DOI', () => {
  const article = regularItem()
  const book = regularItem({
    key: 'BOOK1234',
    itemTypeID: 43,
    getField: field => ({ title: 'Synthetic book', ISBN: '978-1-4028-9462-6' })[field] || '',
    getCreators: () => [
      { firstName: 'First', lastName: 'Author', creatorTypeID: 1 },
      { firstName: 'Second', lastName: 'Author', creatorTypeID: 1 },
    ],
  })
  const bundle = handoff.buildBundle([article, book], {
    ...adapters,
    itemTypeName: item => item.itemTypeID == 43 ? 'book' : 'journalArticle',
  })
  assert.equal(bundle.items.length, 2)
  assert.equal(bundle.items[0].DOI, '10.1234/synthetic')
  assert.equal(bundle.items[1].DOI, undefined)
  assert.equal(bundle.items[1].ISBN, '978-1-4028-9462-6')
  assert.equal(bundle.items[1].creators.length, 2)
})
