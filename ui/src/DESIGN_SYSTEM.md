# ZephyrNexus AI Runtime OS — Design System v2.0

> **Design Direction**: "AI Runtime Operating System" — an orchestration control plane that feels like a living, breathing system.
> Inspired by: Linear's density + hierarchy, Raycast's floating OS feel, Vercel's restraint, OpenAI's calm confidence, variant.com's typography craft.

---

## 1. Philosophy

### Core Principle
**"The interface should feel like a system that IS running, not a dashboard that SHOWS a system."**

Every element should communicate:
- **Orchestration**: Things are being coordinated
- **Execution**: Work is actively happening
- **Runtime**: The system is alive and responsive
- **Coordination**: Agents are working together with spatial awareness

### What This IS
- A control plane for AI systems
- A runtime monitoring interface with spatial depth
- A coordination visualization tool that breathes
- A premium, restrained, purposeful design that feels like an OS

### What This IS NOT
- NOT a generic admin dashboard
- NOT a SaaS marketing site
- NOT cyberpunk or flashy
- NOT a static data display

---

## 2. Visual Direction: "Ambient Depth"

**Key Characteristics:**
- Deep atmospheric layers with volumetric depth
- Floating surfaces that merge and separate contextually
- Invisible boundaries — separation through light, not borders
- Subtle shader-like atmosphere that diffuses across the interface
- Restraint: glow is used only to indicate active state
- Motion-ready: all components prepared for orchestration animation

---

## 3. Typography System v2.0

### Type Scale — Production Grade

```css
/* Display — Hero headlines, system status */
--text-display:    clamp(2rem, 4vw, 3rem)    / 1.05  / -0.04em  / 500
--text-hero:      clamp(1.75rem, 3vw, 2.5rem) / 1.1   / -0.035em / 500

/* Headings — Section titles, panel headers */
--text-h1:         clamp(1.5rem, 2.5vw, 2rem)   / 1.15 / -0.03em / 500
--text-h2:         clamp(1.125rem, 1.75vw, 1.375rem) / 1.2 / -0.02em / 500
--text-h3:         1.0625rem                      / 1.3  / -0.015em / 500

/* Body — Primary content */
--text-body:       0.9375rem                     / 1.6  / -0.01em
--text-body-sm:    0.875rem                      / 1.5  / 0
--text-body-lg:    1.0625rem                     / 1.6  / -0.005em

/* Labels & Meta — Runtime labels, navigation */
--text-label:      0.6875rem                     / 1.0  / 0.06em   (uppercase, 600)
--text-caption:    0.6875rem                     / 1.3  / 0
--text-micro:      0.625rem                      / 1.0  / 0.02em

/* Metric — Numbers, stats, live values */
--text-metric:      clamp(1.75rem, 3vw, 2.5rem)  / 1.0  / -0.04em  / 500
--text-metric-sm:  clamp(1.25rem, 2vw, 1.5rem)   / 1.1  / -0.03em  / 500
--text-stat:       0.75rem                       / 1.0  / 0.02em    (tabular-nums)
```

### Typography Hierarchy Rules

1. **Display > H1 > H2 > H3**: Each step down reduces size by ~15%
2. **Weight consistency**: Headings stay at 500 (medium), never bold
3. **Tracking progression**: Display tightest (-0.04em), labels loosest (+0.06em)
4. **Line-height progression**: Display tightest (1.05), body relaxed (1.6)

---

## 4. Spacing System v2.0

### Base Unit: 4px

```css
--space-px:   1px
--space-0-5:  2px
--space-1:    4px
--space-1-5:  6px
--space-2:    8px
--space-2-5:  10px
--space-3:    12px
--space-3-5:  14px
--space-4:    16px
--space-5:    20px
--space-6:    24px
--space-7:    28px
--space-8:    32px
--space-9:    36px
--space-10:   40px
--space-12:   48px
--space-14:   56px
--space-16:   64px
--space-20:   80px
--space-24:   96px
--space-32:   128px
```

