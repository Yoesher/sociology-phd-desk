# 研究笔记、检索、关系追踪与项目概览：官方资料比较

检索与只读源码核查日期：2026-10-04。项目基线：真实原仓库，HEAD `656b99ac708760b4aae684be8c4b19a95c7608a2`，应用 0.4.1、portable/standard/authenticated payload v7、container/vault/registry v1。原目录 `git status --short` 为空。本报告未改源码、未注册外部产品、未上传研究内容，也未测试这些产品的付费或登录功能。下一轮实现版本由主任务确定为 0.5.0；以下是研究建议和验收要求，不是已实现或已发布声明。

## 检索边界和资料读取程度

这是围绕七款代表性产品的一手资料定向检索，覆盖官方帮助、官方知识库、官方博客和官方产品说明；不是“全网穷尽”，也不是系统性文献综述。使用四类关键词组合：笔记/日记与链接、跨对象检索、双向引用/关系、项目与数据库视图。不以第三方测评、市场宣传数量、用户数量、销量或未核实的产品排名作为证据。

至少六款产品的官方正文已由网页工具实际返回并读取：Obsidian、Logseq、Notion、Heptabase、Tana Outliner、ResearchRabbit。Connected Papers 的官方 about 说明由搜索引擎解析返回了算法正文；直接打开规范 `/about` 只返回一行页面壳，因此该条的读取程度单独标记，未声称手工操作过其图谱。网页行数只是工具返回的解析结果，不代表实际使用体验。

