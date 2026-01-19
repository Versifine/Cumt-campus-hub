# docs/api.md — campus-hub REST API 设计（v0.3）

> 本文档对齐当前 Demo 实现的 REST API。

## 1. 设计原则

- 所有 API 以 `/api/v1` 为前缀（少数静态/下载类接口例外）
- 使用 JSON 作为数据交换格式（文件上传使用 `multipart/form-data`）
- JSON 字段使用 `snake_case`
- 认证方式：Bearer Token
- 错误响应统一为 `{ "code": 2001, "message": "invalid json" }`

---

## 2. Health

### 2.1 健康检查

`GET /healthz`

响应：`{ "status": "ok" }`

---

## 3. Auth

### 3.1 注册

`POST /api/v1/auth/register`

请求：
```json
{ "account": "string", "password": "string" }
```

响应：
```json
{ "token": "t_xxx", "user": { "id": "u_123", "nickname": "alice", "avatar": "" } }
```

说明：服务重启后 token 会失效。

### 3.2 登录

`POST /api/v1/auth/login`

请求：同注册

响应：同注册

---

## 4. 用户 User

### 4.1 获取当前用户

`GET /api/v1/users/me`

响应：
```json
{
  "id": "u_123",
  "nickname": "alice",
  "avatar": "",
  "cover": "",
  "bio": "",
  "created_at": "2025-01-01T00:00:00Z",
  "posts_count": 3,
  "comments_count": 8,
  "followers_count": 5,
  "following_count": 7
}
```

### 4.2 更新当前用户

`PATCH /api/v1/users/me`

请求：
```json
{ "nickname": "alice", "bio": "", "avatar": "", "cover": "" }
```

### 4.3 获取公开资料

`GET /api/v1/users/{id}`

响应：
```json
{
  "id": "u_123",
  "nickname": "alice",
  "avatar": "",
  "cover": "",
  "bio": "",
  "created_at": "2025-01-01T00:00:00Z",
  "posts_count": 3,
  "comments_count": 8,
  "followers_count": 5,
  "following_count": 7,
  "is_following": false
}
```

### 4.4 关注/取消关注

- `POST /api/v1/users/{id}/follow`
- `DELETE /api/v1/users/{id}/follow`

### 4.5 关注列表

`GET /api/v1/users/{id}/following`

响应：
```json
{ "items": [{ "id": "u_2", "nickname": "bob", "avatar": "", "bio": "", "created_at": "2025-01-01T00:00:00Z" }], "total": 1 }
```

### 4.6 粉丝列表

`GET /api/v1/users/{id}/followers`

响应：同上

### 4.7 用户评论列表

`GET /api/v1/users/{id}/comments`

响应：
```json
{ "items": [{ "id": "c_1", "post_id": "p_1", "parent_id": "", "author_id": "u_1", "content": "text", "content_json": {}, "created_at": "2025-01-01T00:00:00Z" }], "total": 1 }
```

---

## 5. 版块 Board

`GET /api/v1/boards`

---

## 6. 帖子 Post

- `GET /api/v1/posts`
- `GET /api/v1/posts/{post_id}`
- `POST /api/v1/posts`
- `DELETE /api/v1/posts/{post_id}`
- `POST /api/v1/posts/{post_id}/votes`
- `DELETE /api/v1/posts/{post_id}/votes`

---

## 7. 评论 Comment

- `GET /api/v1/posts/{post_id}/comments`
- `POST /api/v1/posts/{post_id}/comments`
- `DELETE /api/v1/posts/{post_id}/comments/{comment_id}`
- `POST /api/v1/posts/{post_id}/comments/{comment_id}/votes`
- `DELETE /api/v1/posts/{post_id}/comments/{comment_id}/votes`

---

## 8. 文件 File

- `POST /api/v1/files`
- `GET /files/{file_id}`
- `POST /api/uploads/images`

---

## 9. 举报 Report

- `POST /api/v1/reports`
- `GET /api/v1/admin/reports`
- `PATCH /api/v1/admin/reports/{report_id}`

---

## 10. 聊天 WS

详见 `docs/ws-protocol.md`
