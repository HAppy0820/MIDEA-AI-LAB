# Claude-Style Design System

A design system that captures the editorial, warm, literary aesthetic of Anthropic's Claude product surface (claude.ai, claude.com). Built to support a Midea cross-border e-commerce AI knowledge site that wants to feel calm, intelligent, and quietly premium — three sections (AI history timeline, Weekly AI events, AI × E-commerce essays) all sharing one cohesive visual language.

> **Source of inspiration:** the public Claude product UI and Anthropic marketing site. No proprietary Anthropic source was imported — the system is a *recreation* derived from observation. Licensed Anthropic typefaces (Copernicus, Tiempos Headline, Styrene B) are substituted with the closest free alternatives; see CAVEATS at the bottom of this file.

---

## Index — what's in this folder

| Path | What it is |
| --- | --- |
| `colors_and_type.css` | All CSS custom properties: color tokens, type stacks, spacing, radii, shadows, motion. Drop into any page. |
| `assets/` | Logos, glyphs, generic illustrations. Approximated marks — replace with licensed art for production. |
| `fonts/` | (None local) Webfonts loaded via Google Fonts `@import` in `colors_and_type.css`. |
| `preview/` | Small HTML cards that document the system (registered for the Design System tab). |
| `ui_kits/claude_app/` | Hi-fi recreation of the Claude.ai chat surface — sidebar, composer, message list. |
| `ui_kits/claude_marketing/` | Hi-fi recreation of an Anthropic-style marketing landing page. |
| `SKILL.md` | Cross-compatible Agent Skill manifest. |

---

## CONTENT FUNDAMENTALS

Claude's voice is calm, plainspoken, and quietly literary. It doesn't shout, doesn't exclaim, doesn't try to be your friend with emoji and exclamation points. It reads like a thoughtful colleague who happens to also be very competent.

**Tone**
- **Direct, never breathless.** "Claude can write code." Not "Unlock the power of AI! 🚀"
- **Confident understatement.** Headlines are short statements of fact. "A new model. Built for thinking."
- **Curious, not promotional.** Copy explores ideas; it doesn't pitch.
- **Warm but reserved.** The cream canvas is the whole personality — the words don't need to be warm too.

**Voice rules**
- **Person:** First-person plural ("we") for Anthropic-as-author. Second-person ("you") sparingly. Avoid "I" unless quoting a person.
- **Casing:** Sentence case for headings and buttons. **No Title Case.** "Start a new chat" — not "Start A New Chat".
- **Punctuation:** Periods on standalone lines/captions are fine. Em-dashes are common — used as breath marks, not as separators.
- **No emoji.** Anywhere. Not in headings, not in lists, not in marketing.
- **Sparing exclamation marks.** Effectively never.
- **Numerals:** Spell out one through nine in prose; numerals from 10 onward, plus all stats and prices.

**Examples**
- ✅ "Meet Claude, your AI collaborator."
- ❌ "🤖 Meet Claude — Your AI Bestie!"
- ✅ "We're building AI you can trust."
- ❌ "Building AI You Can Trust 🚀"
- ✅ Button: "Start chatting"  • ❌ "Click Here Now!"
- ✅ Eyebrow label: `RESEARCH` (uppercase, tracked, small)
- ✅ Section header: "Designed to be safe."

**Vibe in one line:** *A library card catalog redesigned for software.*

---

## VISUAL FOUNDATIONS

### Surface and color
- **Cream canvas, not white.** The defining choice. `--canvas: #faf9f5` is the dominant surface; pure white (`#ffffff`) appears only inside cards or input fields, sparingly. Switching this to white kills 80% of the brand.
- **Coral accent, used surgically.** `--coral-500: #cc785c` is a single accent — primary buttons, links, highlight states. Never as a gradient backdrop, never as decoration.
- **Warm-tinted neutrals.** All "grays" are warmer than neutral — they carry a faint sepia. Cool gray text on the cream canvas would feel sickly.
- **Dark mode = ink, not black.** `--ink-900: #181715` for the dark footer / dark theme — has a touch of warmth, not pure carbon.

### Typography
- **Display: transitional serif** (substituted: Source Serif 4, target: Copernicus / Tiempos Headline). Book weight (400). Tight letter-spacing (`-0.02em`). Generous size — hero headlines run 64–84px.
- **Body: rounded humanist sans** (substituted: DM Sans, target: Styrene B). 16px body at 1.65 line-height. Slightly larger than typical web body — invites reading.
- **Body serif also acceptable.** Long-form essays on the marketing site use the serif for body, mimicking editorial articles.
- **Mono: JetBrains Mono.** Used in code blocks and the rare technical detail.
- **No display sans.** Headlines are *always* serif. This is the rule.

### Spacing and rhythm
- **4-base scale** (`4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96, 128`).
- **Generous vertical rhythm.** Sections breathe — `--sp-11: 96px` between major sections is normal, not luxurious.
- **Max content width ~720px** for prose. Wider feels web-y, not literary.

### Backgrounds
- **No gradient meshes. No blobs. No purple.** The canvas is a flat cream tint — that's the entire treatment.
- **Subtle texture is allowed.** A barely-perceptible paper grain on the canvas is on-brand; anything more is off-brand.
- **Full-bleed imagery is rare.** When images appear, they sit inside a card or have soft rounded corners — they don't break the page edge.

### Imagery
- **Warm, slightly desaturated photography.** Editorial / documentary feel. Never glossy. Never AI-generated-looking.
- **Hand-drawn or printmaking-style illustration.** Anthropic uses simple geometric/printmaking illustration with limited palette and visible texture — never glossy 3D or vector blob illustrations.

