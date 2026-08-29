# Spec: Responsive layout for the studio playground

## Problem

At 375–768px the playground's left column (conversations + `AgentConfigPanel`) becomes an
in-page absolute overlay that duplicates the purpose of the existing `MobileDrawer`
(conversations) and `MobileBottomSheet` (config). Because `configOpen` initializes to `true`,
mobile users see a drawer/backdrop flash before hydration. The fixed bottom bar overlays the
composer, the header row does not wrap, and assistant code blocks force horizontal page
overflow.

## Proposed Solution

- Make the desktop left column desktop-only (`hidden` → `md:flex`) and drop the `md:hidden`
  backdrop + the absolute overlay classes entirely. Mobile has exactly one path per action:
  bottom bar → `MobileDrawer` for conversations, `MobileBottomSheet` for config.
- Gate the header "Show/Hide Panel" toggle and the horizontal `DragHandle` to `md:`+.
- Give the right column bottom clearance (`mb-16` on mobile) so the composer/logs sit above the
  fixed bottom bar.
- Let the header row wrap and truncate (agent name, provider·model) at small widths.
- Contain long words/code inside assistant bubbles: `break-words` on the markdown container and
  `overflow-x-auto` on `pre` blocks (the message list itself is `min-w-0`).

## Out of Scope

- Touch/drag gestures for the sidebar on mobile.
- Reworking `MobileBottomSheet` sizing (unchanged beyond existing behavior).
- Desktop sidebar behavior changes.

## Acceptance Criteria

- [ ] No drawer/backdrop flash before hydration at 375px; no in-page overlay on mobile
- [ ] Composer (textarea + send) fully visible and tappable above the fixed bottom bar
- [ ] Header row (agent, provider·model, token, Clear) never overflows at 375px
- [ ] Config reachable on mobile only via the bottom sheet; conversations only via the drawer
- [ ] Assistant message with a 600-char unbroken line inside a code fence causes no horizontal
      page overflow; the `pre` scrolls internally
- [ ] `e2e/responsive.spec.ts` covers the above; desktop side-by-side + toggle tests unchanged
- [ ] Lint, unit tests, and `npx playwright test e2e/responsive.spec.ts` pass

## Testing Strategy

- **E2E** (`responsive.spec.ts`): 375×812 assertions — header toggle hidden, no backdrop,
  config via bottom sheet, composer clearance via bounding boxes, and scroll-width equality
  after rendering a long code block; 1280×720 assertions unchanged.
- **Unit:** not applicable (presentational layout).

## Open Questions

None.