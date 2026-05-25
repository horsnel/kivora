---
Task ID: batch4-profile-study
Agent: batch4-profile-study
Task: Build 4 features for Kivora - Account Deletion, Session Management, Progress Tracking, Study Notes Generator

Work Log:

### Feature 1: Account Deletion (GDPR-compliant)
- Created `/app/api/profile/delete/route.js` — Edge runtime API route that:
  - Accepts POST with `{ userId }`
  - Uses `getSupabaseAdmin()` to delete user from auth.users (cascading deletes handle profiles, etc.)
  - Returns success/error JSON
- Modified `/app/profile/page.jsx` — Added "Danger Zone" section at bottom of right column:
  - Red-bordered card with warning icon, heading, and warning text
  - "Delete Account" button that opens a confirmation dialog
  - Confirmation dialog requires typing "DELETE" exactly to enable the final delete button
  - On confirm: calls `/api/profile/delete` API, signs out, redirects to `/welcome`
  - Cancel button to dismiss the dialog

### Feature 2: Session Management
- Modified `/app/profile/page.jsx` — Added "Sessions" section between the form and the danger zone:
  - Shows current session info: browser + OS (parsed from navigator.userAgent)
  - Shows "Active" badge and last sign-in timestamp
  - "Sign out of all devices" button that calls `supabasePublic.auth.signOut()` and redirects to `/auth`
  - Note about the action invalidating all refresh tokens
- Added inline `IconMonitor` and `IconShield` SVG components for the new sections
- Added `parseUserAgent()` helper to extract browser and OS from user agent string

### Feature 3: Progress Tracking
- Modified `/app/dashboard/page.jsx`:
  - Added "Streak" stat card to the stats grid (now 5 columns: Streak, Saved, Chats, Messages, Member since)
  - Streak shows current streak with fire emoji and best streak in a separate column
  - Added `computeStreak()` function: counts consecutive days with at least 1 session, handles today/yesterday start
  - Added `buildWeeklyHeatmap()` function: 7 columns (Mon-Sun), 4 rows (weeks), colored cells based on session count
  - Weekly Activity Heatmap card with legend (Less → More gradient)
  - Loads all-time sessions on auth check for streak calculation (independent of activity tab range)
  - Added `study_notes` to TOOL_LABELS and TOOL_CATEGORIES
  - Imported `IconFlame` and `useMemo`

### Feature 4: Study Notes Generator
- Modified `/app/study/StudyClient.jsx`:
  - Added `IconNotes` inline SVG component (notebook icon)
  - Added `notes` to TOOLS array: `{ id: 'notes', label: 'Study Notes Generator', Icon: IconNotes, desc: 'Compile topics into organized study notes' }`
  - Added `NOTE_STYLES` constant: ['Cornell Notes', 'Outline', 'Mind Map Text', 'Summary']
  - Added form fields for notes: `notesSubject`, `notesTopics`, `notesStyle`
  - Added validation: `notesTopics` required
  - Added notes payload in `run()`: `{ subject, topics, style }`
  - Updated tool count in subtitle from 8 to 9
  - Added subject/inputSummary handling for notes tool
- Modified `/app/api/study/route.js`:
  - Added `notes` prompt function that generates structured study notes
  - Supports 4 note styles: Cornell Notes, Outline, Mind Map Text, Summary
  - Each style has specific formatting instructions
  - Output structure: Overview, Key Concepts, Connections, Review Questions, Quick Reference

Build Verification:
- `npm run build` completed successfully with no errors
- All pages compile cleanly

Stage Summary:
- 4 features implemented across 5 files (1 new, 4 modified)
- Account Deletion: GDPR-compliant with confirmation dialog and admin API
- Session Management: Current session display + sign out all devices
- Progress Tracking: Streak stats with fire emoji + weekly activity heatmap
- Study Notes Generator: 9th StudyDesk tool with 4 note styles
