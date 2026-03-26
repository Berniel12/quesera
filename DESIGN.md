# Design System -- QUESERA

## Product Context
- **What this is:** A prediction-market intelligence app that synthesizes signals from Polymarket, Kalshi, Metaculus, FRED, and other sources into bold verdicts about what happens next
- **Who it's for:** Anyone curious about the future -- not traders, not experts, regular people who want real answers backed by real data
- **Space/industry:** Prediction markets / signal intelligence / consumer forecasting
- **Project type:** Web app (Next.js) with public discovery feed + authenticated personalization
- **Brand name:** QUESERA ("que sera, sera" -- what will be, will be)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian meets Editorial
- **Decoration level:** Intentional -- subtle texture (glass panels, gradient backgrounds, neon glows in dark mode) paired with data-dense utility
- **Mood:** Calm authority. Like reading a well-designed intelligence briefing at midnight. Dense with information but never overwhelming. Alive when something moves, quiet when nothing has changed.
- **Theme naming:** "The Horizon Ethos" (light), "The Horizon Night" (dark)
- **No emojis** anywhere in the UI

## Typography
- **Display/Hero:** Inter (variable, --font-inter) -- used for all headings and display text
- **Body:** Inter -- consistent stack, no font switching between heading and body
- **UI/Labels:** Inter -- same as body
- **Data/Tables:** Inter with tabular-nums feature -- numbers align in columns
- **Code:** JetBrains Mono (variable, --font-jetbrains-mono)
- **Loading:** next/font/google (self-hosted via Next.js font optimization, no external CDN requests)
- **Scale:**
  - text-xs: 12px (labels, timestamps, metadata)
  - text-sm: 14px (secondary text, descriptions)
  - text-base: 16px (body text, default)
  - text-lg: 18px (emphasized body, card titles)
  - text-xl: 20px (section headings, mobile question text)
  - text-2xl: 24px (page headings, desktop question text)
  - text-3xl: 30px (hero question on homepage)

## Color

### Approach: Balanced
Primary + category semantics + directional signals. Color carries meaning, not decoration.

### Light Theme ("The Horizon Ethos")
- **Background:** #FAF9F6 (warm off-white)
- **Foreground/text:** #0B1326 (deep navy)
- **Card:** #FFFFFF
- **Primary:** #0B1326 (navy -- strong, authoritative)
- **Secondary surface:** #F2F2F7 (soft gray)
- **Muted text:** #5C5C66
- **Border:** #E5E5EA
- **Positive/up:** #34C759
- **Warning:** #FF9500
- **Destructive/error:** #FF3B30

### Dark Theme ("The Horizon Night")
- **Background:** #0B1326 (deep navy)
- **Foreground/text:** #DBE2FD (cool lavender-white)
- **Card:** #131B2E (slightly lighter navy)
- **Primary accent:** #00DAF3 (cyan neon -- QUESERA's signature color)
- **Secondary surface:** #222A3E
- **Muted text:** #C6C6CD
- **Border:** #2D3449
- **Positive/up:** #4EDEA3
- **Warning:** #FF9500
- **Destructive/error:** #FFB4AB (softened for dark bg)

### Category Colors (8 categories)
| Category | Light accent | Dark accent | Tailwind class |
|----------|-------------|-------------|----------------|
| Finance (macro) | blue-500 | blue-400 | border-blue-500/30 |
| Crypto | amber-500 | amber-400 | border-amber-500/30 |
| Politics | indigo-500 | indigo-400 | border-indigo-500/30 |
| Geopolitics | red-500 | red-400 | border-red-500/30 |
| Sports | emerald-500 | emerald-400 | border-emerald-500/30 |
| Weather (disasters) | orange-500 | orange-400 | border-orange-500/30 |
| Tech | violet-500 | violet-400 | border-violet-500/30 |
| Entertainment | pink-500 | pink-400 | border-pink-500/30 |

Each category has a gradient background variant (cat-gradient-{category}) for section-level tinting.

