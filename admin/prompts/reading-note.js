/* ─────────────────────────────────────────────────────────
   MR.PP · Reading Note Skill
   每周自动抓取 + 解读 AI 重要博客 / 论文，输出符合站点 schema 的精读笔记。
   被 admin/admin.js 在「论文带读」tab 调用。
   ───────────────────────────────────────────────────────── */

window.READING_SKILL = {
  name: 'mr-pp-reading-note',
  version: '1.0',
  description: '从原文链接抓取一篇 AI 博客 / 论文，按 MR.PP 解读 schema 输出结构化精读笔记。',

  /* 站点上的精读 JSON schema —— DeepSeek 必须严格按此输出 */
  outputSchema: {
    id: 'string · 短横线英文 id（如 anthropic-context-2026）',
    source: 'string · 来源大写代号（ANTHROPIC / OPENAI / DEEPMIND / DEEPSEEK / META）',
    sourceUrl: 'string · 原文 URL',
    week: 'string · 第 X 周 · YYYY.MM',
    title: 'string · 原文英文标题',
    titleCn: 'string · 中文标题（简洁，<= 22 字）',
    readingTime: 'string · 如「原文 · 25 分钟」',
    annotator: 'string · 固定填「AI 自动生成」',
    pyramid: {
      top: 'string · 一句话核心论点（30-50 字）',
      mid: 'string[] · 2-3 条支撑前提（每条 16-22 字，含「前提一/二/三」或「结论」前缀）',
      base: '[{k:string,v:string}] · 4 块论据细节，k 是 4 字以内分类（定义/模式/场景/准则等），v 是一句话',
    },
    tldr: 'string · 一段话客观总结（80-120 字，pyramid 缺失时 fallback 用）',
    sections: 'Section[] · 5 节，按文章主线划分',
    glossary: '[{term:string,def:string}] · 5-8 个关键术语，中文解释',
    further: '[{type:string,label:string,url:string}] · 3-5 条延伸阅读，type 取「原文/配套/延伸」',
  },

  sectionSchema: {
    h: 'string · 中文小标题，「一、二、三」前缀',
    en: 'string · 1-2 句原文英文摘录',
    cn: 'string · 中文翻译 + 解释，可用 <strong> 标重点（80-150 字）',
    note: 'string · MR.PP 解读，比英文翻译更深入，揭示原文没明说的洞察（可用 <strong>）',
    demoId: 'string · （可选）配套动画 ID，参考已有 READ_DEMOS 字典',
    think: '{q,a} · （可选）想想看：q 是引导问题，a 是 HTML 解答',
    quiz: '{q,opts,answer,explain} · （可选）小测：opts 4 选 1，answer 是正确选项 index，explain 是 HTML 讲解',
    compare: '{aLabel,a,bLabel,b} · （可选）对比卡：左右两栏对照',
    /* 5 节里至少 3 节要带 think/quiz/compare 之一，类型尽量分散 */
  },

  /* 给 DeepSeek 的 system prompt */
  systemPrompt: `你是 MR.PP——美的集团跨境电商团队的 AI 阅读伙伴。
你的工作是把一篇 AI 领域的英文博客或论文，加工成一份让中国跨境电商运营 / 产品经理 / 工程师都能看懂的「精读笔记」。

风格要求：
- 第一人称、克制、不夸张、不营销腔
- 每个概念都要落到"对跨境电商的具体影响"
- 中文流畅，专业术语保留英文 + 首次出现给中文解释
- 用 <strong>...</strong> 标重点（HTML 内联，不要 markdown）
- 比 ChatGPT 的"客观陈述"更主动——揭示原文没明说的洞察、提示读者注意的陷阱

输出格式：
严格 JSON，符合 outputSchema。不要 markdown 代码块。
sections 必须 5 节。每节 cn 长度控制在 80-150 字。
note 字段是 MR.PP 的画龙点睛——揭示作者的言外之意、给跨境电商的实操启示。

互动元素分布（5 节中至少 3 节带）：
- think · 想想看：用一个引导问题让读者先思考，再给答案
- quiz · 小测：4 选 1 题，要有迷惑性的错误选项
- compare · 对比卡：两个易混淆概念 / 两种典型场景的并排对照
类型尽量分散，不要全是 think。`,

  /* 给 DeepSeek 的 user prompt 模板 */
  userPromptTemplate(articleText, meta) {
    return `请按 MR.PP schema 解读以下文章。

【元信息】
来源：${meta.source}
URL：${meta.url}
本周次：${meta.week}
本周日期：${meta.date}

【原文内容】
${articleText}

【输出要求】
1. 严格 JSON，无 markdown 代码块、无前后多余文字
2. id 字段用文章主题缩写 + 年月，全小写英文 + 短横线
3. pyramid 是论证逻辑提炼，不是简单分点——top 必须是核心论点而非话题，mid 是支撑论点的前提
4. sections 5 节按文章主线分，每节带 1-2 句英文原文摘录（en 字段）
5. 5 节里至少 3 节带 think / quiz / compare 之一，类型尽量分散
6. glossary 选 5-8 个关键术语，中文解释要让运营也能懂
7. further 给 3-5 条相关延伸阅读链接

直接输出 JSON：`;
  },

  /* 给 Tavily 联网搜索的 query 列表 —— 用于自动找本周值得读的文章 */
  weeklySearchQueries: [
    'Anthropic blog post this week research engineering',
    'OpenAI engineering blog research post recent',
    'DeepMind research blog post recent',
    'AI agent system best practices blog post recent',
    'LLM context window long context engineering blog',
  ],

  /* 主动调用：把整篇网页正文抓下来给 DeepSeek 解读 */
  async generate(articleUrl, deepSeekFn, fetchArticle, meta) {
    const articleText = await fetchArticle(articleUrl);
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: this.userPromptTemplate(articleText, { ...meta, url: articleUrl }) },
    ];
    const out = await deepSeekFn(messages, { temperature: 0.4, max_tokens: 8000 });
    let json;
    try { json = JSON.parse(out); }
    catch (e) {
      const m = out.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('MR.PP 返回格式无法解析');
      json = JSON.parse(m[0]);
    }
    return json;
  },
};
