---
Task ID: 1
Agent: Main Agent
Task: Fix overflowing gradient border ring on StudyDesk, DevTools, and ReelPen pages

Work Log:
- Investigated source code of StudyClient.jsx, DevToolsClient.jsx, ReelPenClient.jsx
- Found all three use inline input classes like `inp`, `ta`, `mono` with `bg-[#0a0a0a] border border-[#262626] rounded-xl`
- Identified root cause: `div:has(> input:focus-visible)::before` rule in globals.css applied gradient ring to the parent div, which also contained label elements, causing the gradient to overflow around both label and input
- Verified overflow issue in browser using agent-browser + VLM analysis on DevTools page
- Replaced the generic `div:has()` approach with CSS `background-clip` technique applied directly to input elements
- New technique: `background-image: linear-gradient(var(--bg), var(--bg)), linear-gradient(90deg, #a855f7, #ef4444)` with `background-clip: padding-box, border-box` creates true gradient border that respects border-radius
- Kept `.kivora-input-wrap` class for pages using the `::before` mask technique (chat bar, home page, explore search)
- Built and deployed to CloudFlare Pages
- Verified fix on all pages: StudyDesk, DevTools, ReelPen, Chat, Explore, Opportunities - all confirmed correct
- Pushed to GitHub

Stage Summary:
- Fixed overflowing gradient border on StudyDesk, DevTools, ReelPen pages
- Changed from `div:has(> input)::before` to `background-clip` technique on input elements directly
- All pages now show purple→red gradient ring perfectly contained within input boundaries
- Deployed to kivora.pages.dev
