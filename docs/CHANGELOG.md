# CHANGELOG - campus-hub 变更日志

> 本文档记录项目的重要变更、新功能和问题修复。

---

## [Unreleased]

### 2026-01-09

#### 新功能
- **图片智能模糊背景**：帖子内容图片支持智能模糊背景显示
  - 当图片宽度无法填满容器 85% 时，自动添加模糊背景
  - 图片居中显示，效果类似 Reddit
  - 评论区图片不使用模糊背景，保持简洁

- **RichContent variant 支持**：富文本组件新增 `variant` 属性
  - `variant="post"`（默认）：帖子模式，使用智能模糊背景
  - `variant="comment"`：评论模式，小图保持原始大小，无模糊背景

#### 问题修复
- **修复图片上传后无法显示的问题**
  - 原因：数据库 `files` 表缺少 `width` 和 `height` 列
  - 解决：添加向后兼容的数据库迁移，自动为旧数据库添加缺失列
  - 影响：所有新上传的图片现在可以正常保存和显示

- **修复图片点击无法放大预览的问题**
  - 原因：ImageNodeView 组件缺少 `data-src` 属性
  - 解决：在 NodeViewWrapper 上添加 `data-src={src}` 属性

#### 技术改进
- **数据库迁移策略**：建立向后兼容的迁移模式
  - 使用 `ALTER TABLE ADD COLUMN` 添加新列
  - 使用 `isSQLiteDuplicateColumnError` 忽略列已存在的错误
  - 确保迁移语句幂等（可重复执行）

- **SaveFile 日志增强**：添加详细的错误日志
  - 记录事务开始、计数器获取、插入和提交的错误
  - 便于调试文件上传问题

---

## 2025-12

### 初始版本
- 社区论坛基础功能（板块、帖子、评论）
- 实时聊天 WebSocket 支持
- 用户认证系统（登录/注册）
- 文件上传与下载
- 帖子/评论点赞点踩
- 富文本编辑器（TipTap）
- 用户个人主页

---

## 文件变更索引

### 2026-01-09 图片显示优化

**前端组件**
- `apps/web/src/components/RichContent.tsx`
  - 新增 `variant` prop 支持
  - ImageNodeView 添加 `data-src` 属性
  - 智能模糊背景检测逻辑

- `apps/web/src/components/CommentMediaBlock.tsx`
  - 简化媒体缩略图逻辑
  - 统一使用 object-fit: cover

- `apps/web/src/pages/PostPlaceholder.tsx`
  - 评论区 RichContent 传递 `variant="comment"`

**样式**
- `apps/web/src/index.css`
  - `.rich-content__image-wrap` 和 `.rich-content__image-bg` 样式
  - `.rich-content--comment` 评论模式样式
  - `.media-thumb__media` 媒体缩略图样式

**后端**
- `server/store/sqlite_store.go`
  - 添加 files 表 width/height 列迁移
  - SaveFile 函数添加调试日志
