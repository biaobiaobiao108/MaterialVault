<div align="center">

<img src="./public/logo.png" alt="Material Vault Logo" width="128" height="128" style="border-radius: 28px;" />

# Material Vault · 素材证据库

**专为视频创作者打造的：素材收件箱 + 网页证据归档库 + 选题资料库**

[![Built with Bun](https://img.shields.io/badge/Bun-1.4.0+-black?logo=bun)](https://bun.sh)
[![React 18](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![SQLite FTS5](https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-rose.svg)](./LICENSE)

</div>

---

## 📖 产品介绍

**Material Vault** 解决创作者在收集素材时的核心痛点：

```text
发现灵感/证据 → 两步内极速保存 (Ctrl+V) → 自动后台归档正文与快照 → 暂存 Inbox → 毫秒级 FTS5 搜索 → 关联选题 → 导出 AI Context / 白板推演
```

### 核心特性

- ⚡ **零摩擦极速收集 (Capture Friction 最小化)**：
  - 复制链接直接 `Ctrl + V`，无需等待即刻返回；
  - 同一输入框支持自由记录灵感备忘（Note）、拖入本地文件或直接粘贴截图。
- 🛡️ **网页证据自动归档 (Archive Resilience)**：
  - 后台自动提取网页 Title、Meta、正文 Markdown 与原始 HTML 快照；
  - 遇到防爬/登录墙导致抓取失败时，**素材本体与笔记绝对不丢失**，提供显式的重新抓取入口。
- 🔍 **毫秒级 SQLite FTS5 全文索引**：
  - 零外部依赖，毫秒级检索半年前收集的所有标题、备注、URL 及完整网页正文；
  - 支持按类型、选题、标签、来源域名、状态、收藏及日期范围进行多维过滤。
- 🗂️ **选题资料库 & AI 上下文一键导出**：
  - 将分散素材快速挂载至具体视频选题；
  - 一键导出为结构化 Markdown Context 供投喂 ChatGPT/Claude 写稿，或导出为 Excalidraw 白板推演数据。
- 💾 **SHA-256 二进制物理去重**：
  - 本地上传的图片、文档存入存储池时以哈希命名，重复素材自动复用同一物理资产。
- 🎨 **温润编辑部 UI 体系**：
  - Stone 纸张灰阶搭配 Rose 主强调色，全自动监听并实时自适应系统深浅色昼夜模式。

---

## 🛠️ 技术架构

全流程基于 **纯原生 Bun 单体全栈工程** 构建：

| 领域 | 技术栈 |
| --- | --- |
| **运行时与服务端** | `Bun >= 1.4.0` (原生 `Bun.serve`) |
| **数据库** | `bun:sqlite` + `Drizzle ORM` (`./data/vault.db`) |
| **全文检索** | `SQLite FTS5` (unicode61 + 实时触发器同步) |
| **前端框架** | `React 18` + `TypeScript` + `Vite` |
| **状态管理** | `@tanstack/react-query` |
| **样式与图标** | `Tailwind CSS` + `Lucide Icons` |

---

## 🚀 快速开始

### 1. 安装依赖

确保本地已安装 [Bun](https://bun.sh)：

```bash
bun install
```

### 2. 启动应用

运行完整应用（包含 Hono 后端 API 与前端静态托管，端口 `3000`）：

```bash
bun run start
```

浏览器访问：`http://localhost:3000`

### 3. 前端独立开发模式（支持热更新）

```bash
# 启动 Vite 前端热更服务 (端口 5173，自动代理 /api 至 3000)
bun run dev:ui
```

### 4. 生产打包

```bash
bun run build
```

---

## 📂 项目结构

```text
MaterialVault/
├── data/                    # 本地数据目录 (已 gitignore)
│   ├── vault.db             # SQLite 数据库与 FTS5 虚拟表
│   └── assets/              # SHA-256 二进制文件去重存储池
├── public/                  # 静态资源 (小熊猫 mascot logo.png, favicon.png)
├── server/                  # Bun + Hono 后端代码
│   ├── index.ts             # 服务端入口 (挂载 API 与前端 SPA 静态托管)
│   ├── db/                  # 数据层 (schema.ts, db.ts, seed.ts)
│   ├── routes/              # 路由 (items, topics, tags, search, assets, uploads, stats)
│   └── services/            # 核心业务 (capture.ts, storage.ts, search.ts)
├── src/                     # React 前端代码
│   ├── components/          # 业务组件 (QuickCapture, ItemCard, Modals, BatchBar)
│   │   └── ui/              # 原子 UI 组件 (Button, Badge, Modal, ConfirmDialog, DateInput)
│   ├── pages/               # 页面 (Inbox, Items, Topics, TopicDetail, Search, Settings)
│   ├── lib/                 # 工具库 (api.ts, theme.tsx, types.ts, utils.ts)
│   ├── App.tsx              # 路由配置
│   └── index.css            # 基础样式与 Light/Dark 设计令牌
├── package.json
└── tsconfig.json
```

---

## 📜 开源协议

本项目采用 [MIT](./LICENSE) 协议开源。