### Dark Mode Strategy
- Surfaces use navy tones, not pure black
- Accent cyan (#00DAF3) replaces navy as the primary interactive color
- Semantic colors shift warmer/softer (red -> #FFB4AB, green -> #4EDEA3)
- Glass panels (backdrop-blur) available for overlay surfaces
- Neon glow effects for emphasis (box-shadow with cyan)
- Text saturation reduced (pure white -> #DBE2FD lavender-white)

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Density:** Comfortable -- neither cramped nor sparse
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Page padding:** 16px mobile, 24px tablet, 32px desktop
- **Content max-width:** max-w-2xl (672px) for reading content, max-w-6xl for grid layouts

## Layout
- **Approach:** Hybrid -- grid-disciplined for data, editorial for discovery
- **Homepage:** Bento grid with hero card + category-colored compact cards
- **Topic/answer pages:** Single-column reading layout, max-w-2xl centered
- **Admin:** Data table layout with sidebar navigation
- **Grid:** Responsive columns: 1 (mobile) / 2 (tablet) / 3-4 (desktop)
- **Border radius:**
  - sm: 0.6rem (small elements, badges)
  - md: 0.8rem (cards, inputs)
  - lg: 1rem (large cards, modals)
  - xl: 1.4rem (hero cards)
  - full: 9999px (pills, avatars)

## Motion
- **Approach:** Expressive -- spring-eased animations that feel alive, not mechanical
- **Easing curves:**
  - Standard spring: cubic-bezier(0.22, 1, 0.36, 1) -- fast in, elegant settle
  - Bouncy spring: cubic-bezier(0.34, 1.56, 0.64, 1) -- slight overshoot for pop effects
  - Smooth decel: cubic-bezier(0.16, 1, 0.3, 1) -- long elegant deceleration
- **Duration scale:**
  - micro: 50-100ms (state changes, toggles)
  - short: 150-250ms (button hover, focus)
  - medium: 400-600ms (card enter, slide up)
  - long: 700-800ms (page transitions, cascade final)
- **Key animations:**
  - q-slide-up: entrance for cards and sections (0.7s spring)
  - q-card-enter: staggered cascade for card grids (0.8s spring + delay offsets)
  - q-bar-fill: confidence bar animation (1.4s smooth decel, scaleX transform)
  - q-pulse-live: breathing indicator for fresh/live data (2.5s infinite)
  - q-glow-breathe: subtle shadow pulse on active cards (4s infinite)
  - hover-lift: card hover with scale(1.01) + translateY(-6px) + shadow expansion
- **Cascade delays:** Fine-grained 50ms increments (delay-50 through delay-800) for staggered grid reveals
- **Performance:** All animations use transform + opacity only (GPU composited, 60fps)
- **Reduced motion:** Full `prefers-reduced-motion: reduce` support -- all animations disabled

## Component Patterns

### Cards
- Category-colored gradient backgrounds (not borders)
- No colored left-border (AI slop pattern -- explicitly avoided)
- Rich multi-layer shadows in light mode (card-shadow-rich)
- Inset top highlight + deep shadow in dark mode
- Hover: lift + shadow expansion (hover-lift, hover-lift-sm)

### Confidence/Probability Bars
- Horizontal bar with scaleX animation from left
- Category-colored fill
- Percentage number reveals after bar fills (delayed)

### Direction Badges
- Compact inline badges: up (green), down (red), stable (gray)
- No arrows or icons -- text-based ("Up", "Down", "Stable")

### Verdict Blocks (Oracle)
- Full-width section with category gradient background
- Direction badge + verdict prose + confidence bar
- Built from existing primitives, not a new component style

### Empty States
- Warm, human copy (not "No data found")
- Primary action button
- Context about why the state is empty

### Glass Panels (Dark Mode)
- rgba(45, 52, 73, 0.6) background with backdrop-blur(20px)
- Used for overlays, popovers, elevated surfaces

### Section Dividers
- Gradient fade lines (transparent -> border color -> transparent)
- Dark mode: cyan-tinted gradient dividers

## UI Framework
- **Component library:** shadcn/ui
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Icons:** None defined -- avoid decorative icons. Use text and typography for hierarchy.
- **Images:** Curated Unsplash photos per category for card backgrounds

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system documented | Codified existing codebase patterns via /design-consultation. No code changes -- documentation of shipped system. |
| 2026-03-26 | Inter kept as primary font | Already deeply integrated. Swapping would be a rewrite, not an improvement. |
| 2026-03-26 | Cyan neon (#00DAF3) confirmed as dark mode signature | Unusual for the category, memorable, already shipped. Distinctive. |
| 2026-03-26 | No colored left-borders on cards | Explicitly avoided as AI slop pattern. Use gradient backgrounds instead. |
| 2026-03-26 | No emojis in UI | Per project CLAUDE.md. Text and typography carry all meaning. |
