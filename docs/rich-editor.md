# Rich Editor 方案说明

## 1. 选型与存储格式

- 编辑器：TipTap（ProseMirror）
  - React 生态成熟、可扩展插件多、结构化 JSON 易于迁移与后续富文本演进
- 存储格式：`content_json`（TipTap JSON）
  - 同时保留 `content` 纯文本作为摘要/搜索/列表预览
- 标签：`tags: string[]`
- 附件：保留 `attachments` 以兼容历史数据（富文本内联图片为主）

## 2. 内联图片上传流程

1) 用户拖拽/粘贴/选择图片
2) 编辑器插入本地 blob 预览节点（uploading 状态）
3) 调用 `POST /api/uploads/images` 上传
4) 上传成功：替换节点 `src` 为返回的 `url`（附带 `width/height`）
5) 上传失败：节点标记 error，提供“重试/移除”

## 3. 前端组件说明

### RichEditor
- props:
  - `value: { json: JSONContent | null; text: string }`
  - `onChange(value)`
  - `onImageUpload(file)`
  - `placeholder`, `disabled`
- 行为：支持加粗/斜体/删除线/标题/引用/列表/代码/链接/图片

### RichContent
- props:
  - `contentJson?: unknown`
  - `contentText?: string`
- 行为：优先渲染 `content_json`，否则回退 `content` 纯文本

### TagInput
- props:
  - `value: string[]`
  - `onChange(tags)`
  - `maxTags`, `placeholder`

### Media 相关
- `CommentMediaBlock`：评论/帖子媒体拼贴
- `MediaViewer`：弹层查看器（键盘/触控/放大）

## 4. 草稿策略

- 帖子草稿：`localStorage` key `draft:post`
- 评论草稿：`localStorage` key `draft:comment:{postId}`
- 输入变更后 1.2s 防抖自动保存；发布成功后清理草稿

## 5. 开发与测试指南

- 启动后端：`go run ./server`
- 启动前端：`npm run dev`
- 上传/渲染检查：
  - 拖拽/粘贴图片到编辑区
  - 失败后点击重试
  - 发布后查看帖子/评论渲染

### 移动端测试

- 本地启动：`npm run dev -- --host`
- 手机与电脑在同一 Wi-Fi 下访问 `http://<电脑IP>:5173`
- 如遇访问失败：检查防火墙、代理、CORS 设置
