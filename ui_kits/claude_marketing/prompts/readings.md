# 提示词 · 论文带读 · READING NOTES

> 用于通过 DeepSeek API 生成或更新 `data.js → window.READINGS` 中的单篇论文带读。
> 这是网站里**结构最复杂**的内容类型，schema 必须严格对齐。

---

## 输出 schema

```json
{
  "id": "kebab-case-slug",
  "week": "第 1 篇 · 2026.05",
  "source": "Anthropic | OpenAI | DeepMind | Google | Meta | 学界 | …",
  "sourceUrl": "https://…",
  "title": "原论文英文标题",
  "titleCn": "中文译标题（不要直译，要意译得像中文标题）",
  "readingTime": "原文 · 25 分钟",
  "annotator": "AI 自动生成",

  "pyramid": {
    "top": "核心论点：1 句话讲清楚论文的主张。≤ 50 字。",
    "mid": [
      "前提一 · 一句话",
      "前提二 · 一句话",
      "结论 · 一句话"
    ],
    "base": [
      { "k": "定义", "v": "≤ 18 字" },
      { "k": "模式", "v": "≤ 18 字" },
      { "k": "场景", "v": "≤ 18 字" },
      { "k": "准则", "v": "≤ 18 字" }
    ]
  },

  "tldr": "一句话总结。和 pyramid.top 不要重复。要有读者视角：「为什么我作为运营 / 工程师要看这篇？」≤ 120 字。",

  "sections": [ /* 4-6 个 section，每个见下方 schema */ ],

  "glossary": [
    { "term": "术语缩写或英文", "def": "用日常语言写的释义。一句话。可举例。" }
  ],

  "further": [
    { "type": "原文 | 配套 | 延伸", "label": "标题 · 来源", "url": "https://…" }
  ]
}
```

### section 子 schema

```json
{
  "h": "一、章节中文标题",
  "en": "原文英文（一段，准确引用）",
  "cn": "中文意译。可加 <strong>…</strong> 强调，避免逐字直译；要重组为中文逻辑。",
  "note": "译者注。补充语境、点明术语来源、纠正直译歧义。100-180 字。",
  "demoId": "可选。挂接前端动态演示。可省略。",
  "compare": {
    "aLabel": "对比项 A 名称",
    "a": "对比 A 的具体表现 / 故事场景。100-160 字。",
    "bLabel": "对比项 B 名称",
    "b": "对比 B 的具体表现。100-160 字。"
  },
  "think": {
    "q": "针对本节抛一个问题，最好是反直觉或运营人会问的。",
    "a": "答案。允许 <strong>、<br><br>。150-280 字。"
  },
  "quiz": {
    "q": "情景选择题。≤ 60 字。",
    "opts": ["选项 1", "选项 2", "选项 3", "选项 4"],
    "answer": 2,
    "explain": "为什么是答案，为什么其他不是。150-220 字。"
  }
}
```

`compare`、`think`、`quiz` 三者**任选 1-2 个**，不要全配齐——会显得堆砌。

## 风格守则

1. **必须先读原文**。准确引述结论，不要二手转述、不要捏造数据。`en` 引文要逐字对齐论文。
2. **`cn` 不是翻译，是讲解**。要把英文术语换成"运营听得懂的中文"。
3. **`note` 是带读的灵魂**。译者注要点明：这个术语来自哪里、为什么这样翻、和读者熟悉的什么概念对应。
4. **`think` / `quiz` 必须落到跨境电商场景**。不能是泛泛的"哪个对、哪个错"。
5. **glossary**：列论文里第一次出现就需要解释的术语，5-8 条。
6. **不要"对小白友好"地省略技术细节**。要写"先讲机制再翻译"。
7. **pyramid 是金字塔结构**：top（论点）→ mid（前提-结论）→ base（4 个最小知识单元）。

## 已写过的论文（不要重复）

```
1. Building effective agents · Anthropic · 2024
```

## 候选选题（建议优先级）

```
1. Attention Is All You Need · Vaswani et al. · 2017
2. InstructGPT · Ouyang et al. · 2022（RLHF 起点）
3. Constitutional AI · Anthropic · 2022
4. Scaling Laws for Neural Language Models · Kaplan et al. · 2020
5. Chain-of-Thought Prompting · Wei et al. · 2022
6. Toolformer · Schick et al. · 2023
```

## 触发指令模板

```
你是 Midea AI Lab 的论文带读编辑。请按 schema 与守则，为以下论文输出一篇 READINGS：

论文：{paper_title}
来源：{source}
URL：{sourceUrl}
本期编号：{week_label}        // 例如：第 2 篇 · 2026.05

要求：
- 4-6 个 sections，每个 section 配 1-2 个互动模块（compare/think/quiz）。
- glossary 5-8 条。
- en 字段必须从原文直接引用，不要改写。
- 直接输出 JSON。
```
