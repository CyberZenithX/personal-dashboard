# Daylog design rules

The UI is ported one-to-one from the *Daily Logs — Life Tracker App* design (7 desktop + 7 phone screens). When adding or
changing a screen, follow these rules. Tokens live in `src/components/ui.tsx` (`C`, fonts) and `src/app/globals.css` (theme variables).

## Principles
- **Dark, calm, one accent.** A near-black canvas, soft raised surfaces, and a single lime accent used for progress, primary actions and "done".
- **Every log is a reward.** Capture is always 1–2 taps (or one voice clip); XP, streak and score respond instantly with a toast.
- **Show state, not chrome.** Status is carried by colour, progress bars and counts rather than extra labels or icons.
- **No empty dead ends.** Every list has a short, friendly empty state that says what to do next.

## Colour
| Role | Value |
|---|---|
| Canvas / sidebar | `#0E1014` (`--bg`) / `#111318` |
| Surface / raised surface | `#181B22` / `#1F232C` |
| Borders | `#252A35` (cards), `#2D3240` (inputs, chips) |
| Text / muted / dim | `#E9ECF2` / `#A7AFBD` / `#8D96A6` |
| Accent (`--accent`) | `#C6F432` — text on accent is always `--bg` |
| Warm accent (`--accent2`) | `#FFB36B` — streaks, "needs attention" |
| Category colours | blue `#7FB2FF` tasks · amber `#FFC85C` notes/ideas · coral `#FF9E7A` journal/health · purple `#D59CFF` events · red `#FF7A6B` high priority |

- Accent tints are derived, never hard-coded: `color-mix(in srgb, var(--accent) 8% | 22% | 6% | 3%, var(--bg))` (`accentDim`, `accentLine`, `accentRow`, `accentRow2`).
- Themes (Night, Ocean, Dusk, Gold, Amethyst) only swap `--bg`, `--accent`, `--accent2`; they unlock by level.
- Colour is never the only signal: pair it with text, strike-through, or an icon. Text contrast ≥ 4.5:1.

## Type
- **Space Grotesk** for headings, numbers and the logo (700). **Inter** for everything else. **JetBrains Mono** for key caps and the prompt preview.
- Scale: page title 34 (phone 24–26) · card title 17–20 · body 14–15 · meta 12–13 · micro labels 11 uppercase with `.05em` tracking.

## Shape and spacing
- Radii: cards 18 · rows 12 · inputs/buttons 10–14 · chips and pills fully round · modals 24 · large badges 30.
- Cards: `1px` border, 22–26 px padding, 12–22 px gaps. Page padding `32px 40px` desktop, `24px 20px` phone.
- Row pattern: 22 px rounded-square checkbox (phone: circle) · title + meta line · tag pill · priority square · `+N XP`.
- Progress bars: 6–12 px tall, fully round, accent fill, `transition: width .5s`.

## Layout
- **Desktop (≥ 820 px):** fixed-feel sidebar (logo, nav, level card) + fluid main; cards in `auto-fit` grids.
- **Phone (< 820 px):** single column, bottom tab bar (Today · Tasks · mic · Notes · Progress) with a raised 58 px mic button; Today uses a capture bar instead; sheets slide up from the bottom.
- Phone and desktop are separate components that share data and logic; don't squeeze one layout into the other.
- Touch targets ≥ 44 px on phone; no scrollbars on phone, thin themed scrollbars on desktop.

## Interaction and motion
- Optimistic updates for toggles; server state replaces them. Settings save automatically (no save button) with a "Saving… / All changes saved" indicator.
- Motion is short and functional: toast in, sheet in, ring/bar fills, mic pulse. Respect `prefers-reduced-motion`.
- Keyboard first on desktop: rebindable shortcuts (T, N, E, Space, X, Shift+→, Ctrl+K). Phone: swipe right to finish, left to push, long-press for actions.
- Level-up is a full-screen moment (confetti only if "Celebrations" is on); sound only if "Sounds" is on.

## Accessibility
- Real `<button>`, `<a>`, `<input>` + label (visually hidden if needed); `aria-label` on icon-only buttons; `role="switch"`, `role="tab"`, `aria-pressed` for toggles.
- Modals use `role="dialog" aria-modal`, close on Esc and backdrop. Visible focus ring uses `--accent`.

## Content and tone
- Short, encouraging, concrete: "1 more check-in keeps your streak alive". No emoji, no filler, no invented stats.
- Anything not built yet stays visible but disabled with a **COMING SOON** badge (currently: Google Calendar).
