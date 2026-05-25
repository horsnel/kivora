# batch3-opportunities Work Record

## Task
Add 3 features to the Kivora opportunities page:
1. Income Calculator
2. Step-by-Step Checklist
3. Opportunity Comparison

## Files Modified
- `/home/z/my-project/kivora/app/opportunities/page.jsx` — Added all 3 features

## Implementation Details

### Feature 1: Income Calculator
- Two range sliders (calcMin: 0-20000, calcMax: 0-50000)
- Period selector (daily/weekly/monthly)
- Projection cards with CSS bar chart visualization for 1/6/12 month periods
- `fillCalcFromOpp()` function pre-fills sliders from opportunity card "Calc" button
- Period multiplier logic: daily=30, weekly=4.3, monthly=1

### Feature 2: Step-by-Step Checklist
- Modal triggered by "Plan" button on each opportunity card
- Steps generated from `result.action_plan` (handles both string and {period, task} object formats)
- Checkbox tracking with localStorage persistence (`kv_checklist_checked`, `kv_checklist_custom`)
- Progress bar showing X/Y steps completed with percentage
- Custom step addition via input field at bottom of modal
- Uses `useCallback` for persist functions to avoid stale closures

### Feature 3: Opportunity Comparison
- "Compare" toggle button on each opportunity card (max 3)
- Red border highlight on cards that are selected for comparison
- Floating "Compare (N)" button appears when 2+ selected
- Comparison modal with table layout comparing: income range, monthly cost, start time, tags
- "Clear all comparisons" and "Done" actions

### Icons Created
- IconCalc: calculator icon for income calculator
- IconChecklist: checklist icon for action plan
- IconCompare: two-column icon for comparison
- IconAddStep: circle-plus icon (defined but using IconPlus instead)

## Build Status
- Lint: Passes (only pre-existing useEffect dependency warning)
- Build: Pre-existing error in ChatClient.jsx (unrelated to changes)
- No deployment performed as instructed
