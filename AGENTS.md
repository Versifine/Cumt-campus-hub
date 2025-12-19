# Repository Guidelines

## 项目结构与模块组织

本仓库以文档为主，核心内容在 `docs/`。主要文件包括：`docs/spec.md`
（产品与架构规划）、`docs/api.md`（REST 设计）、`docs/ws-protocol.md`
（WebSocket 协议）、`docs/decision-log.md`（关键决策记录）。
`docs/spec.md` 中提到的 `server/`、`apps/` 等目录目前未出现在仓库内。

## 文档索引与模板

- 建议维护 `docs/README.md` 作为索引，说明每个文档的目的与阅读顺序。
- 新增 REST API 时，按固定结构描述：路径与方法、请求参数、响应体、
  错误码与示例 JSON。
- 新增 WebSocket 事件时，说明方向（客户端→服务端/服务端→客户端）、
  `type` 值、`data` 结构与示例消息。

## 构建、测试与本地开发命令

当前没有内置构建或运行脚本，也没有固定的 `npm test`、`go test` 命令。
日常工作以编辑与审阅 Markdown 为主，建议在编辑器中预览渲染效果；
相关设置在 `docs/.vscode/settings.json`。若后续引入工具链，请在此处
补充命令示例与作用说明。

## 代码风格与命名约定

- 文档采用 Markdown，标题清晰、段落简短。
- `docs/` 下文件名使用 kebab-case，例如 `decision-log.md`。
- JSON 字段使用 snake_case，例如 `created_at`、`board_id`。
- 资源 ID 建议保留前缀（示例：`u_123`、`b_1`、`p_1`、`m_1`、`f_123`）。
- 时间统一使用 ISO 8601，例如 `2025-01-01T00:00:00Z`。
- 能用标准 Markdown 就不用 HTML；如必须使用，请保持结构简洁。
- `markdownlint` 配置已在 `docs/.vscode/settings.json` 中指定。

## 测试指南

暂无自动化测试。变更后请自行检查：
- 预览渲染是否正常。
- 文档间的引用、协议字段是否一致。
若新增测试或校验脚本，请补充运行方式与预期输出。

## 提交与拉取请求规范

采用 PR 流程合并到 `main`，不直接提交到主分支。建议分支命名：
`feat/`、`fix/`、`docs/`、`chore/` 等前缀 + 简短主题。
提交信息推荐 Conventional Commits，例如 `docs: update api spec`。
PR 必须填写 `.github/pull_request_template.md`，包含变更摘要、
影响范围与关联文档；如涉及关键约定变更，需更新
`docs/decision-log.md` 并在 PR 中说明。

## 文档更新流程

对 `docs/api.md` 或 `docs/ws-protocol.md` 的修改，通常需要同步更新
`docs/spec.md`。若为非兼容变更或关键约定调整，请更新文档标题中的版本号，
并在 `docs/decision-log.md` 记录变更动机与影响范围。保持文档之间的术语
与字段一致，避免引入相互矛盾的描述。


## 尽量用中文回复
