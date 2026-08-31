# AGENTS.md · Material Vault

> 本文件是 Material Vault（素材证据库）项目的核心工程与开发规范。所有 AI Agent 与开发者在阅读、修改、测试及新增代码时必须严格遵守。

---

## 1. 产品定位与边界

**Material Vault 是专为视频创作者打造的：素材收件箱 + 网页证据归档库 + 极速标签检索系统。**

### 核心链路
```text
发现灵感/素材 → 两步内极速保存 (Ctrl+V，支持 #标签 自动提取) → 自动后台归档正文与快照 → 暂存 Inbox → 毫秒级 FTS5 搜索与标签筛选
```

### 明确不做 (Non-Goals)
- ❌ 视频剪辑与在线播放器增强
- ❌ 选题看板与长文块级编辑器（由外部专用工具负责）
- ❌ 复杂多租户 RBAC、协同评论与知识图谱
- ❌ 向量数据库 (Vector DB) / RAG / Heavy AI Agent

---

## 2. 技术栈与运行时规范

本项目为全栈单体工程，**全流程强依赖 Bun**：

| 层级 | 技术选型 | 说明 |
| --- | --- | --- |
| **运行时与服务端** | `Bun >= 1.4.0` (原生 `Bun.serve`) | 包管理、纯原生 HTTP 服务与静态文件托管 |
| **数据库** | `bun:sqlite` + `Drizzle ORM` | 嵌入式 SQLite 数据库，位于 `./data/vault.db` |
| **全文检索** | `SQLite FTS5` (unicode61 / subquery) | 毫秒级中文标题、备注、URL 及正文全文检索 |
| **前端框架** | `React 18` + `TypeScript` + `Vite` | 单页应用，位于 `./src` |
| **数据请求** | `@tanstack/react-query` | 声明式数据获取与实时缓存管理 |
| **样式与组件** | `Tailwind CSS` + `Lucide Icons` | 遵循 Stone + Rose 温润编辑部设计规范 |

---

## 3. 项目目录结构

```text
MaterialVault/
├── data/                    # 本地数据目录 (已 gitignore)
│   ├── vault.db             # SQLite 数据库与 FTS5 虚拟表
│   └── assets/              # SHA-256 二进制文件去重存储池
├── extension/               # 官方浏览器扩展 (Manifest V3，免编译开箱即用)
├── public/                  # 静态资源 (小熊猫 mascot logo.png, favicon.png)
├── server/                  # 纯原生 Bun 后端代码 (零外部 Web 框架依赖)
│   ├── index.ts             # 服务端入口 (Bun.serve 原生 API 路由与静态托管)
│   ├── db/                  # 数据层 (schema.ts, db.ts, seed.ts)
│   ├── routes/              # 原生路由分发 (items, tags, search, assets, uploads, stats)
│   └── services/            # 核心业务 (capture.ts, storage.ts, search.ts)
├── src/                     # React 前端代码
│   ├── components/          # 业务组件 (QuickCapture, ItemCard, Modals, BatchBar)
│   │   └── ui/              # 原子 UI 组件 (Button, Badge, Modal, ConfirmDialog, CustomSelect, DateInput)
│   ├── pages/               # 页面 (Inbox, Items, Search, Settings)
│   ├── lib/                 # 工具库 (api.ts, theme.tsx, types.ts, utils.ts)
│   ├── App.tsx              # 路由配置
│   └── index.css            # 基础样式与 Light/Dark 设计令牌
├── package.json
└── tsconfig.json
```

---

## 4. 核心业务设计原则

### 4.1 Capture Friction 最小化 & `#标签` 自动提取
- 用户粘贴 URL、文字或拖入文件后，立即返回 202 并提示保存成功。
- 在输入框或正文任意位置输入 `#标签名`（如 `#格斗 #AI工具`），前端实时高亮展示，后端保存时自动创建并关联标签。
- 耗时的网络请求、HTML 解析、Markdown 提取与网页截图**必须在后台异步执行**，绝不阻塞用户记录思路。

### 4.2 归档失败 ≠ 保存失败 (Archive Resilience)
- 遇到社交平台登录墙或防爬虫导致抓取失败时，**素材记录本体、用户笔记与标签绝对不能丢失**。
- 将 `processingStatus` 标记为 `failed` 并记录流水日志，界面提供显式的 `[重新抓取]` 入口。

### 4.3 二进制文件 SHA-256 去重
- 所有上传的图片、PDF、附件存入 `./data/assets/` 时，必须以文件内容的 `SHA-256` 散列命名。
- 相同文件重复上传时自动复用同一物理资产，不同 Item 仅在数据库中引用同一 `Asset`。

### 4.4 状态严格解耦
- `organizationStatus`: `inbox`（待整理）/ `organized`（已整理）/ `archived`（已归档）
- `processingStatus`: `pending` / `processing` / `ready` / `failed`
- 两者独立维护，不得相互覆盖。

---

## 5. UI 与前端规范

- **品牌与气质**：以“小熊猫收件箱”为项目 Mascot 图标，保持“温润编辑部”风格。
- **深浅色自适应**：
  - 默认使用 `preference: 'system'`，实时监听系统深浅色切换；
  - 浅色：Stone 灰阶画布（`#fafaf9`）、纯白表面（`#ffffff`）、Rose 主强调色（`#e11d48`）；
  - 深色：深邃暗调（`#0c0a09`）、卡片表面（`#171513`）、高对比清晰边框（`#292524`）。
- **页面标题区**：保持紧凑利落，标题下方**不得随意添加冗余副标题说明**。
- **弹窗与交互规范**：
  - 严格禁止使用浏览器原生 `window.alert`、`window.confirm`、`window.prompt`；
  - 弹窗统一使用基于 Portal 挂载的 `Modal` / `ConfirmDialog`；
  - **下拉菜单必须统一使用项目专用的 `CustomSelect` 组件**（基于 Portal 挂载浮层，支持搜索过滤与键盘无障碍交互），**严格禁止使用浏览器原生 `<select>` 标签**；
  - 即时反馈统一使用 `useToast()`。
- **排版与现代 CSS**：
  - 标题启用 `text-wrap: balance`，长文本启用 `text-wrap: pretty`；
  - 数量、时间、尺寸等数值统一使用 `tabular-nums font-mono`。

---

## 6. 常用开发与运维命令

```bash
# 1. 安装依赖
bun install

# 2. 运行完整应用 (后端 API + 静态 SPA，端口 3000)
bun run start
# 或开发模式:
bun run dev

# 3. 运行前端独立热更新服务 (端口 5173，自动代理 /api 至 3000)
bun run dev:ui

# 4. 前端生产打包 (输出至 dist/)
bun run build

# 5. 重置/重播演示种子数据
bun run server/db/seed.ts
```

---

## 7. 代码修改与提交准则

1. **单次闭环必须 Git Commit**：本项目每次增加一个新功能、修复一个 bug、优化交互或完成阶段性改动后，在验证通过的前提下，**必须立即执行一次规范的 `git commit`**，保持提交历史细粒度清晰。
2. **采用最小修改原则**：优先进行精确局部替换，不无故重构或改写不相关文件。
3. **严格保持 TypeScript 类型安全**：新增接口或模型时同步更新 `server/db/schema.ts` 与 `src/lib/types.ts`。
4. **改动验证**：修改前端代码后运行 `bun run build` 确保构建无错；修改后端接口后使用 `bun -e` 快速发起验证请求。