| 产品 | 实际读取的官方资料与程度 | 与本轮有关的行为 | 对本项目的保守取舍 |
| --- | --- | --- | --- |
| Obsidian | [Search](https://obsidian.md/help/Plugins/Search)、[Backlinks](https://obsidian.md/help/Plugins/Backlinks)、[Canvas](https://obsidian.md/help/Plugins/Canvas) 均返回正文；另读 [How Obsidian stores data](https://obsidian.md/help/Files%2Band%2Bfolders/How%2BObsidian%2Bstores%2Bdata)。 | 搜索可查正文并显示上下文；反向引用区分已有链接与未链接提及；Canvas 可以组合笔记、附件和连接。 | 先做正文命中摘要和已登记关系反查。标题相同/词语相似不能自动成为关系。无需先实现无限画布，也不改变本项目 IndexedDB 为文件系统。 |
| Logseq | [官方文档索引](https://docs.logseq.com/)返回功能目录；[Networked Thinking 指南](https://blog.logseq.com/how-to-get-started-with-networked-thinking-and-logseq/)实际返回 188 行正文，文章日期 2022-04-18；[查询构建器发布说明](https://blog.logseq.com/whiteboards-and-queries-for-everybody/)是 2023-03-29 的历史资料。 | 日记降低捕捉想法时的分类负担，页面/块引用及反查重新聚合分散笔记，保存的查询形成工作视图。 | 借鉴研究日志的“先记录、再找回”和派生视图；不把旧 0.9.1 说明称作现行最新版，不据旧文章推断今天所有同步/联网行为，不复制整套块编辑器或查询语言。 |
| Notion | [Search](https://www.notion.com/help/search)正文 302 行、[Relations & rollups](https://www.notion.com/help/relations-and-rollups)421 行、[Views, filters, sorts & groups](https://www.notion.com/help/views-filters-and-sorts)419 行。另一个 Academy linked-views 地址打开报 Internal Error，仅搜索返回教学正文，不作为主要证据。 | 工作区搜索与数据库搜索覆盖的内容不同；关系字段和 rollup 汇总关联记录；同一数据库可用不同过滤、排序与视图展示。 | 用相同真实记录生成项目概览，不复制一份数据。明确本地检索覆盖字段，避免“全局”实际上只查标题。采用原生可点列表/卡片，不引入账号或云工作区。 |
| Tana Outliner | [Search nodes](https://outliner.tana.inc/learn/features/search-nodes)正文 513 行；官方 [Supertags](https://outliner.tana.inc/learn/features/supertags)、[Sidebar](https://outliner.tana.inc/learn/features/sidebar)和 [Search and navigation](https://outliner.tana.inc/help/search-and-finding)也实际返回功能正文。 | typed objects 通过字段组织；live query 产生指向原节点的结果，编辑引用会影响原记录；检索范围及过滤是显式条件。 | 本项目已具备类型化研究实体，先提供“项目＋记录类型＋文字”过滤和稳定 ID 跳转。不要为了菜单新建状态枚举，不复制任意 schema 构造器或其需要桌面应用的交互前提。 |
| Heptabase | [User Interface Logic](https://wiki.heptabase.com/user-interface-logic)正文 234 行；[Use deep links](https://support.heptabase.com/en/articles/11176386-use-deep-links)实际返回正文；[MCP tool reference](https://support.heptabase.com/en/articles/17060792-heptabase-mcp-tool-reference)实际返回正文。 | 不同入口共享卡片数据库；日记、卡片库、白板和标签视图重新组织同一记录；深链接定位对象或块。MCP 文档对标题检索/支持的正文/PDF解析分别有边界。 | 借鉴一条记录多种上下文与可靠定位。首轮只建立本地对象详情入口；不声称 PDF 字节已被全文检索，不接云端 MCP、语义检索或自动 PDF 解析。 |
| Connected Papers | [官方 About](https://www.connectedpapers.com/about)算法说明实际由官方搜索解析结果读到；规范页面直接打开只得到一行壳页。 | 图按共引/书目耦合相似性安排，官方明确它不是引用树；相邻节点可能没有直接互引。 | 将“相似性”“同项目”“显式关系”区分。首轮关系追踪只展示用户已登记的 ID 关系，不制造文献引用边、证据支持关系或理论因果边。 |
| ResearchRabbit | [Step-by-Step Guide](https://www.researchrabbit.ai/articles/guide-to-using-researchrabbit)正文 270 行；[Getting started](https://learn.researchrabbit.ai/en/articles/12439939-how-to-get-started-with-researchrabbit)及[官方帮助目录](https://www.researchrabbit.ai/help/guide)实际返回正文。 | seed papers 引导发现；Similar、References、Cited By 是不同探索方向，论文可写笔记并放入 collections。 | 借鉴“从当前对象继续追踪”的连续操作，但本地已登记关系的反查不等于外部引用检索。当前不引入账号绑定、远端论文检索、推荐排序或私人笔记上传。 |

## 项目现状：先改善找回与衔接

以下结论来自当前源码，不从竞争产品反推本项目已有能力：

- `src/hooks/useModuleSearch.ts:5` 是各模块 URL 智能筛选的统一管理；具体文字检索分散在页面中。它本身不是跨模块正文检索。当前源码没有现成的 `GlobalSearch` 或“研究导航”实现。
- `src/hooks/useProjectWorkspace.ts:7` 明确是显示投影，`fullData` 在该文件末尾保留完整工作台。新增全局检索应从当前已解锁工作台的完整 snapshot 派生，再显式选择“当前项目/所有项目”；任何展示结果不应被作为写入或备份 snapshot。
- `src/models/domain.ts:174–201` 已有 ResearchQuestion、Claim、ClaimQuestionLink 和 TheoryMemo 的 stable ID / same-project 关系。TheoryMemo 关联问题、主张、文献，适合提供正向/反向可点列表，而不是新建第二套关系数据。
- `src/features/theory/TheoryMemoWorkspace.tsx:240–245` 可取得已登记关联对象，但详情 `:416–418` 主要连接成文字。可改进的是定位和反查，不是宣称此前没有理论笔记。
- `src/features/projects/ProjectsPage.tsx:237` 已按项目汇总任务、文献、田野、分析、证据、论文、投稿、问题、主张、memo；可以在此基础上统一项目研究概览，不重复存储计数。
- `src/models/domain.ts:334–344` 的 EvidenceItem.claim、source、locator、manuscriptLocation 是用户文本。它们不是 Claim/Manuscript ID 边。README 把 Evidence↔Claim↔Manuscript 完整显式追踪列为独立 Issue #2。相同文字或同项目不能冒充已存在的论证链。
- 研究日志有 whatChanged、decision、problem、nextStep，TheoryMemo 已有六种 memoType；首轮不需要新建通用笔记实体、更换编辑器或升级 v7 schema。

## 优先交付三个可以独立验收的成果

这些是结合官方模式和本项目源码形成的设计推断；不是供应商承诺，也不是已经完成的功能。

### 1. 当前本地工作台的跨模块研究检索

在“研究导航”中输入中英文关键词，按项目和研究记录类型过滤；搜索已保存的标题、正文、备注、研究判断与下一步等文本，结果显示记录类型、项目、命中片段，并能打开准确对象。以稳定类型＋ID定位；不要用重复标题作为身份。

验收：两个项目中同一关键词分布于文献备注、理论 memo、研究日志和问题/主张；“当前项目”与“所有项目”数量符合真实记录；点击后准确打开对象；中英文界面切换不改内容。刷新和离线仍可检索已经保存的记录。锁定、工作台切换、删除记录后立即清除旧结果/失效选中对象。完整 ordinary/encrypted 备份前后严格相等，不包含搜索索引或 UI 条件。PDF/图像的 base64 字节、源路径指向的外部文件和未解析全文均不纳入检索；不得声称找回了未读取过的用户资料。

实现边界：索引只在内存中派生，避免将已解密正文另存到明文 localStorage、registry 或 IndexedDB；不持久化私人查询历史，不联网，不注入任意 HTML 作为高亮，不开放正则执行或无界匹配。量大时分批/缓存并明确显示结果总数与当前显示数，不假称隐藏结果不存在。

### 2. 真实关系的对象详情与反向引用

打开研究问题、主张、理论 memo、文献、田野点/地图、访谈/访问或投稿后，显示已有明确 ID 关系的方向与关系类型，并允许继续打开相关对象。反向关系由同一个完整 snapshot 计算；需要“同项目其他记录”时另作分组，不把它称为关联。

验收：一个 Claim 关联两个问题，memo 关联该 Claim 与一条文献，田野点关联访问/访谈且在两个地图里标注；两端反查结果与真实 ID 一致、不会把同名他项目对象算入。重复地图标注按 unique fieldSiteId 计数。删除/工作台切换后无旧正文泄漏，查询过程无任何写入。没有关联时显示“尚未登记关联”，不能写成“研究不合格”“证据不足”，不能把 Evidence.claim 自由文本自动绑定为 Claim ID。

### 3. 项目研究概览及可点计数

项目概览从现有实体派生四组卡片：任务期限；问题/主张；文献/理论/田野/分析资料；论文与修回。呈现实际记录数、已完成任务 x/y、逾期/未来七天任务、尚未关联主张的问题等可解释状态；点击计数跳转到该项目对应记录列表。项目范围为空时列全部项目，有选择时只列对应项目。

验收：固定日期的合成两个项目，准确计算未完成的逾期/即将到期任务，保留 Done/Deferred 原状态，不用任务完成比例当“项目完成百分比”。已标注田野点显示 unique 已标注点/总点，绝不输出地理坐标。正文明确计数不评定研究质量，“未关联”只是记录状态。空项目/全空工作台有清楚可读说明；标准 snapshot 深度冻结后渲染和点击不发生 mutation。中英文、键盘和触屏 390×844 可用，三档字号与浅/深模板不水平溢出。

## 本轮不宜合并的扩展

不增加任意块编辑器/无限画布、云 AI 语义搜索、自动元分析、外部论文推荐 API、账号/同步、远端引用网络下载、全国地图或附件存储重构。它们具有独立数据模型、隐私、资源和验收成本，不能以“同类软件已有”作为自动授权或完成依据。大规模全文/OCR检索与分离附件需要另行设计，当前 PDF 10/20 MiB、图像 2/4 MiB、普通 JSON 32 MiB、加密容器 64 MiB 边界仍然成立。

## 实现与发布共同约束

已阅读当前 README、PROJECT_STATE 的当前交接段、DECISIONS 最近 ADR-026–029、NEXT_TASKS 当前/附件段及 AGENTS；没有重写历史。新工作遵守 AGENTS 的两级主导航、研究域为主、中文默认＋完整英文、浏览器 first-class、no account / no required cloud、显示投影与完整写入/备份分离、伦理与匿名田野边界。若只做派生读模型和导航，不需要 schema v8；若后来真的新增持久化研究关系，必须重新审查 schema/migration/删除保护并记录 ADR，不能用当前建议预先证明它安全。

独立组件/纯函数测试验证正确计数、稳定 ID 跳转、不可变输入与工作台切换；实际桌面＋触屏 E2E 验证完整 old/new 备份、加密、PWA 和页面/模态键盘行为。发布仍须对最终共同提交运行原八命令，再核对 exact-head push/PR CI、CodeQL、expected-head merge、最终 main/Pages/deployment/HTTP identity、fresh synthetic public 与真实 waiting-worker 数据保留。成功构建、竞争产品功能或本报告均不代表上线成功。
