# Campus-Hub AI 协作规范

> 本文档用于规范 AI 在 campus-hub 项目中的工作方式，确保代码风格一致、协作高效。

---

## 1. 技术栈约束（不要随意更换）

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Go + 原生 net/http + SQLite | 单体服务，端口 8080 |
| 前端 | React 19 + TypeScript + Vite | 端口 5173，代理到后端 |
| 富文本 | TipTap (ProseMirror) | 编辑器 + 内容渲染 |
| 实时通信 | WebSocket (gorilla/websocket) | 统一事件信封格式 |

---

## 2. 代码规范

### Go 后端
- 格式化：`gofmt`
- 错误处理：`if err != nil { return }` 风格
- 模块结构：每个功能模块一个目录，包含 `handler.go`
- 日志：使用标准库 `log`

### TypeScript 前端
- 格式化：遵循项目 ESLint 配置
- 组件：函数式组件 + Hooks
- 状态管理：React Context（目前够用）
- 样式：CSS 文件，类名语义化

---

## 3. 文件组织

```
server/
├── {module}/handler.go    # 后端新模块
├── store/                  # 数据存储层
└── internal/               # 内部工具

apps/web/src/
├── api/                    # API 客户端
├── components/             # 可复用组件
├── pages/                  # 页面组件
├── context/                # React Context
├── store/                  # 状态管理
└── utils/                  # 工具函数
```

---

## 4. API 设计原则

- RESTful 风格，遵循 `docs/api.md` 的格式
- **新接口流程**：先在 `docs/api.md` 定义 → 实现 → 测试
- 时间字段：UTC RFC3339 格式
- 认证：Bearer Token

---

## 5. AI 协作规则

### 开始工作前
- [ ] 阅读本规范文件
- [ ] 阅读相关文档（spec.md / api.md / decision-log.md）
- [ ] 阅读要修改的现有代码，理解上下文

### 编码原则
- **最小改动**：只改需要改的，不要过度重构
- **不要过度设计**：不加未被要求的功能
- **保持一致**：遵循现有代码风格
- **先说方案**：涉及架构变更时，先讨论再实现

### 文档更新
- 新增 API 接口 → 更新 `docs/api.md`
- 新增 WebSocket 事件 → 更新 `docs/ws-protocol.md`
- 重要技术决策 → 记录到 `docs/decision-log.md`

### 不要做的事
- 不要随意更换技术栈
- 不要添加不必要的依赖
- 不要删除看起来没用但不确定的代码（先问）
- 不要在没有测试的情况下大规模重构

---

## 6. 提交规范

```
<type>(<scope>): <description>

type: feat / fix / docs / refactor / style / test
scope: web / server / api / ws / docs
```

示例：
- `feat(web): 添加用户主页`
- `fix(server): 修复评论投票计数错误`
- `docs: 更新 API 文档`

---

## 7. 常用命令

```bash
# 启动后端
cd campus-hub && go run ./server

# 启动前端
cd apps/web && npm run dev

# 类型检查
cd apps/web && npx tsc --noEmit

# 构建前端
cd apps/web && npm run build
```

---

## 8. 当前已知问题（AI 注意）

- [x] ~~富文本编辑器图片上传/显示逻辑需要修正~~ (已修复 2026-01-09)
- [x] ~~评论区图片显示逻辑需修正~~ (已修复 2026-01-09)
- [ ] ESLint 有一些 React hooks 相关的警告，暂未处理

---

> 本规范随项目演进更新，AI 每次协作时应优先阅读此文件。
