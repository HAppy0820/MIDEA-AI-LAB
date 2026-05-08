---
name: claude-style-design
description: Use this skill to generate well-branded interfaces and assets in the editorial, warm, cream-canvas style of Anthropic's Claude (claude.ai / claude.com), either for production or throwaway prototypes. Contains color tokens, typography substitutions, spacing/shadow systems, brand voice rules, iconography (Lucide), and ready-to-copy UI components.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Pull `colors_and_type.css` straight in and reference its custom properties — do not redefine colors. The cream canvas (`--canvas: #faf9f5`) is non-negotiable; switching to pure white kills the brand.

If working on production code, copy assets into the project and read the rules in README.md to become an expert in designing with this brand. Pay particular attention to:
- The CONTENT FUNDAMENTALS section — voice, casing, no-emoji rule
- The VISUAL FOUNDATIONS section — what this brand will NEVER look like
- The CAVEATS section — flagged font and mark substitutions

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (target audience, dark/light, density, language pairing for non-English content), and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