### Section Rhythm

```css
/* Between major sections — varies for breathing */
--section-gap-hero:     48px   (after hero, into primary)
--section-gap-primary:  40px   (after primary panels)
--section-gap-row:      32px   (between grid rows)
--section-gap-pair:     24px   (between related panels)

/* Within sections */
--component-gap:        20px   (between related components)
--element-gap:          12px   (between related elements)
--item-gap:            8px    (between list items)
```

---

## 5. Surface System v2.0 — "Floating & Layered"

### Surface Hierarchy (7 levels, not 6)

| Surface | Purpose | Visual |
|---------|---------|--------|
| `surface-void` | Deepest background | `#090a0d`, no border, no shadow |
| `surface-base` | Page background | `#0d0e12`, subtle gradient |
| `surface-layer` | Section containers | `#111318`, border-subtle |
| `surface-raised` | Primary cards | `#16181e`, border-default |
| `surface-floating` | Elevated cards, panels | `#1c1f26`, shadow-md, border-default |
| `surface-overlay` | Hover states, active | `#242730`, border-strong |
| `surface-glass` | Modals, dialogs | blur(20px), glass border |

### Surface Relationship Model

**Principle: Reduce explicit borders. Increase surface differentiation through:**
- Elevation difference (lighter = higher)
- Shadow presence (floating = elevated)
- Border transparency (stronger border = closer surface)
- Background color shift (subtle blue-black shift per level)

### Surface Classes

```css
/* Base surfaces */
.surface-base {
  background: var(--surface-base);
}
.surface-layer {
  background: var(--surface-layer);
  border: 1px solid var(--border-subtle);
}
.surface-raised {
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  transition: all var(--duration-fast) var(--ease-out);
}

/* Floating surfaces — the key to "floating OS" feel */
.surface-floating {
  background: var(--surface-floating);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-fast) var(--ease-out);
}
.surface-floating:hover {
  background: var(--surface-overlay);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-lg);
}

/* Merged surfaces — for grouped panels */
.surface-group {
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.surface-group-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
}
.surface-group-content {
  padding: var(--space-5);
}

/* Active surface — for runtime-active panels */
.surface-active {
  background: var(--surface-overlay);
  border-color: var(--border-accent);
}

/* Embedded surface — for nested content */
.surface-embedded {
  background: var(--surface-layer);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-md);
}
```

---

## 6. Border System v2.0

### Border Hierarchy

```css
/* Invisible to visible spectrum */
--border-none:     none
--border-subtle:   1px solid rgba(255, 255, 255, 0.04)   /* deep background separation */
--border-default:  1px solid rgba(255, 255, 255, 0.08)   /* standard card edge */
--border-strong:   1px solid rgba(255, 255, 255, 0.12)   /* elevated surface */
--border-accent:  1px solid rgba(122, 139, 168, 0.25)   /* active/selected */
--border-glow:    1px solid rgba(122, 139, 168, 0.4)     /* only for live indicators */
```

### Border Usage Rules

1. **Surfaces at same level**: `border-subtle` or none
2. **Card edge (raised)**: `border-default`
3. **Floating/elevated**: `border-strong`
4. **Active/selected**: `border-accent`
5. **Live indicators**: `border-glow` (only here, never elsewhere)

---

## 7. Color Palette v2.0 — "Atmospheric Depth"

### Background Layers

```
#090a0d  ← void (deepest)
#0d0e12  ← base (page)
#111318  ← layer (section)
#16181e  ← raised (card)          ← PRIMARY
#1c1f26  ← floating (elevated)
#242730  ← overlay (hover/active)
#2a2d38  ← highest (max elevation)
```

### Atmosphere System

