# AGENTS.md · Material Vault

> 本文件是 Material Vault（素材证据库）项目的核心工程与开发规范。所有 AI Agent 与开发者在阅读、修改、测试及新增代码时必须严格遵守。

---

## 1. 产品定位与边界

**Material Vault 是专为视频创作者打造的：素材收件箱 + 网页与视频证据归档库 + 极速标签检索系统。**

### 核心链路
```text
发现灵感/素材/视频 → 两步内极速保存 (Ctrl+V，支持 #标签 自动提取) → 自动后台归档正文与高清封面 → 暂存 Inbox → 毫秒级 FTS5 搜索与标签筛选
```

### 明确不做 (Non-Goals)
- ❌ 视频剪辑与在线播放器增强
- ❌ 选题看板与长文块级编辑器（由外部专用工具负责）
- ❌ 复杂多租户 RBAC、协同评论与知识图谱
- ❌ 向量数据库 (Vector DB) / RAG / Heavy AI Agent

---

## 2. 技术栈与运行时规范

本项目为全栈单体工程，**全面采用 TypeScript + Bun 原生运行时**，坚持“**只要能用 Bun 原生能力就绝不引入外部依赖**”的极简高性能原则：

| 层级 | 技术选型 | 说明 |
| --- | --- | --- |
| **运行时与服务端** | `Bun >= 1.2` (`Bun.serve`) | 纯原生高性能 HTTP 路由、SPA 静态资源托管与毫秒级热重载 |
| **数据库** | `bun:sqlite` | 原生 C 绑定嵌入式 SQLite 数据库，位于 `./data/vault.db`，内存开销仅 ~15MB |
| **全文检索** | `SQLite FTS5` (unicode61 / subquery) | 毫秒级中文标题、备注、URL 及正文全文检索与触发器自动同步 |
| **资产与哈希去重** | `Bun.CryptoHasher("sha256")` + `Bun.file/write` | 原生零拷贝 SHA-256 物理资产去重存储 |
| **前端框架** | `React 18` + `TypeScript` + `Vite` | 单页应用，位于 `./src` |
| **数据请求** | `@tanstack/react-query` | 声明式数据获取与实时缓存管理 |
| **样式与组件** | `Tailwind CSS` + `Lucide Icons` | 遵循 Stone + Rose 温润编辑部设计规范 |

---

## 3. 项目目录结构

```text
MaterialVault/
├── server/                  # Bun 原生服务端源码
│   ├── index.ts             # 服务端主入口 (Bun.serve 路由分发与静态托管)
│   ├── db.ts                # 数据库核心 (bun:sqlite 初始化、表结构与 FTS5 触发器)
│   ├── utils.ts             # 响应包装、URL 清洗与标签提取
│   ├── routes/              # REST API 路由处理器 (items, tags, search, uploads, assets, stats)
│   └── services/            # 核心业务 (capture.ts, video.ts, storage.ts)
├── data/                    # 本地数据目录 (已 gitignore)
│   ├── vault.db             # SQLite 数据库与 FTS5 虚拟表
│   └── assets/              # SHA-256 二进制文件去重存储池
├── extension/               # 官方浏览器扩展 (Manifest V3，免编译开箱即用)
├── public/                  # 静态资源 (小熊猫 mascot logo.png, favicon.png)
├── src/                     # React 前端代码
│   ├── components/          # 业务组件 (QuickCapture, ItemCard, Modals, BatchBar)
│   │   └── ui/              # 原子 UI 组件 (MasonryGrid, MarkdownRenderer, Button, Badge, Modal...)
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
- 在输入框或正文任意位置输入 `#标签名`，前端实时高亮展示，后端保存时自动创建并关联标签。
- 耗时的网络请求、HTML 解析、Markdown 提取与视频封面下载**在后台异步执行**，绝不阻塞用户记录思路。

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

## 5. 常用开发与运维命令

```bash
# 1. 运行完整应用开发模式 (Bun 原生后端启动在 3000 端口，包含 API 与静态资源)
bun run dev

# 2. 运行前端独立热更新服务 (端口 5173，自动代理 /api 至 3000)
bun run dev:ui

# 3. 构建前端生产版本
bun run build

# 4. 启动生产服务
bun start
```

---

## 6. 代码修改与提交准则

1. **单次闭环必须 Git Commit**：本项目每次增加一个新功能、修复一个 bug、优化交互或完成阶段性改动后，在验证通过的前提下，**必须立即执行一次规范的 `git commit`**，保持提交历史细粒度清晰。
2. **采用最小修改原则**：优先进行精确局部替换，不无故重构或改写不相关文件。
3. **严格保持类型安全**：前后端统一使用 TypeScript。
4. **原生优先**：能用 Bun 内置能力（`bun:sqlite`, `Bun.serve`, `Bun.CryptoHasher`, `fetch`）解决的问题，严禁随意引入第三方 npm 运行时依赖。
