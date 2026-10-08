import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { WorkspaceData } from '../src/models/domain'
import { createEmptyWorkspace } from '../src/models/empty-workspace'
import { PROVENANCE_COLLECTION_KEYS, WORKSPACE_COLLECTION_KEYS } from '../src/models/provenance'
import { applyProvenanceCommand, reconcileProvenanceRootEdits, type ProvenanceCommand } from '../src/utils/provenance-commands'
import { importWorkspaceJson } from '../src/utils/workspace-transfer'
import { captureBrowserDiagnostics, expectNoHorizontalOverflow, openWorkspaceCenter, waitForApp } from './helpers'

test.use({ contextOptions: { reducedMotion: 'reduce' }, timezoneId: 'Asia/Shanghai' })
test.setTimeout(180_000)
const projectA = 'synthetic-qda-project-a', projectB = 'synthetic-qda-project-b'
const stamp = '2026-10-08T00:00:00.000Z'
const meta = { createdAt: stamp, updatedAt: stamp, isDemo: false }
const prefix = 'DEMO E2E QDA'

/** Entirely invented metadata. No participant narrative, transcript, identity or real file. */
function syntheticGraph(): WorkspaceData {
  const empty = createEmptyWorkspace({ id: 'synthetic-qda-fixture', name: `${prefix} complete graph`, now: new Date(stamp) })
  let data = reconcileProvenanceRootEdits(empty, {
    ...empty,
    workspace: { ...empty.workspace, activeProjectId: projectA },
    projects: [projectA, projectB].map((id, index) => ({ ...meta, id, title: `${prefix} project ${index ? 'B' : 'A'}`, shortTitle: `${prefix} project ${index ? 'B' : 'A'}`, topic: 'SYNTHETIC metadata-only family comparison', method: 'Qualitative' as const, status: 'Analysis' as const, startDate: '2026-10-08', notes: '' })),
    interviews: ['I01', 'I02', 'I03'].map(id => ({ ...meta, id: `synthetic-qda-${id}`, projectId: projectA, participantAlias: `${prefix} ${id}`, status: 'Completed' as const, transcriptStatus: 'Complete' as const, codingStatus: 'In Progress' as const, memoStatus: 'In Progress' as const, notes: 'SYNTHETIC workflow metadata only' })),
    theoryMemos: [{ ...meta, id: 'synthetic-qda-memo', projectId: projectA, memoType: 'mechanism', title: `${prefix} comparison memo`, content: 'SYNTHETIC analytical placeholder; this is not an empirical conclusion.', relatedQuestionIds: [], relatedClaimIds: ['synthetic-qda-claim'], relatedLiteratureIds: [] }],
    claims: [{ ...meta, id: 'synthetic-qda-claim', projectId: projectA, text: `${prefix} conditional proposition`, status: 'active', notes: 'SYNTHETIC claim metadata' }],
    evidence: [{ ...meta, id: 'synthetic-qda-evidence', projectId: projectA, claim: `${prefix} observation placeholder`, evidenceType: 'Interview', source: 'SYNTHETIC anonymous source reference', locator: 'SYNTHETIC L12–18', finding: 'SYNTHETIC metadata finding, not interview text', supportLevel: 'Moderate', limitations: 'SYNTHETIC comparison boundary', manuscriptLocation: 'SYNTHETIC D1/P04' }],
    manuscripts: [{ ...meta, id: 'synthetic-qda-manuscript', projectId: projectA, title: `${prefix} manuscript placeholder`, status: 'Drafting', targetJournal: '', wordCount: 0, nextAction: '' }],
  }, { now: stamp, researcherAlias: 'SYNTHETIC R01', reason: 'SYNTHETIC root fixture' })
  const apply = (command: ProvenanceCommand) => { data = applyProvenanceCommand(data, command, { now: stamp, researcherAlias: 'SYNTHETIC R01', reason: 'SYNTHETIC provenance fixture' }) }
  apply({ type: 'createDimension', projectId: projectA, id: 'synthetic-qda-dimension', label: `${prefix} care arrangement`, unit: 'household', categories: [{ id: 'synthetic-qda-category-a', label: 'SYNTHETIC shared arrangement' }, { id: 'synthetic-qda-category-b', label: 'SYNTHETIC contrasting arrangement' }] })
  for (const [index, caseId] of ['synthetic-qda-F01', 'synthetic-qda-F02'].entries()) apply({ type: 'createCase', projectId: projectA, id: caseId, alias: `${prefix} F0${index + 1}`, unit: 'household', attributes: [{ dimensionId: 'synthetic-qda-dimension', categoryId: index ? 'synthetic-qda-category-b' : 'synthetic-qda-category-a' }] })
  for (const [interviewId, caseId] of [['synthetic-qda-I01', 'synthetic-qda-F01'], ['synthetic-qda-I02', 'synthetic-qda-F01'], ['synthetic-qda-I03', 'synthetic-qda-F02']]) apply({ type: 'linkInterviewCase', projectId: projectA, interviewId: interviewId!, caseId: caseId! })
  for (const [sourceId, interviewId] of [['synthetic-qda-source-a', 'synthetic-qda-I01'], ['synthetic-qda-source-b', 'synthetic-qda-I03']]) {
    apply({ type: 'registerSource', projectId: projectA, id: sourceId!, alias: `${prefix} ${sourceId!.endsWith('a') ? 'T01' : 'T02'}`, sourceKind: 'transcript', owners: [{ kind: 'interview', interviewId: interviewId! }], versionLabel: 'v1', externalRef: { kind: 'qda-reference', provider: 'nvivo', projectToken: 'SYNTHETIC-NV-P01', sourceToken: `${sourceId}-v1` }, researcherVerification: 'verified' })
    apply({ type: 'createSegment', projectId: projectA, id: sourceId!.endsWith('a') ? 'synthetic-qda-segment-a' : 'synthetic-qda-segment-b', sourceReferenceId: sourceId!, sourceRevisionId: data.sourceReferences.find(item => item.id === sourceId)!.currentRevisionId, label: `${prefix} ${sourceId!.endsWith('a') ? 'range A' : 'counterexample locator'}`, primaryLocator: { kind: 'lineRange', start: 12, end: 18 }, verification: 'verified' })
  }
  apply({ type: 'createCode', projectId: projectA, id: 'synthetic-qda-code', label: `${prefix} coordination code`, stage: 'initial', definition: 'SYNTHETIC coding definition r1', inclusion: 'SYNTHETIC inclusion metadata', exclusion: 'SYNTHETIC exclusion metadata' })
  apply({ type: 'createCode', projectId: projectA, id: 'synthetic-qda-theme', label: `${prefix} theme`, stage: 'theme', definition: 'SYNTHETIC theme definition', inclusion: '', exclusion: '' })
  apply({ type: 'createCode', projectId: projectB, id: 'synthetic-qda-sentinel', label: 'SYNTHETIC OTHER PROJECT SENTINEL', stage: 'initial', definition: 'SYNTHETIC other-project metadata', inclusion: '', exclusion: '' })
  const codeRevisionId = data.qualitativeCodes.find(item => item.id === 'synthetic-qda-code')!.currentRevisionId
  const segmentRevisionId = data.sourceSegments.find(item => item.id === 'synthetic-qda-segment-a')!.currentRevisionId
  apply({ type: 'relateCodes', projectId: projectA, fromCodeRevisionId: data.qualitativeCodes.find(item => item.id === 'synthetic-qda-theme')!.currentRevisionId, toCodeRevisionId: codeRevisionId, kind: 'groups' })
  apply({ type: 'assignCode', projectId: projectA, id: 'synthetic-qda-assignment', segmentRevisionId, codeRevisionId })
  apply({ type: 'activateAnalyticalMemo', projectId: projectA, theoryMemoId: 'synthetic-qda-memo', analysisKind: 'mechanism' })
  const memoRevisionId = data.analyticalMemoFacets[0]!.currentRevisionId
  apply({ type: 'linkMemoMaterial', projectId: projectA, memoRevisionId, material: { kind: 'codingAssignment', assignmentId: 'synthetic-qda-assignment' }, role: 'observation' })
  apply({ type: 'linkMemoMaterial', projectId: projectA, memoRevisionId, material: { kind: 'segmentRevision', segmentRevisionId: data.sourceSegments.find(item => item.id === 'synthetic-qda-segment-b')!.currentRevisionId }, role: 'rival', note: 'SYNTHETIC counterexample metadata' })
  const claimRevisionId = data.claimRevisions[0]!.id, evidenceRevisionId = data.evidenceRevisions[0]!.id
  apply({ type: 'deriveClaim', projectId: projectA, claimRevisionId, memoRevisionId })
  apply({ type: 'linkEvidenceToClaim', projectId: projectA, evidenceRevisionId, claimRevisionId, supportLevel: 'Moderate', limitations: 'SYNTHETIC limited comparison' })
  apply({ type: 'linkEvidenceSource', projectId: projectA, evidenceRevisionId, origin: { kind: 'sourceSegmentRevision', segmentRevisionId } })
  apply({ type: 'createManuscriptAnchor', projectId: projectA, id: 'synthetic-qda-anchor', manuscriptId: 'synthetic-qda-manuscript', kind: 'paragraph', documentVersion: 'D1', sectionPath: ['SYNTHETIC Findings', 'SYNTHETIC Mechanism'], paragraphLabel: 'P04', bookmarkToken: 'SYNTHETIC-D1-P04' })
  const anchorRevisionId = data.manuscriptAnchors[0]!.currentRevisionId
  apply({ type: 'linkClaimToManuscript', projectId: projectA, claimRevisionId, anchorRevisionId })
  apply({ type: 'useEvidenceAtAnchor', projectId: projectA, evidenceClaimLinkId: data.evidenceClaimLinks[0]!.id, anchorRevisionId })
  apply({ type: 'freezeComparison', projectId: projectA, id: 'synthetic-qda-comparison', title: `${prefix} frozen comparison`, caseIds: ['synthetic-qda-F01', 'synthetic-qda-F02'], codeRevisionIds: [codeRevisionId], unit: 'household', reviews: [{ caseId: 'synthetic-qda-F02', codeRevisionId, state: 'absent-reviewed', reviewedSegmentRevisionIds: [data.sourceSegments.find(item => item.id === 'synthetic-qda-segment-b')!.currentRevisionId], reviewNote: 'SYNTHETIC manually reviewed locator; no transcript stored' }] })
  return importWorkspaceJson(JSON.stringify(data))
}
// Collection-time validation prevents either browser flow from silently using an invalid fixture.
const completeSyntheticFixture = syntheticGraph()
for (const key of PROVENANCE_COLLECTION_KEYS) expect(completeSyntheticFixture[key].length, key).toBeGreaterThan(0)

