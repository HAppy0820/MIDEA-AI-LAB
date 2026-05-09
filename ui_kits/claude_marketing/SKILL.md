# SKILL.md · Midea AI Lab 内容生成与对接

> 这是 `ui_kits/claude_marketing/` 站点的内容生产手册。
> 站点本身是纯静态 HTML，所有内容来自 `data.js`。每周更新走 DeepSeek API → 写回 `data.js` → push 到 GitHub → Vercel 自动部署。

---

## 1. 站点结构

```
ui_kits/claude_marketing/
├── index.html          # 单页应用，4 个视图切换
├── data.js             # 全部内容，唯一编辑入口
├── README.md           # 设计系统说明
├── SKILL.md            # ← 你在这里
└── prompts/
    ├── timeline.md     # AI 发展史 · 节点 schema + 提示词
    ├── weekly.md       # 每周大事件 · 5 条事件 schema
    ├── essays.md       # 跨境电商思考 · 单篇文章 schema
    └── readings.md     # 论文带读 · 单篇带读 schema
```

## 2. 四个内容板块对照表

| 板块         | data.js 全局变量 | 单元   | 更新频率 | 提示词文件 |
|--------------|------------------|--------|----------|-----------|
| AI 发展史    | `window.TIMELINE`| 1 节点 | 偶尔补   | `prompts/timeline.md` |
| 每周大事件   | `window.WEEKLY`  | 5 事件 | 每周日   | `prompts/weekly.md`   |
| 跨境电商思考 | `window.ESSAYS`  | 1 文章 | 每周一   | `prompts/essays.md`   |
| 论文带读     | `window.READINGS`| 1 论文 | 每周二   | `prompts/readings.md` |

## 3. URL 路由（hash 路由）

| 路径               | 视图                          |
|--------------------|------------------------------|
| `/`                | AI 发展史（默认）             |
| `/#weekly`         | 每周大事件                    |
| `/#essays`         | 文章列表                      |
| `/#essays/3`       | 第 4 篇文章详情（0-indexed）  |
| `/#readings`       | 论文带读列表                  |
| `/#readings/0`     | 第 1 篇论文带读详情           |
| `/#timeline/7`     | 时间线第 8 个节点展开         |

新增 / 删除条目时**会改变索引**——分享出去的旧链接可能错位。建议：内容是只增不删的；要删，就替换为占位条目。

## 4. DeepSeek API 对接（典型流程）

```python
# 伪代码
import json, requests
from pathlib import Path

PROMPT = Path("prompts/weekly.md").read_text()

resp = requests.post(
    "https://api.deepseek.com/v1/chat/completions",
    headers={"Authorization": f"Bearer {DEEPSEEK_KEY}"},
    json={
        "model": "deepseek-reasoner",          # 内容质量优先用 reasoner
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": PROMPT},
            {"role": "user", "content": user_input},  # 原始素材 / 主题
        ],
    },
)
content = json.loads(resp.json()["choices"][0]["message"]["content"])
# 校验 schema → 写回 data.js
```

### 写回 data.js 的注意

- 不要整文件覆盖；找到对应的 `window.XXX = [...]`，**追加 / 替换** 单条。
- 字符串内的双引号必须正确转义。中文引号 `""` 不需要转义。
- 数组里逗号尾随、缩进 2 空格——和原文保持一致，diff 才好读。
- ESSAYS / READINGS 的 `id` 必须全局唯一，建议 `kebab-slug-yyyy-mm` 格式。

## 5. 模型选型建议

| 任务                       | 推荐模型              | 原因 |
|----------------------------|-----------------------|------|
| Weekly 5 条                | `deepseek-chat`       | 结构化、量大、需要快  |
| Essays 思考文              | `deepseek-reasoner`   | 观点要扎实，慢一点没关系 |
| Readings 论文带读          | `deepseek-reasoner`   | 准确引用 + 复杂 schema |
| Timeline 节点补全          | `deepseek-reasoner`   | 历史事实要严谨 |
| 摘要 / 翻译辅助            | `deepseek-chat`       | 便宜 |

## 6. 内容质量守则（所有板块通用）

1. **不编造数字**。年份、参数、价格、得分、星标——查不到就略过，不要填。
2. **不写公关话术**。禁用："震惊""颠覆""革命""里程碑""划时代""赋能"。
3. **第一段要有钩子**。具体场景、反直觉数字、带日期的事件，三选一。
4. **每篇都要落到"运营桌面"**。读者关心的是"明天打开后台会看到什么变化"。
5. **承认局限**。允许说"这个判断我还没观察够"，比假装全知可信。

## 7. 部署

仓库 push 到 main 分支 → Vercel 自动构建。`data.js` 是唯一需要每周改动的文件。

如果只改 `data.js`，可以在本地直接 `git commit -am "weekly: 第 N 周" && git push`，浏览器 30 秒后即可看到更新。

## 8. 后续可扩展点（按优先级）

- [ ] 把 `data.js` 拆为 `data/timeline.js + weekly.js + essays.js + readings.js` 四个文件，方便并行 PR。
- [ ] 邮件订阅接 Mailchimp / Substack（当前 localStorage 只是占位）。
- [ ] RSS：从 `window.WEEKLY/ESSAYS/READINGS` 生成 `feed.xml`，每周构建时跑一次。
- [ ] 中英对照：`READINGS.sections[].en` 已在 schema 里，前端可加切换开关。
- [ ] 站内全文搜索目前是客户端线性扫描，>200 篇时要换轻量级索引（lunr/minisearch）。

## 9. 提示词维护原则

- **schema 先于风格**。每个提示词都以"严格 JSON schema"开头，模型先对齐结构再谈语气。
- **示例必须真实**。提示词里的例子直接从已发布的 `data.js` 截取——不要写假例子。
- **守则用列表**。"必须""禁用""可选"分得越清楚，模型越听话。
- **禁词列表要更新**。每次审稿发现"AI 又用了这个词"，就把它加到对应提示词的禁用清单里。
