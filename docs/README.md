# Docs Index (docs/README.md)
#
# NOTE: Keep the first lines ASCII to avoid a Windows sandbox tooling issue
# when applying patches. The actual content starts below in Chinese.

# 文档索引（docs/README.md）

本仓库文档用于对齐现有实现与后续规划。建议按以下顺序阅读：

## 推荐阅读顺序

1. `docs/spec.md`：产品目标、功能范围、数据模型、阶段规划
2. `docs/frontend-architecture.md`：前端架构与路由说明
3. `docs/api.md`：REST API 设计与接口清单（与实现对齐）
4. `docs/ws-protocol.md`：WebSocket 协议（与实现对齐）
5. `docs/rich-editor.md`：富文本编辑器方案与上传流程
6. `docs/decision-log.md`：关键决策记录

## 代码入口提示

- 后端入口：`server/main.go`
- Web 前端：`apps/web`（React 19 + TypeScript + Vite + Ant Design）
- 内存数据存储：`server/store/store.go`
- SQLite 数据库存储：`server/store/sqlite_store.go`
- HTTP JSON 工具：`server/internal/transport/transport.go`
- 功能模块：
  - 认证：`server/auth/handler.go`
  - 社区（板块/帖子/评论）：`server/community/handlers.go`
  - 文件上传下载：`server/file/handler.go`
  - 实时聊天（WebSocket）：`server/chat/handler.go`、`server/chat/hub.go`
  - 举报管理：`server/report/handler.go`
