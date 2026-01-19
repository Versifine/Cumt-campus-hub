# docs/ws-protocol.md — campus-hub WebSocket 协议（v0.2）

## 连接方式

`/ws/chat?token={AUTH_TOKEN}`

## 信封格式

```json
{
  "v": 1,
  "type": "event.type",
  "requestId": "uuid",
  "data": {},
  "error": null
}
```

## 事件类型

- `system.connected` 连接成功
- `chat.join` 加入房间
- `chat.joined` 加入成功
- `chat.send` 发送消息
- `chat.message` 接收消息
- `chat.history` 拉取历史
- `chat.history.result` 历史结果
- `system.ping` / `system.pong`
- `error` 错误事件