```css
/* Primary atmosphere — cold blue from top */
.atmosphere-top {
  background: radial-gradient(
    ellipse 80% 50% at 50% -10%,
    rgba(122, 139, 168, 0.035) 0%,
    transparent 60%
  );
}

/* Secondary atmosphere — warm from bottom */
.atmosphere-bottom {
  background: radial-gradient(
    ellipse 60% 40% at 20% 100%,
    rgba(100, 90, 80, 0.025) 0%,
    transparent 50%
  );
}

/* Edge atmosphere — sidebar glow */
.atmosphere-sidebar {
  background: linear-gradient(
    90deg,
    rgba(122, 139, 168, 0.02) 0%,
    transparent 40%
  );
}

/* Content atmosphere — center diffusion */
.atmosphere-center {
  background: radial-gradient(
    ellipse 70% 60% at 50% 50%,
    rgba(122, 139, 168, 0.02) 0%,
    transparent 50%
  );
}
```

### Noise Texture

```css
/* Ultra-subtle noise for depth */
.noise {
  position: relative;
}
.noise::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.008;
  pointer-events: none;
  background-image: url("data:image/svg+xml,...");
}

/* Heavy noise for void areas */
.noise-heavy::before {
  opacity: 0.015;
}
```

---

## 8. Sidebar System v2.0 — "AI Workspace Rail"

### Design Goals

- **Thinner**: Reduced from 72px to 56px rail, 240px full sidebar
- **Lighter**: Less background weight, more transparency
- **More floating**: Shadow instead of border
- **Layered**: Company rail → Nav → Content have clear depth separation
- **Runtime-aware**: Active states feel like system indicators

### Sidebar Architecture

```
Company Rail (56px)     Nav Rail (expanded 240px)
┌────┐                 ┌──────────────────────┐
│ Logo│                │  Company Header       │
│     │                │  ─────────────────── │
│ Org │                │  Nav Section         │
│ Org │                │    • Item            │
│ Org │                │    • Item            │
│     │                │  ─────────────────── │
│  +  │                │  Nav Section         │
│     │                │    • Item            │
│     │                │  ─────────────────── │
└────┘                └──────────────────────┘
```

### Sidebar Tokens

```css
--sidebar-rail-width:  56px
--sidebar-width:       240px
--sidebar-bg:         rgba(15, 16, 21, 0.85)
--sidebar-border:     none
--sidebar-shadow:      4px 0 24px rgba(0, 0, 0, 0.4)
```

### Sidebar Classes

```css
/* Sidebar container */
.sidebar {
  background: var(--sidebar-bg);
  backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-subtle);
}

/* Nav item states */
.nav-item {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-out);
}
.nav-item:hover {
  background: var(--surface-overlay);
  color: var(--text-primary);
}
.nav-item.active {
  background: var(--surface-floating);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
.nav-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 16px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
}
```

---

## 9. Card System v2.0 — "Soft Panels"

### Principle: Reduce boxy feel through
1. **Variable border intensity** — not all cards equal
2. **Surface merging** — grouped panels share edges
3. **Invisible separation** — space, not borders
4. **Floating treatment** — cards that feel lifted, not boxed

### Card Classes

```css
/* Primary card — standard raised surface */
.panel {
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) var(--ease-out);
}
.panel:hover {
  background: var(--surface-floating);
  border-color: var(--border-default);
}

/* Floating panel — elevated, feels lifted */
.panel-floating {
  background: var(--surface-floating);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-fast) var(--ease-out);
}
.panel-floating:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

/* Grouped panels — share borders, merge visually */
.panel-group {
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.panel-group-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-layer);
}
.panel-group-body {
  padding: var(--space-5);
}

/* Merged row — cards with shared edges */
.panel-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0;
}
.panel-row > .panel {
  border-radius: 0;
  border: none;
  border-right: 1px solid var(--border-subtle);
}
.panel-row > .panel:first-child {
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
}
.panel-row > .panel:last-child {
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  border-right: none;
}
```

---

## 10. Layout Rhythm v2.0

### Grid System

```css
/* Dashboard layout — breathing rhythm */
.dashboard-layout {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap-hero);    /* 48px */
}

.row-hero {
  /* Hero section — full width, breathing room */
}

.row-primary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--section-gap-row);    /* 32px */
}

.row-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--section-gap-pair);   /* 24px */
}

.row-timeline {
  /* Full width, scrollable */
}
```