### Borders, cards, shadows
- **Hairline borders, warm-tinted.** `1px solid var(--border)` (`#d6d3ca`). Borders do most of the structural work; shadows are secondary.
- **Cards: cream surface, hairline border, no shadow at rest.** Optional `--shadow-sm` on hover. Radius: `--r-lg` (12px) — never pill-rounded except buttons.
- **Shadows are low and warm.** `rgba(45, 40, 30, x)` — never pure black `rgba(0,0,0,x)`. Max blur ~32px.
- **Inner highlight** (`--shadow-inset`) on raised buttons gives a subtle 3D edge.

### Motion
- **Soft, short, no bouncing.** `--dur-base: 220ms` on `cubic-bezier(0.22, 0.61, 0.36, 1)`. Eased *out*, not springy.
- **Fades and slight position shifts only.** No scale-bounces, no rotations, no parallax. A cursor blink in the composer is the most "kinetic" thing on the page.
- **Stagger on first paint.** Headline → eyebrow → CTA → footer can fade in over ~600ms total. After that, the page sits still.
- **Hover:** color shift only (coral → darker coral, ink → coral on links). No translate, no shadow-lift.
- **Press:** 1–2px translate-down + slightly darker color. Never scale.

### Borders and radii
- **Buttons:** `--r-md` (8px) for primary; `--r-pill` for chips and tags only.
- **Inputs:** `--r-md` with `1px solid var(--border)`. Focus = `2px solid var(--coral-500)` and a faint coral glow (`0 0 0 4px rgba(204,120,92,0.15)`).
- **Cards:** `--r-lg` (12px). Modal sheets: `--r-xl` (16px).

### Transparency, blur
- Used **only** for overlays (modals, tooltips). Modal backdrop = `rgba(24, 23, 21, 0.5)` with `backdrop-filter: blur(8px)`. That's the only place.

### Layout rules
- **Single sticky element max.** Top nav sticks; nothing else.
- **No sidebars on marketing pages.** App pages use a single left sidebar (240px), collapsible.
- **Editorial alignment.** Long-form pages use a single centered column; marketing pages can break to two columns at most.

### What this brand will NEVER look like
- Bluish-purple gradients
- Glossy 3D mascot illustrations
- Pill-rounded cards with colored left borders
- Emoji-led feature cards
- Light blue / indigo CTA buttons
- Glassmorphism / frosted-glass everywhere
- Inter, Roboto, or system-font headlines

---

## ICONOGRAPHY

Claude's marketing and product surfaces use a **single, restrained line-icon vocabulary**: 1.5–1.75px stroke, rounded line caps, rounded line joins, 24px artboard. There is no proprietary icon font in the public surface — the look is closest to **Lucide** (formerly Feather), which we adopt as the canonical icon set for this system.

- **Icon source:** [Lucide](https://lucide.dev) via CDN (`https://unpkg.com/lucide@latest`). 24×24 viewBox, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
- **Color:** icons inherit `currentColor`. In nav and body, `var(--ink-700)`; on coral buttons, `var(--canvas)`; never multi-color.
- **Sizing:** 16px (inline with text), 20px (default UI), 24px (nav), 32px+ (feature illustrations). Always even pixels.
- **No filled icons.** Stroke-only across the board. Mixing stroke+fill breaks the look.
- **No emoji.** Ever. Including in Slack-clone style chat composers.
- **No unicode glyph icons** (• ★ → etc.) used as iconography — they're fine as inline punctuation only.

The brand mark itself is a small **8-point spike/sunburst** glyph (`assets/claude-mark.svg`) — used as the favicon, in the corner of the dark footer, and as a "speaking" indicator in the chat composer when Claude is generating. It is treated like a punctuation mark, not a logo: small, calm, never animated more than a slow fade.

> Substitution flagged: the actual Anthropic mark is licensed and not redistributed here. The included SVG is a faithful approximation. Replace with the licensed asset for production.

---

## CAVEATS — please review

These items I had to substitute or guess; please confirm and supply real assets where possible.

1. **Fonts substituted.** Copernicus / Tiempos Headline → **Source Serif 4**. Styrene B → **DM Sans**. The substitutes are close in proportion and weight but not identical. If you have licensed `.woff2` files for the originals, drop them into `fonts/` and update the `@font-face` block at the top of `colors_and_type.css`.
2. **Brand marks approximated.** The 8-point spike mark in `assets/claude-mark.svg` is a recreation — it captures the silhouette but is not the licensed Anthropic mark. Replace for production.
3. **No real photography.** The UI kits use placeholder boxes where editorial photography would normally appear. The brand calls for warm, slightly desaturated documentary photography — not generic stock and not AI-generated imagery.
4. **The site you're building is for Midea, not Anthropic.** This system gives you the *visual language*, but you should still have your own brand mark and any partner-specific accents. Tell me your Midea logo / wordmark situation and I'll integrate it.
5. **Light theme only.** A dark theme is sketched in tokens (`--bg-dark`, `--fg-on-dark`) but no full dark UI kit was built. Flag if you need it.

---

## Want to iterate?

**Tell me:**
- Is the coral accent too warm/too muted for your audience? I can shift toward a deeper rust or a cleaner brick.
- Should body copy run serif (more editorial) or sans (more product-y)?
- Do you want a Chinese-language type pairing recommended? (Source Han Serif + PingFang would be the obvious match.)
- Do you want me to build the actual three-section site next, using this system?
