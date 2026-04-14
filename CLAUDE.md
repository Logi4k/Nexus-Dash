# Nexus — Project Context for Claude

## Project
Personal trader dashboard built with Tauri 2 + React 18 + TypeScript + Tailwind CSS 3. UK-based prop trader tool. 9 pages: Dashboard, Market, Journal, PropAccounts, Expenses, Investments, Debt, Tax, Ideas.

## Design Context

### Users
Prop traders managing their financial life in one place. UK-based (GBP primary, USD secondary). Daily use — pre-market, mid-session, end-of-day review. High-stakes, time-pressured, information-dense context.

### Brand Personality
**Sharp, focused, powerful.** A professional tool for serious traders. Earns trust through precision and restraint.

### Aesthetic Direction
- References: Figma, Notion, Arc Browser — polished, animated, personality-driven productivity tools.
- Anti-references: Robinhood (too casual), crypto dashboards (too loud).
- Dark mode only. Deep navy/space-black (`#070810`, `#0d1018`). Per-page accents: indigo, sky, amber, green, teal, red, purple, orange, pink.
- DM Sans for UI text. JetBrains Mono for all numbers and financial values.
- Framer Motion: purposeful stagger/fade transitions. Motion serves comprehension, not spectacle.
- Cards: glassmorphism-lite — subtle inner glow, low-opacity borders, card-shine gradients.

### Design Principles
1. **Data first, decoration second.** Every visual element must help the user understand or act.
2. **Consistent rhythm.** Spacing, type, and radius follow a clear scale. Pages feel like a family.
3. **Colour has meaning.** Per-page accent = page identity. Profit = green, loss = red, warn = amber. Never reassigned.
4. **Density with breathing room.** Information-rich but never cramped. The dark background does the heavy lifting.
5. **Interactions feel instant.** Hover states and transitions make the app feel alive and respectful of the user's time.
