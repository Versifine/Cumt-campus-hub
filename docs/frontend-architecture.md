# docs/frontend-architecture.md - Campus Hub Frontend Architecture (MVP)

# Campus Hub 前端架构说明（MVP）

## 目标
- 面向在校生交付可用的 MVP：社区帖子、实时聊天、课程资源互助。
- **UI 框架**：全面采用 **Ant Design**，确保界面专业、一致且易于维护。
- 结构清晰，便于寒假期间快速迭代。

## MVP 范围
- 社区：浏览板块、查看最新帖子、发帖（富文本）、评论（富文本、楼中楼）。
- 聊天：加入房间、查看最近历史、发送消息。
- 资源：上传文件并分享下载链接。

## 页面与路由
- `/` 首页（响应式布局：左侧板块导航，中间帖子流，右侧公告）
- `/post/:id` 帖子详情 + 评论区
- `/submit` 发帖页（富文本编辑器）
- `/chat` 实时聊天室
- `/resources` 资源互助中心
- `/login` 登录 / 注册
- `/u/:id` 用户个人主页

## 布局与组件架构
- **全局布局**：使用 Ant Design `<Layout>`, `<Header>`, `<Content>`, `<Sider>`。
- **核心组件**：
  - `SiteHeader`: 顶部导航，包含 Logo、搜索框、用户菜单（`<Menu>`, `<Avatar>`, `<Dropdown>`）。
  - `PostCard`: 帖子展示卡片（`<Card>`, `<Image.PreviewGroup>`, `<Space>`）。
  - `RichEditor`: 基于 TipTap 封装，工具栏使用 Antd `<Button>` 和 `<Tooltip>`。
  - `StateBlocks`: 状态展示（`<Result>`, `<Skeleton>`, `<Spin>`）。
- **样式管理**：
  - 主要依赖 Ant Design 的 Design Token (`theme.useToken()`)。
  - `index.css` 仅保留极少量全局重置和编辑器特定样式。

## 状态与数据流
- 登录状态由 `AuthContext` 管理，持久化至 localStorage。
- 数据获取：组件内部使用 `useEffect` + `fetch` 模式（MVP 阶段保持简单）。
- 实时通信：WebSocket (`/ws/chat`) 用于聊天室。

## API 对接
- RESTful API 用于常规业务（帖子、评论、用户、文件）。
- WebSocket 用于实时聊天。

## 体验优化
- **富文本**：支持图片拖拽上传、所见即所得编辑。
- **图片预览**：全站图片支持点击放大（Antd `<Image>`）。
- **响应式**：适配桌面端和移动端布局。
- **加载反馈**：骨架屏（Skeletons）和加载转圈（Spin）覆盖关键等待状态。

## 目录结构
```
src/
  api/          # API 客户端封装
  components/   # 公共组件 (Antd 封装)
    rich-editor/# 富文本编辑器组件
  context/      # React Context (Auth)
  pages/        # 页面级组件
  utils/        # 工具函数
```
