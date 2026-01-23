# docs/decision-log.md — campus-hub 工程决策记录

## DL-001 项目定位与目标

- 状态：Accepted
- 日期：2025-12
- 决策：定位为校园社区 Demo（论坛 / 聊天 / 资料分享）。

## DL-002 技术路线

- 状态：Accepted
- 日期：2025-12
- 决策：Phase A Web + Go，Phase C KMP。

## DL-003 前端技术栈

- 状态：Accepted
- 日期：2026-01
- 决策：React 19 + TypeScript + Vite + Ant Design。

## DL-004 用户主页与社交关系

- 状态：Accepted
- 日期：2026-01
- 决策：Profile v1 支持头像/封面/简介 + 关注/粉丝统计与列表接口。

## DL-005 举报与管理员处理

- 状态：Accepted
- 日期：2026-01
- 决策：举报入口 + 管理员列表 + 管理员处理接口。

## DL-006 数据库向后兼容迁移

- 状态：Accepted
- 日期：2026-01
- 决策：SQLite 迁移使用 ALTER TABLE ADD COLUMN + 错误忽略。

## DL-007 用户等级与经验

- 状态：Accepted
- 日期：2026-01
- 决策：引入轻量 exp/level（实时计算称号），不做积分商城。

## DL-008 帖子热度与浏览量

- 状态：Accepted
- 日期：2026-01
- 决策：热门排序使用时间衰减 + 投票/评论权重，详情页浏览量计数。

## DL-009 生产日志

- 状态：Accepted
- 日期：2026-01
- 决策：Gin 日志按天写入文件，并统一错误输出。
