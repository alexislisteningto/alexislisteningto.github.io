---
name: alex is listening to
description: A handmade Web 1.0 window into Alex's music taste.
colors:
  paper: "#f6f0db"
  ink: "#181512"
  link: "#0000ee"
  visited: "#551a8b"
  rule: "#181512"
  error: "#9b1c1c"
typography:
  display:
    fontFamily: "Comic Sans MS, Comic Sans, cursive"
    fontSize: "clamp(2rem, 8vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.05
  body:
    fontFamily: "Comic Sans MS, Comic Sans, cursive"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px"
---

# Design System: alex is listening to

## Overview

**Creative North Star: "The Surviving Homepage"**

A personal homepage from the early web kept useful through careful modern engineering. The composition is direct, flat, and a little awkward on purpose. Dynamic album artwork and the color sampled from it provide all the visual spectacle the page needs.

The system rejects modern SaaS landing pages, portfolio templates, glassmorphism, gradients, rounded card grids, startup copy, and cinematic scroll effects.

**Key Characteristics:**
- Comic Sans throughout
- Native-looking controls with square corners
- Album art as content and atmosphere
- Dense, legible lists instead of cards
- Quiet responsive behavior with no decorative motion

## Colors

The fixed palette resembles a warm monitor-white page with default-browser link colors. The first viewport may replace the paper color with a sampled album-cover color while preserving readable ink.

### Primary
- **Old Monitor Paper:** The stable background below the first viewport and fallback during loading.

### Neutral
- **Soft Black Ink:** Primary text, rules, and control borders.
- **Browser Blue:** Unvisited links.
- **Visited Purple:** Visited links.
- **Plain Error Red:** Short validation and transport errors.

**The Album Owns the Hero Rule.** The current cover may set the first viewport background. Every other section remains stable and readable.

## Typography

**Display Font:** Comic Sans MS (with Comic Sans and cursive fallback)
**Body Font:** Comic Sans MS (with Comic Sans and cursive fallback)

**Character:** A single deliberately unfashionable family keeps the page candid and recognizable. Hierarchy comes from scale, spacing, and plain rules.

### Hierarchy
- **Display** (400, fluid 2rem to 4.5rem, 1.05): Current-listening statement.
- **Headline** (400, 2rem, 1.15): Section names.
- **Title** (400, 1.25rem, 1.3): Track and album titles.
- **Body** (400, 1rem, 1.5): Metadata, form labels, and messages.
- **Label** (400, 0.875rem, 1.4): Secondary details.

**The One Font Rule.** Comic Sans is identity, not decoration. Do not introduce a tasteful second family.

## Elevation

No shadows. Depth comes from album imagery, hard borders, and section background changes.

**The Flat Page Rule.** If an element looks lifted off the page, flatten it.

## Components

### Buttons
- **Shape:** Square corners (0px) with a visible 2px border.
- **Primary:** Warm paper background, soft black text, compact native proportions.
- **Hover / Focus:** Underline on hover where available; a clear 3px focus outline.

### Cards / Containers
- Album grids are unframed and use tiny gaps. Ranked albums are rows separated by a one-pixel rule. General-purpose cards are prohibited.

### Inputs / Fields
- **Style:** Visible label, square two-pixel border, warm paper background.
- **Focus:** High-contrast outline outside the border.
- **Error / Disabled:** Short connected message; controls remain legible.

### Navigation
- No site navigation. Normal underlined links are sufficient.

### Album Mosaic
- Nine square covers in an exact 3 by 3 grid. Repeated plays remain repeated. Captions must be available on focus and tap without depending on hover.

### Ranked Album Row
- Tabular rank, small square cover, album title, artist, and play count. One column on narrow screens and two compact columns when content allows.

## Do's and Don'ts

### Do:
- **Do** preserve Comic Sans, default-browser link conventions, hard edges, and slightly awkward directness.
- **Do** use real album art and Last.fm data.
- **Do** keep controls keyboard accessible with 44px touch targets.
- **Do** keep the first viewport focused on the current track.

### Don't:
- **Don't** use modern SaaS landing pages or portfolio templates as references.
- **Don't** use glassmorphism, gradients, rounded card grids, startup copy, or cinematic scroll effects.
- **Don't** add decorative cards, badges, pills, shadows, or icon bubbles.
- **Don't** smooth away the Web 1.0 personality.