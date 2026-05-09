# Midea AI Lab · 项目状态备忘（2026-05）

## 半自动周更（已落地）
- `.github/workflows/weekly-draft.yml` — 每周日 22:00 (Asia/Shanghai) 触发
- `scripts/weekly-draft.mjs` — Tavily + DeepSeek 生成 weekly 草稿，写回 data.js
- `scripts/send-draft-email.mjs` — Resend 发草稿邮件（带 PR 链接）
- 需要 4 个 GitHub Secrets：TAVILY_API_KEY · DEEPSEEK_API_KEY · RESEND_API_KEY · NOTIFY_EMAIL
- 详见 DEPLOYMENT.md 第 3.6 部分



> 每次回来先读这份文件，再继续做。

## 站点结构
- 前台主页：`ui_kits/claude_marketing/index.html`
- 后台：`admin/index.html` + `admin/admin.js` + `admin/admin.css`
- 数据：`ui_kits/claude_marketing/data.js`（保存到 GitHub 时同时写入 `ui_kits/claude_app/data.js`）
- 三大板块：① AI 技术发展史时间树 · ② 每周 AI 大事件 · ③ 跨境电商思考

## 设计语言（不可改）
- 珊瑚 `#CC785C` / 墨 `#3D3729` / 米白 `#FAF9F5` / 边框 `#D4CFBE`
- 字体 sans（界面）+ Noto Serif SC（标题/事实）+ Source Code Pro（mono 大写标签）
- 极简、克制、Stratechery / Anthropic Claude 美学

## 三个 API 接入（用户已配在后台 localStorage）
1. **GitHub fine-grained PAT** —— 写入 repo
2. **DeepSeek** —— 整理新闻 + 生成 SVG 配图（设置页有 v4-pro 选项）
3. **Tavily** —— 联网搜索本周 AI 新闻

## 当前已完成
- 时间树（双根植物形态）+ 12 节点详情面板（含「打个比方/技术原理/动态演示」）
- 每周大事件：Tavily 自动搜 → DeepSeek 整理 5 条卡片 → **自动按风格提示词为每条生成 SVG 配图**
- 配图风格提示词：`admin/svg-style-prompt.md`
- 前台 `pickIllus` 优先级：`ev.svg` (AI 生成) > `ev.glyph` (手选) > `ev.kind` (兜底)
- 后台事件卡片新增「AI 配图」区：预览 + 重新生成 / 清除按钮
- Vercel 根目录 `index.html` 已重定向到主页

## 待办（用户回来时优先处理）
1. **测试新流程**：进后台跑一次「🌐 AI 自动搜索本周」，看 5 张 AI 配图质量
2. **部署**：本次改了 `admin/admin.js` + `ui_kits/claude_marketing/index.html`，需重新推 GitHub 才能在线上生效（保存按钮只覆盖 data.js）
3. **DeepSeek 模型名验证**：测试 `deepseek-v4-pro` 是否真存在；若 404，需查官方最新模型 ID
4. **新闻源**：用户尚未提供常用 AI 资讯来源（之前问过：机器之心 / 量子位 / Stratechery / Latent Space …），列出后可加到 Tavily 查询里提高精度
5. ~~5 张兜底 SVG（pulse/branch/spark/shield/box）数据写死~~ → ✅ 已改为抽象版（无数字 / 日期 / 品牌名），可作为任意类别新闻的合理兜底

## 技术注意
- `state.cfg` 存 localStorage：`mal_cfg`，永远不要写死在源码里
- 推 GitHub 时同步写两个 data.js（marketing + app）
- AI 返回 SVG 经清洗：剥 `<script>` / `on*=` 属性 / 长度 ≤ 6000
- 时间树用 SVG + CSS Grid 节点流式布局；展开时右侧抽屉显示详情
