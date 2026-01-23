# docs/api.md — campus-hub REST API 设计（v0.4）

> 本文档对齐当前 Demo 实现的 REST API。

## 1. 设计原则

- 所有 API 以 `/api/v1` 为前缀（少数静态/下载类接口例外）
- 使用 JSON 作为数据交换格式（文件上传使用 `multipart/form-data`）
- JSON 字段使用 `snake_case`
- 认证方式：Bearer Token
- 错误响应统一为 `{ "code": 2001, "message": "invalid json" }`

### 3.4 重发验证邮件

`POST /api/v1/auth/resend-verification`

请求：
```json
{ "account": "string" }
```

响应：
```json
{ "message": "verification email sent" }
```

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
{
  "account": "string",
  "password": "string",
  "confirm_password": "string",
  "nickname": "string"
}
```

说明：`account` 必须是邮箱地址；注册后会发送验证邮件。

响应：
```json
{
  "message": "verification email sent"
}
```

说明：验证通过后才可登录获取 token。

### 3.2 邮箱验证

`GET /api/v1/auth/verify-email?token=...`

响应：
```json
{ "message": "email verified" }
```

### 3.3 登录

`POST /api/v1/auth/login`

请求：
```json
{ "account": "string", "password": "string" }
```

响应：
```json
{
  "token": "t_xxx",
  "user": {
    "id": "u_123",
    "nickname": "alice",
    "avatar": "",
    "level": 1,
    "level_title": "萌新"
  }
}
```

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
  "exp": 12,
  "level": 1,
  "level_title": "萌新",
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

### 4.3 注销当前用户

`DELETE /api/v1/users/me`

响应：
```json
{ "message": "account deactivated" }
```

### 4.4 获取公开资料

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
  "exp": 120,
  "level": 2,
  "level_title": "进阶",
  "posts_count": 3,
  "comments_count": 8,
  "followers_count": 5,
  "following_count": 7,
  "is_following": false
}
```

### 4.5 关注/取消关注

- `POST /api/v1/users/{id}/follow`
- `DELETE /api/v1/users/{id}/follow`

### 4.6 关注列表

`GET /api/v1/users/{id}/following`

响应：
```json
{
  "items": [
    {
      "id": "u_2",
      "nickname": "bob",
      "avatar": "",
      "bio": "",
      "created_at": "2025-01-01T00:00:00Z",
      "level": 1,
      "level_title": "萌新"
    }
  ],
  "total": 1
}
```

### 4.7 粉丝列表

`GET /api/v1/users/{id}/followers`

响应：同上

### 4.8 用户评论列表

`GET /api/v1/users/{id}/comments`

响应：
```json
{
  "items": [
    {
      "id": "c_1",
      "post_id": "p_1",
      "parent_id": "",
      "author_id": "u_1",
      "content": "text",
      "content_json": {},
      "created_at": "2025-01-01T00:00:00Z",
      "floor": 3,
      "post_title": "期末复习资料求分享",
      "board_id": "b_1",
      "board_name": "综合",
      "is_reply": false
    }
  ],
  "total": 1
}
```

---

## 5. 版块 Board

`GET /api/v1/boards`

---

## 6. 帖子 Post

### 6.1 列表

`GET /api/v1/posts`

Query:

- `board_id` 可选
- `author_id` 可选
- `sort=latest|hot`（默认 `latest`）

响应（items 示例）：
```json
{
  "id": "p_1",
  "title": "矿大哪个食堂最好吃？",
  "author": {
    "id": "u_1",
    "nickname": "alice",
    "avatar": "",
    "level": 2,
    "level_title": "进阶"
  },
  "created_at": "2025-01-01T00:00:00Z",
  "score": 12,
  "comment_count": 4,
  "my_vote": 1
}
```

### 6.2 详情

`GET /api/v1/posts/{post_id}`

说明：每次获取详情会触发浏览量 +1（异步）。

响应重点字段：

- `view_count`: 浏览量

### 6.3 创建/删除/投票

- `POST /api/v1/posts`
- `DELETE /api/v1/posts/{post_id}`
- `POST /api/v1/posts/{post_id}/votes`
- `DELETE /api/v1/posts/{post_id}/votes`

---

## 7. 评论 Comment

### 7.1 列表

`GET /api/v1/posts/{post_id}/comments`

说明：仅顶层评论有 `floor`（回复为 0）。

### 7.2 创建/删除/投票

- `POST /api/v1/posts/{post_id}/comments`（响应含 `floor`）
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
