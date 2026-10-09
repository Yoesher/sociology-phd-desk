# 定性分析与共享证据追溯（候选 schema9）

接口权威：src/models/domain.ts、src/models/provenance.ts；结构校验：src/utils/provenance-schema.ts；图约束/双向定位/删除预览：src/utils/provenance-graph.ts；纯全快照操作：src/utils/provenance-commands.ts。普通/加密 repository 负责完整快照的验证、原子保存与 revision CAS，不对自由文本猜测关系。

|已有对象|兼容方法|
|---|---|
|Interview / FieldVisit|匿名资料引用的所有者；不改变旧状态和备注含义|
|TheoryMemo|AnalyticalMemoFacet一对一扩展；TheoryMemoRevision固定原正文和原关联|
|Claim|ClaimRevision保存文本、状态、notes；ClaimDerivationLink固定解释形成链|
|EvidenceItem / Evidence|同一已有对象及EvidenceRevision；EvidenceClaimLink逐条保存支持/反驳、理由与局限|
|Literature / AnalysisRun|EvidenceSourceLink的共享来源类型；与新片段类型共用接口|
|Manuscript|ManuscriptAnchor是逻辑位置，revision固定某文档版本的定位|

Issue #2 的8个集合：claimRevisions、evidenceRevisions、evidenceClaimLinks、evidenceSourceLinks、manuscriptAnchors、manuscriptAnchorRevisions、claimManuscriptLinks、evidenceUsages。

Issue #4 的17个集合：samplingDimensions、researchCases、interviewCaseLinks、sourceReferences、sourceRevisions、sourceSegments、sourceSegmentRevisions、qualitativeCodes、qualitativeCodeRevisions、codeRelations、codingAssignments、analyticalMemoFacets、theoryMemoRevisions、memoMaterialLinks、claimDerivationLinks、comparisonRuns、qualitativeChangeEvents。

对象与版本 ID 固定，不由别名、排序或语言生成。新对象用前缀+crypto.randomUUID；旧ID原样保留；机械迁移r1用固定命名空间及碰撞处理。revision序列连续、previous属于同一对象、current指向最后修订。旧赋码、memo、EvidenceUsage固定具体revision，重新锚定或代码定义修订只新增版本。合并/拆分生成新编码和lineage关系，不自动替换原赋码。

完整图检查每条typed endpoint存在、同项目及父子所属一致。主题groups关系无环；comparison冻结案例属性、case–interview关系及赋码冻结状态，present不等于人数/饱和度，absent-reviewed必须有明确已检查材料。后来资料撤回不会改写冻结判断，而是另标当前失效。

所有正常页面保存先经reconcileProvenanceRootEdits，旧表单也创建相应历史；不能覆写旧版本或稳定归属。显式整工作台备份替换是独立的、有预览和确认的恢复流程。merge中同ID不同版本/端点或语义不同的上游项目/资料拒绝；同内容幂等。显示投影不能用于保存、校验或删除保护。

普通Dexie固定历史version7，再注册8/9升级，事务内验证完整候选后提交。加密先认证原header版本和raw payload版本一致，再迁移/验证/重新密封并read-back；口令错误、超限、损坏或CAS失败保留原vault。注册表只保存路由信息，token、digest、研究者判断不进入注册表。

删除预览查完整工作台，包括历史引用与冻结比较。归档保留历史；撤回关闭来源、赋码、支持关系和实际论文使用。历史审计不是身份资料的安全擦除：本候选不提供跨所有快照的自动身份清理，禁止录入识别信息。外部引用不读取、下载或上传资料，匿名令牌也不保证自动匿名化。

合成样例在src/test-fixtures/qualitative-workspace.json：家庭照料安排、祖辈支持条件、伴侣协商与反例；只使用标明SYNTHETIC的分析元数据，没有采访原文、真实身份或实证结论。不是生产DEMO自动填充真实访谈叙事。
