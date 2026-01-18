# Campus Hub (MVP)

这是一个面向在校大学生的校园社区平台 MVP。

## 核心功能

*   **社区**: 浏览板块、查看最新帖子、发帖、评论、点赞/点踩。
*   **实时聊天**: 多个主题房间（综合讨论、课程互助等），支持查看历史消息。
*   **资源共享**: 简单的文件上传与链接分享。
*   **用户系统**: 注册、登录、个人主页、关注/私信（MVP 占位）。

## 技术栈

*   **前端**: React, TypeScript, Vite, Ant Design (UI), TipTap (富文本), React Router v6
*   **后端**: Go (Gin), Gorm, SQLite
*   **实时通信**: WebSocket

## 快速开始

### 前置要求

*   Node.js 18+
*   Go 1.20+

### 启动后端

```bash
cd server
go run .
```

后端服务将运行在 `http://localhost:8080`。

### 启动前端

```bash
cd apps/web
npm install
npm run dev
```

前端开发服务器将运行在 `http://localhost:5173`。

## 项目结构

```
.
├── apps/
│   └── web/          # 前端 React 应用 (Ant Design)
├── server/           # 后端 Go 服务
├── docs/             # 项目文档
└── README.md         # 项目入口文档
```

## 文档索引

*   [前端架构说明](docs/frontend-architecture.md)
*   [前端迁移记录 (Ant Design)](docs/frontend-migration.md)
*   [API 接口文档](docs/api.md)
*   [WebSocket 协议](docs/ws-protocol.md)
*   [富文本编辑器方案](docs/rich-editor.md)

## 最新变更

前端已全面迁移至 Ant Design 组件库，提升了界面一致性和开发效率。详情请见 `docs/frontend-migration.md`。
