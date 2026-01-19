# docs/frontend-architecture.md — 前端架构（MVP）

## 目标

- 面向在校生交付可用的 MVP：社区帖子、实时聊天、资源互助。
- UI 框架统一为 Ant Design，保持一致性。

## 页面与路由

- `/` 首页
- `/post/:id` 帖子详情
- `/submit` 发帖
- `/chat` 聊天室
- `/resources` 资源互助
- `/login` 登录/注册
- `/u/:id` 用户主页
- `/admin` 举报管理（管理员）

## 组件与布局

- Layout：`SiteHeader` + `Layout` + 页面 Card 结构
- 常用组件：`PostCard`, `ReportModal`, `EditProfileModal`, `RichEditor`
- 图片展示：Antd `<Image>` 与 `<Image.PreviewGroup>`

## 状态与数据流

- 登录态：`AuthContext` + localStorage
- API：`apiRequest` 统一处理鉴权与错误
- 实时聊天：`/ws/chat` WebSocket

## 目录结构

```
src/
  api/
  components/
  context/
  pages/
  utils/
```
