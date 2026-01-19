# Rich Editor 方案说明

## 选型与架构
- 核心引擎：TipTap (ProseMirror)
- UI 组件：Ant Design
- 存储格式：`content_json`（JSON）+ `content`（纯文本）

## 功能特性
- 基础格式（加粗/斜体/引用/列表/代码块）
- 内联图片上传与预览
- 评论区与帖子区渲染分离

## 图片上传流程
1. 拖拽/粘贴或点击按钮选择文件
2. 插入临时节点显示上传状态
3. 调用 `POST /api/uploads/images`
4. 成功后替换 URL

## 草稿机制
- 帖子草稿：`draft:post`
- 评论草稿：`draft:comment:{postId}`
