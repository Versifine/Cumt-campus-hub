# Frontend Migration Log

## Completed Tasks
- [x] **Setup**: Installed Ant Design and configured `ConfigProvider`.
- [x] **Layout**:
  - Refactored `SiteHeader` with Antd Layout, Menu, Avatar.
  - Updated `Home.tsx` to use Antd Layout, Grid, and Card.
  - Cleaned up `index.css` removing thousands of lines of custom CSS.
- [x] **Components**:
  - `PostCard.tsx`: Migrated to Antd Card, Actions, Avatar.
  - `SectionCard.tsx`: Wrapper around Antd Card.
  - `BoardList.tsx`: Migrated to Antd List.
  - `Skeletons.tsx`: Migrated to Antd Skeleton.
  - `StateBlocks.tsx`: Migrated to Antd Result.
  - `RequireAuth.tsx`: Added Antd Spin.
  - `RichEditor`: Refactored toolbar to use Antd Button/Tooltip.
- [x] **Pages**:
  - `Login.tsx`: Complete rewrite with Antd Form, Tabs, Alert.
  - `Submit.tsx`: Complete rewrite with Antd Form, Select, Upload integration.
  - `PostPlaceholder.tsx`: Migrated detail view, comments list, reply form.
  - `UserProfile.tsx`: Migrated to Antd Descriptions, Tabs, Statistic.
  - `Chat.tsx`: Migrated to Antd Layout, List, Input.
  - `Resources.tsx`: Migrated to Antd Upload (Dragger), List.
- [x] **Cleanup**:
  - Deleted unused components: `InlineAvatar`, `MediaViewer`, `TagInput`, `CommentMediaBlock`, `AdaptiveImage`.
  - Deleted unused `profile/` folder.

## Next Steps
- [ ] Manual verification of all flows (Login, Post, Chat, etc.).
- [ ] Fine-tuning theme tokens if necessary.
