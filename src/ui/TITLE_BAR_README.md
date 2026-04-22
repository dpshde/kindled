# Kindled Title Bar

An in-style title bar component following Kindled's design system (warm, paper-like, calm UI).

## Design System Alignment

- **Background**: `var(--color-bg)` - seamless with app shell
- **Typography**: `var(--font-scripture)` for title - elegant, warm serif
- **Borders**: `var(--color-line)` - subtle separation
- **Spacing**: Respects `env(safe-area-inset-top)` for mobile notches
- **Colors**: Uses paper-based solid color tokens (no alpha stacks)

## Tauri Configuration

The title bar is designed for macOS overlay mode:

```json
{
  "titleBarStyle": "Overlay",
  "trafficLightPosition": { "x": 16, "y": 16 },
  "decorations": true
}
```

## Usage

### Basic Title Bar

```typescript
import { titleBar, detectPlatform } from "../ui/title-bar";

const tb = titleBar({
  title: "Kindled",
  variant: "default",
  platform: detectPlatform(),
  isTauri: "__TAURI_INTERNALS__" in window,
});
```

### With Back Button

```typescript
const tb = titleBar({
  title: "Passage Title",
  variant: "passage",
  showBack: true,
  onBack: () => navigateBack(),
  platform: detectPlatform(),
  isTauri: true,
});
```

### Integration with App Shell

```typescript
import shell from "../ui/app-shell.module.css";

html`<div class="${shell.view}">
  ${titleBar({...})}
  <div class="${shell.withTitleBar} ${shell.shell}">
    <!-- Content here -->
  </div>
</div>`;
```

## Variants

- `default` - Clean, minimal (for threshold)
- `passage` - Larger title, emphasis (for passage view)
- `capture` - Minimal chrome, transparent border (for capture flow)
- `library` - Consistent with navigation (for library/hearth)

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| macOS (Tauri) | Native traffic lights, draggable region, 68px left spacing |
| Windows/Linux | Custom window controls (min/max/close), draggable region |
| Web/Mobile | No title bar (immersive experience) |

## Window Controls

On non-macOS platforms, the title bar provides custom window controls:
- Minimize: `-`
- Maximize: `⛶` (toggles with restore)
- Close: `×`

These use Phosphor icons and match Kindled's color system.

## Platform Detection

The app now sets `data-platform` on the HTML element:
- `macos` - macOS with Tauri
- `windows` - Windows with Tauri
- `linux` - Linux with Tauri
- `ios` - iOS web/PWA
- `android` - Android web/PWA
- `web` - Standard web

Use this for platform-specific CSS:

```css
html[data-platform="macos"] .my-element {
  padding-left: 80px; /* Account for traffic lights */
}
```

## Files

- `title-bar.ts` - Component implementation
- `TitleBar.module.css` - Component styles
- `title-bar-usage-example.ts` - Integration examples
- `icons/icons.ts` - Added minimize/maximize/close icons
- `icons/paths.ts` - Added icon paths for window controls

## Notes

- Uses `data-tauri-drag-region` attribute for draggable window
- Respects `prefers-reduced-motion` for accessibility
- Handles safe area insets for notched devices
- Back button includes haptic feedback via `hapticTrigger()`
