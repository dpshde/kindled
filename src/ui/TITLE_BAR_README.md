# Kindled Title Bar

An in-style title bar component following Kindled's design system (warm, paper-like, calm UI).

## Design System Alignment

- **Background**: `var(--color-bg)` - seamless with app shell
- **Typography**: `var(--font-scripture)` for title - elegant, warm serif
- **Borders**: `var(--color-line)` - subtle separation
- **Spacing**: Respects `env(safe-area-inset-top)` for mobile notches
- **Colors**: Uses paper-based solid color tokens (no alpha stacks)

## Native Shell Configuration

The title bar is designed for macOS overlay mode. The zero-native `app.zon` configures the window with title bar overlay support.

## Usage

### Basic Title Bar

```typescript
import { titleBar, detectPlatform } from "../ui/title-bar";

const tb = titleBar({
  title: "Kindled",
  variant: "default",
  platform: detectPlatform(),
  isNative: window.zero !== undefined,
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
  isNative: true,
});
```

## Variants

- `default` - Clean, minimal (for threshold)
- `passage` - Larger title, emphasis (for passage view)
- `capture` - Minimal chrome, transparent border (for capture flow)
- `library` - Consistent with navigation (for library/hearth)

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| macOS (native) | Native traffic lights, draggable region, 68px left spacing |
| Windows/Linux | Custom window controls (min/max/close), draggable region |
| Web/Mobile | No title bar (immersive experience) |

## Window Controls

On non-macOS platforms, the title bar provides custom window controls:
- Minimize
- Maximize (toggles with restore)
- Close

These use `window.zero.windows.*` APIs and Phosphor icons matching Kindled's color system.

## Platform Detection

The app sets `data-platform` on the HTML element:
- `macos` - macOS native shell
- `windows` - Windows native shell
- `linux` - Linux native shell
- `ios` - iOS web/PWA
- `android` - Android web/PWA
- `web` - Standard web

## Notes

- Uses `data-drag-region` attribute for draggable window
- Respects `prefers-reduced-motion` for accessibility
- Handles safe area insets for notched devices
- Back button includes haptic feedback via `hapticTrigger()`
