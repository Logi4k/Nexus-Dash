---
name: ui-worker
description: Frontend UI/UX worker for React + Tailwind + Framer Motion components
---

# UI Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving:
- Theme/CSS fixes (replacing hardcoded colors with theme tokens)
- Mobile UX improvements (responsive layouts, touch interactions, bottom sheets)
- Navigation changes (tab bar, swipe, gestures)
- Component visual improvements
- New UI components or page layouts

## Required Skills

- `agent-browser` — MUST invoke for visual verification of UI changes on both desktop and mobile viewports

## Work Procedure

1. **Read the feature description** carefully. Note preconditions, expected behavior, and verification steps.

2. **Read AGENTS.md** for coding conventions (theme tokens, Tailwind patterns, mobile breakpoints).

3. **Read affected files** before making changes. Understand the existing patterns.

4. **Write tests first** (Vitest + React Testing Library):
   - Test that components render without errors
   - Test that theme tokens are used (no hardcoded colors in rendered output)
   - Test responsive behavior where applicable

5. **Implement the changes**:
   - Replace hardcoded colors with theme tokens from the existing system
   - Use `md:` breakpoint for desktop-only styles
   - Ensure all interactive elements have 44px minimum tap targets on mobile
   - Use Framer Motion for animations with `reducedMotion="user"` respect
   - Never use `text-white` — use `text-tx-1` instead
   - Never use inline `style={{ color/background }}` — use Tailwind classes

6. **Run typecheck**: `npx tsc --noEmit` — must pass with zero errors

7. **Run tests**: `npx vitest run` — must pass

8. **Visual verification with agent-browser**:
   - Start dev server if not running
   - Navigate to affected page(s)
   - Take screenshots on desktop viewport
   - Emulate mobile viewport (390x844, mobile, touch)
   - Take screenshots on mobile viewport
   - Verify BW theme if feature involves theme changes
   - Log each check as an interactiveCheck in handoff

9. **Commit** with descriptive message.

## Example Handoff

```json
{
  "salientSummary": "Replaced all hardcoded hex colors in FilterBar with theme tokens (bg-bg-2, border-bd-1, text-tx-2). Verified in both dark and BW modes on desktop and mobile viewports via agent-browser. TypeScript and 3 unit tests pass.",
  "whatWasImplemented": "FilterBar component: replaced bg-[#0d1118] with bg-bg-2, border-[#1a2030] with border-bd-1, text-white with text-tx-1. Added responsive padding for mobile. All colors now respond to theme toggle.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npx tsc --noEmit", "exitCode": 0, "observation": "Zero errors" },
      { "command": "npx vitest run", "exitCode": 0, "observation": "3 tests pass, FilterBar theme tokens verified" }
    ],
    "interactiveChecks": [
      { "action": "Opened Dashboard on desktop (1440x900) in dark mode", "observed": "FilterBar renders with theme colors, no hardcoded hex visible in DOM" },
      { "action": "Toggled to BW mode", "observed": "FilterBar background and text switched to grayscale palette" },
      { "action": "Emulated mobile viewport (390x844)", "observed": "FilterBar renders correctly, no overflow, text readable" }
    ]
  },
  "tests": {
    "added": [
      { "file": "src/components/__tests__/FilterBar.test.tsx", "cases": [
        { "name": "renders without hardcoded color classes", "verifies": "No bg-[#...] or text-[#...] in rendered output" },
        { "name": "renders in BW mode", "verifies": "BW theme class applies correctly" },
        { "name": "renders on mobile viewport", "verifies": "No overflow at 390px" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Theme system architecture needs changes (new CSS variables needed)
- Component depends on a pattern not yet established
- Visual regression in unrelated component detected
- Cannot verify with agent-browser (dev server won't start)