async function closeCenter(page: Page, center: Locator) {
  await expect(page.locator('.modal-backdrop[data-closing]')).toHaveCount(0)
  await center.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await expect(center).toBeHidden()
  const drawer = page.getByRole('dialog', { name: '模块导航', exact: true })
  if (await drawer.isVisible()) await drawer.getByRole('button', { name: '关闭导航', exact: true }).click()
  const more = page.getByRole('dialog', { name: '更多操作', exact: true })
  if (await more.isVisible()) await page.keyboard.press('Escape')
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
}
async function importJson(page: Page, data: WorkspaceData) {
  const center = await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await center.getByRole('button', { name: '导入 JSON', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '把明文 JSON 导入新工作台', exact: true })
  await dialog.getByLabel('明文工作区 JSON 文件', { exact: true }).setInputFiles({ name: 'SYNTHETIC-metadata-v9.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data), 'utf8') })
  await dialog.getByRole('button', { name: '检查导入预检', exact: true }).click()
  await expect(dialog.getByText('未写入', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '从 JSON 创建工作台', exact: true }).click()
  await expect(dialog).toBeHidden(); await expect(center).toBeHidden()
  await waitForApp(page)
}
async function exportJson(page: Page): Promise<WorkspaceData> {
  const center = await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await center.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const warning = page.getByRole('dialog', { name: '导出可直接读取的明文？', exact: true })
  const downloaded = page.waitForEvent('download')
  await warning.getByRole('button', { name: '导出明文 JSON', exact: true }).click()
  const snapshot = JSON.parse(await readFile((await (await downloaded).path())!, 'utf8')) as WorkspaceData
  expect(snapshot.version).toBe(9)
  for (const key of WORKSPACE_COLLECTION_KEYS) expect(Array.isArray(snapshot[key])).toBe(true)
  expect(WORKSPACE_COLLECTION_KEYS).toHaveLength(44)
  await expect(warning).toBeHidden(); await closeCenter(page, center)
  return snapshot
}
function expectCollectionsEqual(actual: WorkspaceData, expected: WorkspaceData) {
  for (const key of WORKSPACE_COLLECTION_KEYS) expect(actual[key], key).toEqual(expected[key])
}
async function persistFingerprint(page: Page) {
  return page.evaluate(async () => {
    const portable = (value: unknown): unknown => {
      if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value))
      if (ArrayBuffer.isView(value)) return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      if (Array.isArray(value)) return value.map(portable)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, portable(item)]))
      return value
    }
    const names = (await indexedDB.databases()).map(info => info.name).filter((name): name is string => Boolean(name?.startsWith('sociology-phd-desk'))).sort()
    const result = []
    for (const name of names) result.push(await new Promise(resolve => {
      const request = indexedDB.open(name)
      request.onerror = () => resolve({ name, error: true })
      request.onsuccess = () => {
        const db = request.result, stores = [...db.objectStoreNames].sort()
        if (!stores.length) { db.close(); resolve({ name, stores: [] }); return }
        const tx = db.transaction(stores, 'readonly'), content: Record<string, unknown> = {}
        for (const store of stores) { const rows = tx.objectStore(store).getAll(); rows.onsuccess = () => { content[store] = portable(rows.result) } }
        tx.oncomplete = () => { db.close(); resolve({ name, content }) }
        tx.onerror = () => { db.close(); resolve({ name, error: true }) }
      }
    }))
    return result
  })
}
async function qualitative(page: Page, query = '') {
  await page.goto(`/#/fieldwork?view=qualitative${query}`); await waitForApp(page)
  await expect(page.getByRole('group', { name: '定性分析', exact: true })).toBeVisible()
}
async function saveForm(dialog: Locator, reason = 'SYNTHETIC researcher metadata update') {
  await dialog.getByRole('textbox', { name: '研究者匿名标记', exact: true }).fill('SYNTHETIC R01')
  await dialog.getByRole('textbox', { name: '修订／操作理由', exact: true }).fill(reason)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('synthetic coding revisions, counterexamples and historical sources survive complete ordinary backup', async ({ page }, testInfo) => {
  const diagnostics = captureBrowserDiagnostics(page), initial = structuredClone(completeSyntheticFixture)
  const externalRequests: string[] = []
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(testInfo.project.use.baseURL!).origin) externalRequests.push(request.url()) })
  await page.goto('/'); await waitForApp(page); await importJson(page, initial)
  await page.getByRole('combobox', { name: '项目空间', exact: true }).selectOption(projectA)
  await qualitative(page)
  await page.getByRole('button', { name: '编码与赋码', exact: true }).click()
  await expect(page.getByText('SYNTHETIC OTHER PROJECT SENTINEL', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '新增研究者编码', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '新增研究者编码', exact: true })
  await dialog.getByRole('textbox', { name: '研究者标签', exact: true }).fill(`${prefix} new researcher code`)
  await dialog.getByRole('textbox', { name: '定义', exact: true }).fill('SYNTHETIC new coding metadata')
  await saveForm(dialog)
  const card = page.locator('.qualitative-record').filter({ has: page.getByRole('heading', { name: `${prefix} coordination code`, exact: true }) })
  await card.getByRole('button', { name: '修订编码定义', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '修订编码定义', exact: true })
  await dialog.getByRole('textbox', { name: '定义', exact: true }).fill('SYNTHETIC coding definition r2')
  await saveForm(dialog)
  await page.getByRole('button', { name: '资料与定位', exact: true }).click()
  await page.getByRole('button', { name: '登记外部资料', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '登记外部资料', exact: true })
  await dialog.getByRole('textbox', { name: '匿名别名', exact: true }).fill(`${prefix} T03`)
  await dialog.getByRole('checkbox', { name: `匿名访谈 · ${prefix} I02`, exact: true }).check()
  await dialog.getByRole('textbox', { name: /^匿名引用标记/ }).fill('SYNTHETIC-T03-v1')
  await saveForm(dialog)
  const additionalSource = page.locator('.qualitative-record').filter({ has: page.getByRole('heading', { name: `${prefix} T03`, exact: true }) })
  await additionalSource.getByRole('button', { name: '新增资料片段定位', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '新增资料片段定位', exact: true })
  await dialog.getByRole('textbox', { name: /^研究者标签/ }).fill(`${prefix} range C`)
  await dialog.getByRole('spinbutton', { name: '起点', exact: true }).fill('24')
  await dialog.getByRole('spinbutton', { name: '终点', exact: true }).fill('30')
  await saveForm(dialog)
  await additionalSource.getByRole('button', { name: '应用编码', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '应用编码', exact: true })
  await dialog.getByRole('combobox', { name: '固定编码版本', exact: true }).selectOption({ label: `${prefix} coordination code · 初始编码 · r2` })
  await saveForm(dialog)
  const source = page.locator('.qualitative-record').filter({ has: page.getByRole('heading', { name: `${prefix} T01`, exact: true }) })
  await source.getByRole('button', { name: '新增资料版本', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '新增资料版本', exact: true })
  await dialog.getByRole('textbox', { name: '资料版本标签', exact: true }).fill('v2')
  await dialog.getByRole('textbox', { name: /^匿名引用标记/ }).fill('SYNTHETIC-T01-v2')
  await saveForm(dialog)
  await source.getByRole('button', { name: '重新定位片段', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '重新定位片段', exact: true })
  await dialog.getByRole('combobox', { name: '固定资料版本', exact: true }).selectOption({ label: `${prefix} T01 · v2 · r2` })
  await dialog.getByRole('spinbutton', { name: '起点', exact: true }).fill('20')
  await dialog.getByRole('spinbutton', { name: '终点', exact: true }).fill('14')
  await dialog.getByRole('textbox', { name: '修订／操作理由', exact: true }).fill('SYNTHETIC locator revision')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('范围起点不得超过终点')
  await expect(dialog.getByRole('spinbutton', { name: '起点', exact: true })).toHaveValue('20')
  await dialog.getByRole('spinbutton', { name: '起点', exact: true }).fill('14')
  await dialog.getByRole('spinbutton', { name: '终点', exact: true }).fill('20')
  await saveForm(dialog)
  const revised = await exportJson(page)
  const oldSegment = initial.sourceSegments.find(item => item.id === 'synthetic-qda-segment-a')!.currentRevisionId
  const oldSource = initial.sourceReferences.find(item => item.id === 'synthetic-qda-source-a')!.currentRevisionId
  expect(revised.codingAssignments[0]!.segmentRevisionId).toBe(oldSegment)
  expect(revised.codingAssignments[0]!.codeRevisionId).toBe(initial.codingAssignments[0]!.codeRevisionId)
  expect(revised.codingAssignments).toHaveLength(2)
  const reusedCode = revised.qualitativeCodes.find(item => item.id === 'synthetic-qda-code')!
  expect(revised.codingAssignments[1]!.codeRevisionId).toBe(reusedCode.currentRevisionId)
  expect(revised.sourceReferences.find(item => item.alias === `${prefix} T03`)!.owners).toEqual([{ kind: 'interview', interviewId: 'synthetic-qda-I02' }])
  await qualitative(page, `&segmentRevision=${encodeURIComponent(oldSegment)}`)
  await expect(page.locator('.qualitative-trace').getByText('L12–18', { exact: true })).toBeVisible()
  await expect(page.locator('.qualitative-trace').getByText('L14–20', { exact: true })).toHaveCount(0)
  await page.locator('.qualitative-trace').getByRole('combobox', { name: '稳定 ID', exact: true }).selectOption(`sourceRevisions|${oldSource}`)
  await expect(page.locator('.qualitative-trace')).toContainText('synthetic-qda-source-a-v1')
  await page.getByRole('button', { name: '编码与赋码', exact: true }).click()
  const originalAssignment = page.locator('.qualitative-record').filter({ has: page.getByRole('button', { name: 'synthetic-qda-assignment', exact: true }) })
  await originalAssignment.getByRole('button', { name: '重新赋码', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '重新赋码', exact: true })
  await dialog.getByRole('combobox', { name: '固定编码版本', exact: true }).selectOption({ label: `${prefix} coordination code · 初始编码 · r2` })
  await dialog.getByRole('combobox', { name: '固定片段版本', exact: true }).selectOption({ label: `${prefix} range A · r2` })
  await saveForm(dialog)
  await page.goto('/#/fieldwork?view=interviews'); await waitForApp(page)
  await page.getByRole('row').filter({ hasText: `${prefix} I01` }).getByRole('button', { name: '删除', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '已登记关系保护这条记录', exact: true })
  await expect(dialog).toContainText('sourceReferences')
  await dialog.getByRole('button', { name: '保留田野点', exact: true }).click()
  await qualitative(page); await page.getByRole('button', { name: '资料与定位', exact: true }).click()
  await source.getByRole('button', { name: '撤回资料', exact: true }).click()
  await saveForm(page.getByRole('dialog', { name: '撤回资料', exact: true }), 'SYNTHETIC source withdrawal')
  await page.getByRole('button', { name: '案例比较', exact: true }).click()
  await expect(page.getByText('已检查未出现', { exact: true })).toBeVisible()
  await expect(page.getByText('出现', { exact: true })).toBeVisible()
  await expect(page.getByText(/来源现已撤回或赋码已撤回/)).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const beforeRestore = await exportJson(page)
  expect(beforeRestore.comparisonRuns).toEqual(initial.comparisonRuns)
  expect(beforeRestore.evidenceUsages[0]!.state).toBe('retired')
  expect(beforeRestore.codingAssignments.find(item => item.id === 'synthetic-qda-assignment')!.state).toBe('superseded')
  expect(beforeRestore.codingAssignments.some(item => item.state === 'retracted')).toBe(true)
  await importJson(page, beforeRestore)
  const afterRestore = await exportJson(page)
  expectCollectionsEqual(afterRestore, beforeRestore)
  expect(afterRestore.qualitativeCodes.some(item => item.projectId === projectB && item.id === 'synthetic-qda-sentinel')).toBe(true)
  expect(externalRequests).toEqual([]); expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})

