# docs/spec.md — campus-hub 规格说明（v0.3）

> 产品名（暂定）：校圈

一个面向高校校园的社区平台，融合 **论坛 / 校内墙 / 实时聊天 / 资料互助** 等功能。

本项目以 **工程可扩展性** 为第一目标，采用 **Web + Go 后端** 的方式快速完成 Demo，并在后续阶段平滑迁移至 **Kotlin Multiplatform（KMP）客户端**。

---

## 1. 项目目标

### 1.1 核心目标（Demo 阶段）

- 在寒假周期内完成一个 **可演示、可闭环** 的校园社区 Demo。
- 验证核心路径：登录 → 浏览帖子 → 发帖 / 评论 → 实时聊天 → 资料上传下载。
- 建立稳定的后端 API / WebSocket 协议，为后续客户端迁移打基础。

### 1.2 非目标（明确不做）

- 不做复杂推荐算法
- 不做商业化 / 广告 / 积分体系
- 不做完整 IM（已读回执、离线推送、消息撤回等）
- 不做正式实名认证或学号系统

---

## 2. 整体架构设计

### 2.1 架构原则

- 后端稳定，客户端可替换
- 协议优先，UI 次之
- 模块边界清晰，允许演进

### 2.2 架构总览

- 后端：Go（REST API + WebSocket）
- 客户端：
  - Phase A：Web（React 19 + Ant Design + Vite）
  - Phase C：Kotlin Multiplatform（长期客户端）

---

## 3. 功能范围（Demo MVP）

### 3.1 用户与认证

- 注册/登录（账号 + 密码 + token）
- 用户资料（头像/封面/简介）
- 用户主页（Profile v1）：`/u/:id`
- 关注/粉丝（统计 + 列表接口）

### 3.2 社区与帖子

- 版块（Boards）
- 帖子（Posts）：富文本内容（TipTap），支持图片上传
- 评论（Comments）：富文本，支持楼中楼（parent_id）
- 点赞 / 点踩 / 分值（持久化）
- 分享与评论数展示

### 3.3 实时聊天

- 公共聊天室（WebSocket）
- 消息实时广播
- 最近消息拉取（history）

### 3.4 资料分享

- 帖子附件上传
- 文件下载
- 基础权限控制（需登录）

### 3.5 管理与反滥用

- 举报入口与管理员处理
- 发帖/评论限流

---

## 4. 数据模型（核心实体）

### 4.1 User

- id
- nickname
- avatar
- cover
- bio
- followers_count
- following_count
- created_at

### 4.2 Board

- id
- name
- description

### 4.3 Post

- id
- board_id
- author_id
- title
- content
- content_json（TipTap JSON）
- tags（string[]）
- attachments（文件 ID 列表，可选）
- created_at
- score
- comment_count
- my_vote

### 4.4 Comment

- id
- post_id
- parent_id
- author_id
- content
- content_json
- tags
- attachments
- created_at
- score
- my_vote

### 4.5 ChatMessage

- id
- room_id
- sender_id
- content
- created_at

### 4.6 File

- id
- uploader_id
- filename
- storage_key
- created_at

### 4.7 Report

- id
- target_type
- target_id
- reporter_id
- status
- action
- note
- created_at
- updated_at

---

## 5. 目录结构（Monorepo）

```
campus-hub/
  docs/
  server/
  apps/
    web/
    kmp/
```

---

## 6. 开发阶段规划

### Phase A：Web + Go Demo

- API / WS 协议初版冻结
- 功能闭环跑通
- 基础 UI 与交互完成（Ant Design）

### Phase B：工程加固

- OpenAPI 文档
- 协议测试
- 模块边界整理

### Phase C：Kotlin Multiplatform

- shared 模块复用网络与 domain
- Android 客户端优先

---

## 7. 项目状态

- 当前状态：Demo 开发阶段
- 架构状态：可演进
- 名称状态：campus-hub（暂定）