### Section Rhythm Values

```css
.section-rhythm-hero {    padding: var(--space-8) var(--space-6); }
.section-rhythm-wide {    padding: var(--space-6) var(--space-5); }
.section-rhythm-tight {   padding: var(--space-4) var(--space-4); }
```

---

## 11. Motion System v2.0 — "System Breathing"

### Timing Tokens

```css
--duration-instant:  40ms    /* micro-interactions */
--duration-fast:      120ms   /* hover states */
--duration-normal:    200ms   /* state changes */
--duration-slow:      320ms   /* panel transitions */
--duration-slower:    480ms   /* page transitions */

--ease-out:      cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1)
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-smooth:   cubic-bezier(0.4, 0, 0.2, 1)
```

### Motion Patterns

```css
/* Hover lift — subtle, not flashy */
.hover-lift {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}
.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Hover glow — for active/live indicators only */
.hover-glow {
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
.hover-glow:hover {
  box-shadow: 0 0 12px rgba(122, 139, 168, 0.15);
}

/* Status pulse — system breathing */
@keyframes status-breathe {
  0%, 100% { opacity: 0.5; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1); }
}
.status-live {
  animation: status-breathe 3s ease-in-out infinite;
}

/* Panel reveal */
@keyframes panel-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.panel-enter {
  animation: panel-reveal var(--duration-normal) var(--ease-out) both;
}
```

---

## 12. Status Indicators — Runtime Feel

### Status Dot System

```css
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-dot.running {
  animation: status-breathe 2s ease-in-out infinite;
}
.status-dot.idle { opacity: 0.4; }
.status-dot.error { background: var(--error); }
```

### Live Value Styling

```css
.live-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  transition: color var(--duration-fast) var(--ease-out);
}
.live-value.updated {
  color: var(--accent);
}
```

---

## 13. Dark Theme Refinement — "Quiet Depth"

### Anti-"Glowing Admin Panel"

**Problems to avoid:**
- Bright borders that "glow"
- High contrast card edges
- Blue/purple gradient overload
- Cyberpunk aesthetic
- Static dashboard feel

**Solution: "Quiet Depth"**
- Borders are subtle, almost invisible
- Elevation shown through background lightness shift
- Atmosphere through diffuse gradients, not glow
- Active states use accent color subtly, not intensely
- System feels "on" through breathing animations, not bright colors

### Dark Mode Tokens (Refined)

```css
.dark {
  /* Background — 6-layer depth */
  --surface-void:    #090a0d;
  --surface-base:    #0d0e12;
  --surface-layer:   #111318;
  --surface-raised:   #16181e;
  --surface-floating: #1c1f26;
  --surface-overlay:  #242730;
  --surface-glass:   rgba(22, 24, 30, 0.85);

  /* Text — 3 levels */
  --text-primary:     #e8e9ed;
  --text-secondary:   #8b8d96;
  --text-tertiary:    #5c5e66;
  --text-disabled:    #45474d;

  /* Accent — Muted, not glowing */
  --accent:           #7a8ba8;
  --accent-soft:      rgba(122, 139, 168, 0.1);
  --accent-subtle:    rgba(122, 139, 168, 0.06);

  /* Borders — Subtle, not glowing */
  --border-subtle:   rgba(255, 255, 255, 0.04);
  --border-default:  rgba(255, 255, 255, 0.08);
  --border-strong:  rgba(255, 255, 255, 0.12);
  --border-accent:  rgba(122, 139, 168, 0.2);
}
```

---

## 14. Ambient Shader Strategy

### Layered Atmosphere

