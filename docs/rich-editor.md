# Rich Editor 方案说明

## 1. 选型与架构

- **核心引擎**：TipTap (基于 ProseMirror)
- **UI 组件**：Ant Design (Button, Tooltip, Input, Spin, Image)
- **存储格式**：
  - `content_json` (JSON): 用于富文本渲染。
  - `content` (String): 纯文本备份，用于搜索和摘要。

## 2. 功能特性

- **基础格式**：加粗、斜体、删除线。
- **段落样式**：标题 (H2, H3)、引用、无序/有序列表、代码块。
- **多媒体**：
  - **内联图片**：支持拖拽、粘贴、点击按钮上传。
  - **上传状态**：显示上传进度遮罩 (`<Spin>`)，失败支持重试/移除。
  - **图片说明**：支持添加图片 Caption。
- **只读渲染**：`RichContent` 组件用于展示，支持图片点击预览 (`<Image.PreviewGroup>`)。

## 3. 图片上传流程

1.  **触发**：用户拖拽/粘贴图片，或点击工具栏图片按钮选择文件。
2.  **占位**：编辑器插入临时节点，显示 loading 状态。
3.  **上传**：调用 `POST /api/uploads/images`。
4.  **成功**：更新节点 `src` 为远程 URL。
5.  **失败**：节点显示错误状态，提供重试/移除按钮。

## 4. 组件说明

### `RichEditor`
核心编辑器组件，封装了 TipTap 实例和工具栏。
- **Props**: `value`, `onChange`, `onImageUpload`, `disabled`, `placeholder`.
- **Toolbar**: 使用 Antd 组件重写，风格统一。

### `RichContent`
用于展示富文本内容的只读组件。
- **Props**: `contentJson`, `contentText`.
- **特性**: 自动集成 Antd 的图片预览功能。

## 5. 草稿机制

- 基于 `localStorage` 的自动保存。
- 帖子草稿 key: `draft:post`。
- 评论草稿 key: `draft:comment:{postId}`。
- 策略：输入停止 1s 后自动保存，发布成功后清除。
