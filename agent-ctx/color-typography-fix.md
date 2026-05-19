# Color & Typography Consistency Fix

## Task
Fix color and typography consistency across ALL pages of the Kivora platform.

## Changes Made

### Color Fixes

#### Home Page (`app/home/page.jsx`)
- Progress ring colors: `#f59e0b` (amber) → `#ef4444` (red-400), `#3b82f6` (blue) → `#dc2626` (red-600), `#16a34a` (green) → `#b91c1c` (red-700)
- Opportunity of the Day: `text-amber-400` → `text-red-400`, `bg-amber-500/5` → `bg-red-500/5`, `bg-amber-500/10 hover:bg-amber-500/20 text-amber-400` → `bg-red-500/10 hover:bg-red-500/20 text-red-400`
- IconMoney colors: `text-green-400` → `text-red-400` (2 instances - opp of day and swipe card)
- Save/Bookmark button: `bg-green-600/10 text-green-400 hover:bg-green-600/20` → `bg-red-600/10 text-red-400 hover:bg-red-600/20`

#### DevTools Page (`app/devtools/DevToolsClient.jsx`)
- Category tab colors: `#3b82f6` → `#dc2626`, `#a855f7` → `#ef4444`, `#16a34a` → `#f87171`, `#f59e0b` → `#b91c1c`, `#06b6d4` → `#991b1b`
- JWT payload display: `text-sky-400` → `text-red-400`
- API test headers display: `text-sky-400` → `text-red-400`

#### Dashboard Page (`app/dashboard/page.jsx`)
- DevTools category dot: `bg-blue-500` → `bg-red-600`

### Typography Fixes (All Pages)

#### Design Token Adoption
- Replaced ALL `text-[#737373]` with `text-muted` across every JSX file in the app
- Replaced ALL `text-[#404040]` with `text-muted2` across every JSX file in the app

#### Page Titles (h1)
- Home: Already `text-display font-semibold mb-2 tracking-tight` ✅
- DevTools: Already `text-display font-semibold mb-2 tracking-tight` ✅
- Opportunities: Already `text-display font-semibold mb-2 tracking-tight` ✅
- Profile: Changed from `text-headline` → `text-display font-semibold mb-2 tracking-tight`
- Study Desk: Already `text-display font-semibold mb-2 tracking-tight` ✅

#### Subtitle Paragraphs
- All pages: Changed `text-muted text-sm mt-0.5` → `text-muted text-body-sm mt-0.5`

#### Section Headings (h2)
- Standardized to `font-semibold text-sm tracking-tight text-muted` across all pages

#### Section Headings (h3)
- Standardized from `text-body` (16px) → `text-sm` (14px) for consistent h3 sizing
- Applied `font-semibold text-sm tracking-tight text-muted` pattern consistently

#### Non-platform Color Fixes
- `text-slate-400` in Opportunities → `text-[#d4d4d4]` (design system secondary text)

### Files Modified
1. `app/home/page.jsx` - Color + typography fixes
2. `app/devtools/DevToolsClient.jsx` - Color + typography fixes
3. `app/opportunities/page.jsx` - Typography fixes
4. `app/profile/page.jsx` - Typography fixes
5. `app/study/StudyClient.jsx` - Typography fixes
6. `app/chat/ChatClient.jsx` - Typography fixes
7. `app/dashboard/page.jsx` - Color fix
8. `app/page.jsx` - Typography token adoption
9. `app/admin/page.jsx` - Typography token adoption
10. `app/explore/page.jsx` - Typography token adoption
11. `app/explore/[slug]/page.jsx` - Typography token adoption
12. `app/blog/page.jsx` - Typography token adoption
13. `app/contact/page.jsx` - Typography token adoption
14. `app/auth/page.jsx` - Typography token adoption
15. `app/auth/update-password/page.jsx` - Typography token adoption
16. `app/auth/reset/page.jsx` - Typography token adoption
17. `app/error.jsx` - Typography token adoption
18. `app/community/page.jsx` - Typography token adoption
19. `app/welcome/page.jsx` - Typography token adoption
20. `app/not-found.jsx` - Typography token adoption
21. `app/onboarding/page.jsx` - Typography token adoption
22. `app/about/page.jsx` - Typography token adoption
23. `app/privacy/page.jsx` - Typography token adoption
24. `app/terms/page.jsx` - Typography token adoption

### Kept As-Is (Per Task Instructions)
- Green for success states (milestone checkmarks, 100% progress, active badges)
- Green for terminal conventions (command prompts, status indicators)
- `text-[#525252]` - No design token maps to this value
- `text-[#d4d4d4]` - Design system secondary text color (kept as-is, no Tailwind token)