```css
/* Base atmosphere — full page */
.page-atmosphere {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(ellipse 100% 80% at 50% -20%, rgba(122, 139, 168, 0.03) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(100, 90, 80, 0.02) 0%, transparent 50%);
}

/* Section atmosphere — per section */
.section-atmosphere {
  position: relative;
}
.section-atmosphere::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 80% 60% at 50% 50%, rgba(122, 139, 168, 0.015) 0%, transparent 70%);
  z-index: -1;
}

/* Card atmosphere — ambient glow */
.card-atmosphere {
  position: relative;
}
.card-atmosphere::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: radial-gradient(ellipse 60% 40% at 30% 30%, rgba(122, 139, 168, 0.04) 0%, transparent 60%);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
  pointer-events: none;
  z-index: -1;
}
.card-atmosphere:hover::before {
  opacity: 1;
}
```

---

## 15. Component Architecture — Motion-Ready

### Button States

```css
.btn {
  border-radius: var(--radius-sm);
  font-size: var(--text-body-sm);
  font-weight: 500;
  padding: var(--space-2) var(--space-4);
  height: 34px;
  transition: all var(--duration-fast) var(--ease-out);
}
.btn-primary {
  background: var(--accent);
  color: var(--surface-void);
  border: 1px solid transparent;
}
.btn-primary:hover {
  background: color-mix(in oklab, var(--accent) 85%, white);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: translateY(0);
}
.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.btn-secondary:hover {
  background: var(--surface-overlay);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
```

### Metric Display

```css
.metric-value {
  font-size: var(--text-metric);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.metric-label {
  font-size: var(--text-label);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.metric-trend {
  font-size: var(--text-stat);
  font-variant-numeric: tabular-nums;
}
.metric-trend.up { color: var(--success); }
.metric-trend.down { color: var(--error); }
```

### Input Fields

```css
.input {
  background: var(--surface-layer);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-body-sm);
  color: var(--text-primary);
  transition: all var(--duration-fast) var(--ease-out);
}
.input:focus {
  outline: none;
  border-color: var(--border-accent);
  background: var(--surface-raised);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input::placeholder {
  color: var(--text-disabled);
}
```

---

## 16. Implementation Roadmap

### Phase 1: Foundation Polish (Complete)
- [x] Dark mode colors with atmospheric depth
- [x] Typography scale
- [x] Spacing system
- [x] Radius system
- [x] Motion tokens

### Phase 2: Surface System (Complete)
- [x] Surface hierarchy classes
- [x] Card system v2
- [x] Panel system
- [x] Border refinement

### Phase 3: Layout Refinement (Current)
- [ ] Reduce boxy feel — panel merging
- [ ] Section rhythm — breathing gaps
- [ ] Sidebar refinement — AI Workspace Rail
- [ ] Hero → Runtime Status Surface

### Phase 4: Atmosphere & Polish
- [ ] Ambient shader layering
- [ ] Noise texture refinement
- [ ] Status indicator polish
- [ ] Motion-ready architecture

### Phase 5: Typography Polish
- [ ] Heading hierarchy refinement
- [ ] Metric typography
- [ ] Navigation typography
- [ ] Density-aware spacing

---

## 17. Anti-Patterns v2.0

1. **NO bright borders** — borders should almost disappear into the surface
2. **NO uniform card treatment** — cards need hierarchy through elevation
3. **NO static feel** — use breathing animations for live indicators
4. **NO cyberpunk glow** — restraint is key
5. **NO equal weight** — section importance should be visually distinct
6. **NO rigid grids everywhere** — let content breathe
7. **NO boxy containers** — prefer floating and merging surfaces

---

## 18. Reference Sources

| Source | What to Learn |
|--------|--------------|
| **variant.com** | Typography craft, hierarchy, tight tracking |
| **shadergradient.co** | Atmospheric depth without glow |
| **unicornplatform.com** | Restrained elegance, modern feel |
| **designspells.com** | Subtle interaction magic |
| **Linear** | Information density, status indicators |
| **Vercel** | Spacing rhythm, minimal borders |
| **Raycast** | Floating OS feel, sidebar polish |
| **OpenAI** | Calm confidence, spatial awareness |