test('authenticated backup restores all 44 collections into a vault and wrong passphrases make zero writes', async ({ page }) => {
  const diagnostics = captureBrowserDiagnostics(page), fixture = structuredClone(completeSyntheticFixture)
  const backupPassphrase = 'SYNTHETIC QDA backup passphrase 2026', vaultPassphrase = 'SYNTHETIC QDA vault passphrase 2026'
  await page.goto('/'); await waitForApp(page); await importJson(page, fixture)
  const center = await openWorkspaceCenter(page)
  // JSON imports create standard workspaces. Use the real verified conversion
  // before exercising encrypted export, which is deliberately vault-only.
  await center.getByRole('tab', { name: '隐私与锁定', exact: true }).click()
  await center.getByRole('button', { name: '创建加密副本', exact: true }).click()
  const conversion = page.getByRole('dialog', { name: '创建并验证加密副本', exact: true })
  await conversion.getByLabel('加密副本口令', { exact: true }).fill(vaultPassphrase)
  await conversion.getByLabel('再次输入口令', { exact: true }).fill(vaultPassphrase)
  await conversion.getByRole('checkbox', { name: /旧明文来源仍会保留/ }).check()
  await conversion.getByRole('button', { name: '创建并验证副本', exact: true }).click()
  await expect(conversion).toBeHidden()
  await expectCollectionsEqual(await exportJson(page), fixture)
  await openWorkspaceCenter(page)
  await center.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await expect(center.getByRole('button', { name: '导出加密备份', exact: true })).toBeEnabled()
  await center.getByRole('button', { name: '导出加密备份', exact: true }).click()
  const exporter = page.getByRole('dialog', { name: '创建加密备份', exact: true })
  await exporter.getByLabel('备份口令', { exact: true }).fill(backupPassphrase)
  await exporter.getByLabel('再次输入备份口令', { exact: true }).fill(backupPassphrase)
  const downloaded = page.waitForEvent('download')
  await exporter.getByRole('button', { name: '生成加密备份', exact: true }).click()
  const path = (await (await downloaded).path())!, wrapper = await readFile(path, 'utf8')
  expect(Object.keys(JSON.parse(wrapper)).sort()).toEqual(['ciphertext', 'iv', 'protected'])
  expect(wrapper).not.toContain(prefix); expect(wrapper).not.toContain('SYNTHETIC-NV-P01'); expect(wrapper).not.toContain(backupPassphrase)
  await expect(exporter).toBeHidden()
  await center.getByRole('button', { name: '导入加密备份', exact: true }).click()
  let restore = page.getByRole('dialog', { name: '把加密备份恢复到新工作台', exact: true })
  const fillRestore = async (dialog: Locator, passphrase: string) => {
    await dialog.getByLabel('加密 .sociologydesk 文件', { exact: true }).setInputFiles(path)
    await dialog.getByLabel('备份口令', { exact: true }).fill(passphrase)
    await dialog.getByLabel('新工作台口令', { exact: true }).fill(vaultPassphrase)
    await dialog.getByLabel('再次输入新工作台口令', { exact: true }).fill(vaultPassphrase)
    await dialog.getByRole('checkbox', { name: /无法恢复新工作台口令/ }).check()
  }
  await fillRestore(restore, backupPassphrase)
  await restore.getByRole('button', { name: '检查导入预检', exact: true }).click()
  await expect(restore.getByText('未写入', { exact: true })).toBeVisible()
  await restore.getByRole('button', { name: '恢复到新工作台', exact: true }).click()
  await expect(restore).toBeHidden(); await expect(center).toBeHidden(); await waitForApp(page)
  await page.getByRole('button', { name: '锁定此工作台', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: '加密工作台已锁定', exact: true })).toBeVisible()
  await page.getByLabel('工作台口令', { exact: true }).fill(vaultPassphrase)
  await page.getByRole('button', { name: '解锁工作台', exact: true }).click(); await waitForApp(page)
  expectCollectionsEqual(await exportJson(page), fixture)
  const reopenedCenter = await openWorkspaceCenter(page)
  await reopenedCenter.getByRole('tab', { name: '备份与恢复', exact: true }).click()
  await reopenedCenter.getByRole('button', { name: '导入加密备份', exact: true }).click()
  restore = page.getByRole('dialog', { name: '把加密备份恢复到新工作台', exact: true })
  await fillRestore(restore, 'SYNTHETIC incorrect backup passphrase')
  const before = await persistFingerprint(page)
  await restore.getByRole('button', { name: '检查导入预检', exact: true }).click()
  await expect(restore.getByLabel('备份口令', { exact: true })).toHaveValue('')
  await expect(restore.getByRole('button', { name: '恢复到新工作台', exact: true })).toHaveCount(0)
  expect(await persistFingerprint(page)).toEqual(before)
  await restore.getByRole('button', { name: '取消', exact: true }).click()
  await closeCenter(page, reopenedCenter)
  expectCollectionsEqual(await exportJson(page), fixture)
  await qualitative(page, `&segmentRevision=${encodeURIComponent(fixture.sourceSegments[0]!.currentRevisionId)}`)
  await expect(page.locator('.qualitative-trace').getByText('L12–18', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  expect(diagnostics).toEqual({ pageErrors: [], consoleProblems: [] })
})
