<div align="center">

<img src="./public/logo.png" alt="Material Vault Logo" width="128" height="128" style="border-radius: 28px;" />

# Material Vault · 素材证据库

**专为视频创作者打造的：素材收件箱 + 网页证据归档库 + 极速标签检索系统**

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
发现灵感/证据 → 两步内极速保存 (Ctrl+V，支持 #标签 自动归类) → 自动后台归档正文与快照 → 暂存 Inbox → 毫秒级 FTS5 搜索与标签过滤
```

### 核心特性

- ⚡ **零摩擦极速收集 (Capture Friction 最小化)**：
  - 复制链接直接 `Ctrl + V`（支持页面任意处全局粘贴捕获），无需等待即刻返回；
  - 同一输入框支持自由记录灵感备忘（Note）、拖入本地文件或直接粘贴截图。
- 🏷️ **输入框 `#字符` 自动生成与解析标签**：
  - 在输入框或备忘内容中输入 `#标签名`（如 `#格斗 #AI工具 #视频分镜`），前端即时识别高亮展示；
  - 保存时自动在数据库中创建不存在的标签并与素材双向关联；
  - 卡片标签支持一键点击直达检索（Tag Pivoting），收件箱与素材库内置常用标签快捷筛选栏。
- ⚡ **原生 Bun 极速性能与 0 外部依赖**：
  - 采用 `Bun.CryptoHasher` 极速 SHA-256 散列，配合 `Bun.file` / `Bun.write` 零拷贝 I/O；
  - 支持全局 `Ctrl + K` / `/` 快速激活全文检索与全库一键 JSON 备份导出。
- 🛡️ **网页证据自动归档 (Archive Resilience)**：
  - 后台自动提取网页 Title、Meta、正文 Markdown 与原始 HTML 快照；
  - 遇到防爬/登录墙导致抓取失败时，**素材本体与笔记绝对不丢失**，提供显式的重新抓取入口。
- 🔍 **毫秒级 SQLite FTS5 全文索引**：
  - 零外部依赖，毫秒级检索半年前收集的所有标题、备注、URL 及完整网页正文；
  - 支持按类型、标签、来源域名、状态、收藏及日期范围进行多维过滤。
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

运行完整应用（包含原生 Bun 后端 API 与前端静态托管，端口 `3000`）：

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

## 🧩 官方浏览器插件 (Chrome / Edge 扩展)

项目内置官方浏览器扩展程序（位于 `./extension` 目录，Manifest V3 规范，零编译步骤）：

1. 打开 Chrome/Edge 的扩展管理页（`chrome://extensions` 或 `edge://extensions`）；
2. 开启右上角 **「开发者模式」**；
3. 点击 **「加载已解压的扩展程序」**，选择本项目中的 `extension` 目录即可！
4. **功能特性**：
   - 快捷弹窗（Popup）：自动提取当前标题与 URL，支持输入 `#标签`、笔记与 `Ctrl + Enter` 保存；
   - 右键菜单：一键保存网页、选中文本或图片；
   - 快捷键：`Alt + S` 一键保存当前标签页。

---

## 📂 项目结构

```text
MaterialVault/
├── data/                    # 本地数据目录 (已 gitignore)
│   ├── vault.db             # SQLite 数据库与 FTS5 虚拟表
│   └── assets/              # SHA-256 二进制文件去重存储池
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

## 📜 开源协议

本项目采用 [MIT](./LICENSE) 协议开源。
