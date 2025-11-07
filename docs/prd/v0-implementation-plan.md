# v0 Implementation Plan

> 文档同步日期：2025-11-06

本计划对应 `docs/prd/v0.md` 的需求，实现宿主桥接、全局 API 暴露、功能开关与构建产物等任务。进度将在执行过程中持续更新。

## 任务分解与进度

| 步骤 | 内容 | 负责人 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | 抽象 Vue 应用启动工厂，更新 `apps/web/src/main.ts` | Codex | ☑ 已完成 | 新增 `apps/web/src/bootstrap/editorApp.ts` 并改造入口 |
| 2 | 功能开关支持（Pinia/组件） | Codex | ☑ 已完成 | 新增 `useIntegrationStore` 与多组件开关 |
| 3 | `packages/shared/integration/host-bridge.ts` 宿主桥实现 | Codex | ☑ 已完成 | 包含 create/render/configure |
| 4 | 新增 host 构建入口（`apps/web/src/host/entry.ts` 等） | Codex | ☑ 已完成 | host 入口与样式聚合 |
| 5 | 调整构建流程输出 host bundle/manifest | Codex | ☑ 已完成 | 新增 `vite.host.config.ts` & 脚本 |
| 6 | 完成集成文档（`docs/integration/README.md`） | Codex | ☑ 已完成 | |
| 7 | 验证流程（脚本或记录） | Codex | ☑ 已完成 | 2025-11-07 执行 `npx pnpm --filter @md/web type-check`、`build:only`、`build:host`，生成 `dist/host/manifest-host.json` |

## 关键注意事项

- 保持默认 Web 应用行为不变，仅抽象启动流程。
- `window.AYQYMD` 接口需满足 PRD 描述，并考虑多实例销毁、只读、功能开关。
- 构建产物需输出 JS/CSS/manifest，命名稳定。
- 文档需涵盖构建命令、产物清单、API 说明与 Next.js 集成示例。

## 后续更新记录

- 2025-11-06：创建实施计划初稿。
