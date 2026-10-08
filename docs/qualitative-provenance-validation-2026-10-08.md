# 0.6.0-rc.1 候选验收记录 — 2026-10-08

这是未发布的本地候选，基于 main `68f504bef1865c7a04ec93d7cfd59260a526fd94`（核验 tree `f651f70e70d879237a1cad0b8c9e1b27d0c9ef38`）。没有远程分支、PR、合并、tag、GitHub Release 或 Pages 更新；Issue #2/#4 未关闭。

## 实际检查

|检查|结果及边界|
|---|---|
|依赖安装|`npm ci --offline --no-audit --no-fund` 成功，442 个包；没有新增依赖|
|TypeScript|`npm run typecheck` 通过|
|Lint|`npm run lint` 通过，0 warning|
|完整单元/组件回归|`npm test -- --configLoader=native --pool=threads --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=../outputs/publish-candidate/vitest-results.json`：58 文件、589 测试全部通过，无跳过|
|生产构建|`npm exec vite -- build --configLoader native` 通过；候选包内另以本地候选 commit SHA 标记构建来源|
|PWA 静态合同|`node scripts/verify-pwa-build.mjs` 通过，2 个图标；预缓存仅包含静态文件。未验证真实旧 waiting worker 升级|
|依赖安全审计|`npm run audit:release -- --fetch-retries=0 --fetch-timeout=10000`：0 vulnerabilities|
|Zotero 保持兼容|原脚本完成 XPI 构建，子进程测试启动被 `spawn EPERM` 阻断。`node --test --test-isolation=none integrations/zotero-plugin/test/*.node.cjs` 8/8 通过；检查结束后正式 update manifest 精确恢复原字节|
|新增浏览器用例|`e2e/qualitative-provenance.spec.ts` 桌面/触屏共 4 个实例，Playwright `--list` 及独立类型检查通过；真实浏览器 **NOT RUN**|
|独立复核|冻结生产源码静态复核未发现剩余 P0/P1；此前 52 项定向测试通过。此结论不代替浏览器或远程 CI|

默认 `npm test`、`npm run build` 的 Vite 配置打包，以及 `npm run test:e2e` 的进程启动在本执行环境报 `spawn EPERM`。表中 native/threads/in-process 是工具公开支持的配置，不改变测试断言或应用逻辑。默认命令未被改成这些配置；远程 CI 必须运行原有脚本。

正式 Zotero 0.1.0 发布 XPI 的 advertised SHA-256 保持 `e940f29bb803774a9311b0b5c8f40776558c9362bfa58f28c01681e5ed7795ee`；本地重打包 XPI 并非该正式资产，没有附入候选包或改写发布声明。

## 覆盖的关键行为

- 编码跨访谈复用、独立 ID 与定义修订、显式重编、合并/拆分 lineage、单条赋码撤回；旧赋码仍钉住原代码与资料片段版本。
- 复用 TheoryMemo 的分析 facet 与快照，主张形成关系、支持/反驳关系与实际论文使用分开登记；Issue #2 和 #4 共用相同 EvidenceItem/Claim/Manuscript 及追溯接口。
- 双向定位、外部 NVivo 匿名引用及历史行号/token/论文版本定位；来源撤回停用相关支持与论文使用，历史仍可回看。
- 比较冻结案例、匿名抽样类别、访谈集合、代码版本和赋码状态；人工核查的缺席、反例、未检查和不适用分开，不从未赋码推断缺席。
- 44 集合全项目普通/加密备份、v7→v8→v9 分阶段迁移、旧 singleton 只读复制、附件与 ID 保真、碰撞/跨项目拒绝及 revision CAS。
- 记录或字节容量超限的迁移/import 不截断、不部分写入；普通来源超出迁移后 32 MiB、加密认证失败和竞争写入均保留原数据。旧合法大工作区保留受限加密备份路径。
- 旧表单保存失败保留草稿，当前/历史/退役关系参与删除预览与提交时复查。普通 updater 获得隔离副本，原地修改历史同样在界面或数据库写入前被拒绝。

所有输入均为完全合成的匿名研究元数据，未读取真实访谈、身份、当前用户数据库或研究文件；没有全文编码编辑器、自动转录或 AI 自动编码。源引用只记录匿名 token/明确 HTTPS 引用及可选摘要，不读取、上传或嵌入转录内容。

## 发布阻断及剩余门禁

创建发布分支时 GitHub 连接器返回：`MCP tool call requires approval, but approval policy is never`。这是连接器审批策略拒绝，非待批准的用户操作；本会话不能完成远程写入，也未尝试绕过该拒绝。

在具有合法写权限的环境中应用候选补丁后，还需对确切 pushed head 运行原 CI、CodeQL，完成真实桌面/触屏普通及加密工作区、独立备份恢复、错误口令零写入，以及真实 v0.5.0→候选 PWA waiting-worker 队列验收。合并后须核对 main CI/CodeQL/Pages 部署、tag/Release 和公开版本身份。以上未完成前，候选不应宣称正式发布，也不应关闭 Issue #2/#4。

候选 schema9 保留旧实体字段、ID、附件和 v7 导入，现有 v7 文件不会被重写。旧 v0.5.0 应用无法读取 v9 文件/数据库；升级前需保留并独立验证 v7 完整备份。迁移容量检查不等于已经替用户创建独立备份。

## Current release execution: actual first failure — 2026-10-08

The current approved environment successfully ran the original npm ci (442 packages). The original audit:release and exact-head push/PR CI on `85ac09340b50e0a6df787cedb62c32606aab6ec9` failed on GHSA-68fv-2mgg-jv7q in locked source-map-js 1.2.1. This history is preserved; it is not a browser PASS. The release-only fix advances that single transitive lock entry to official npm source-map-js 1.2.2 without adding a dependency or changing test/security gates. The original complete commands and remote checks must pass again on the resulting final head before merge.

The first actual old-public synthetic browser run also exposed a test-fixture mismatch: standard JSON imports cannot use the deliberately vault-only encrypted export button. The new browser scenario now follows the existing verified encrypted-copy flow and checks complete 44-collection equivalence before exporting; all authenticated restore/wrong-passphrase assertions remain. No disabled control or encryption gate is bypassed. The first native attempt failed and closed its contexts; fresh old-v7 cohorts must independently reach READY and complete the update.
