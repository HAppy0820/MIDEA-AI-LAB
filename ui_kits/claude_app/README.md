# Claude App — UI Kit

Hi-fi recreation of the Claude.ai chat surface in the warm-canvas / coral-accent style.

**Files**
- `index.html` — interactive demo: click a sidebar conversation, type a message, see Claude "respond" with a fake streaming reply.
- All components are inlined as React/JSX inside `index.html` via Babel standalone — open the file directly in a browser.

**Surfaces covered**
- Left sidebar (logo, new chat, recents, account row)
- Main chat area (welcome state, user/Claude turns, fake streaming)
- Composer (textarea, attach/voice icons, model picker chip, send)
- Top-right account avatar
- Empty / welcome state with starter prompts

**Visual rules followed**
- Cream canvas background everywhere; the sidebar is `--canvas-soft`, the main area is `--canvas`.
- Coral only for the send button, links, and model-picker emphasis. Never as a background.
- Hairline borders, no shadows at rest.
- Serif display for "Good evening" greeting, sans for everything else.
- No emoji. Lucide icons throughout.

**Things this kit deliberately omits**
- Real streaming / API integration
- Markdown rendering of the response (just plain text)
- File upload, MCP, projects, artifacts panel
- Settings screens, login

Replace fake responses with real ones when integrating.
