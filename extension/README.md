# Material Vault 官方浏览器扩展程序

**专为视频创作者打造的极速网页证据、选中文本与图片采集扩展 (Chrome / Edge / Chromium Manifest V3)**

---

## 🚀 安装与加载方式

本扩展程序为**纯原生架构，零编译步骤**，直接在浏览器中加载即可：

1. **打开浏览器扩展管理页**：
   - Chrome: 在地址栏输入 `chrome://extensions`
   - Edge: 在地址栏输入 `edge://extensions`
2. **开启右上角「开发者模式」** (Developer Mode)。
3. **点击「加载已解压的扩展程序」** (Load unpacked)。
4. **选择本项目中的 `extension` 文件夹** (`D:\MyBuild\MaterialVault\extension`)。
5. 安装完成！点击浏览器右上角的扩展拼图图标，将 **Material Vault** 固定在工具栏即可。

---

## 🎯 核心功能与使用方法

### 1. 快捷弹窗采集 (Popup)
- 在任意网页上点击工具栏的 Material Vault 图标（或按 `Alt + S`）；
- 扩展会自动提取当前网页的标题和 URL；
- 可自由编辑标题、追加创作备注，或输入/勾选 `#标签`；
- 按 `Ctrl + Enter` 或点击「保存到 Inbox」即可完成保存。

### 2. 右键快捷菜单 (Context Menus)
- **保存网页**：在页面空白处右键 → `保存当前网页到 Material Vault`
- **保存文本**：选中网页中的任意文字 → 右键 → `保存选中文本为备忘素材`
- **保存图片**：在网页图片上右键 → `保存图片到 Material Vault`

### 3. 全局快捷键
- `Alt + S`（Mac 上为 `Option + S`）：一键极速保存当前激活的标签页。

### 4. 服务地址配置
- 点击弹窗右上角的 ⚙️ 齿轮图标，即可修改 Vault 服务的通信地址（默认：`http://localhost:3000`）。
- 弹窗顶部包含实时健康指示灯（🟢 在线 / 🔴 离线），直观展示与本地服务的连通状态。
