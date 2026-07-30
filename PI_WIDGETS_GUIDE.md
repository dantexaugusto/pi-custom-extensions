# Pi Widget System - Complete Guide

Based on official Pi documentation and examples from `@earendil-works/pi-tui`

## What are Widgets?

Widgets are UI components that extensions can render in the Pi TUI interface. They provide persistent or interactive visual elements alongside the chat.

## Types of Widgets

### 1. **Status Indicators** (`ctx.ui.setStatus`)
Persistent status text shown in the footer.

```typescript
pi.on("session_start", async (_event, ctx) => {
  const theme = ctx.ui.theme;
  // Set status
  ctx.ui.setStatus("my-widget", theme.fg("accent", "● Active"));
});

// Clear status
ctx.ui.setStatus("my-widget", undefined);
```

**Examples**: mode indicators, connection status, activity spinners

---

### 2. **Widgets Above/Below Editor** (`ctx.ui.setWidget`)
Persistent content panels positioned relative to the input editor.

```typescript
// Simple text widget (above editor by default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);

// Below the editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { 
  placement: "belowEditor" 
});

// Dynamic with theme
ctx.ui.setWidget("my-widget", (_tui, theme) => {
  const lines = items.map((item, i) =>
    item.done
      ? theme.fg("success", "✓ ") + theme.fg("muted", item.text)
      : theme.fg("dim", "○ ") + item.text
  );
  return {
    render: () => lines,
    invalidate: () => {},
  };
});

// Clear
ctx.ui.setWidget("my-widget", undefined);
```

**Examples**: todo lists, progress bars, custom panels

---

### 3. **Custom Footer** (`ctx.ui.setFooter`)
Replace the entire footer with custom content.

```typescript
pi.registerCommand("footer", {
  description: "Toggle custom footer",
  handler: async (_args, ctx) => {
    ctx.ui.setFooter((tui, theme, footerData) => {
      // Reactive to branch changes
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          // Data available from footerData:
          const branch = footerData.getGitBranch();
          const statuses = footerData.getExtensionStatuses();
          
          // Compute stats
          let input = 0, output = 0, cost = 0;
          for (const e of ctx.sessionManager.getBranch()) {
            if (e.type === "message" && e.message.role === "assistant") {
              const m = e.message as AssistantMessage;
              input += m.usage.input;
              output += m.usage.output;
              cost += m.usage.cost.total;
            }
          }

          const fmt = (n: number) => n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
          const left = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);
          const right = theme.fg("dim", `${ctx.model?.id || "no-model"} (${branch || "no-git"})`);
          
          return [`${left} ... ${right}`];
        },
      };
    });
  },
});

// Restore default
ctx.ui.setFooter(undefined);
```

**Data available via `footerData`**:
- `getGitBranch(): string | null` - current git branch
- `getExtensionStatuses(): ReadonlyMap<string, string>` - texts from `setStatus`
- `onBranchChange(callback)` - reactive callback

---

### 4. **Custom Editor** (`CustomEditor`)
Replace the input editor entirely (vim mode, emacs, etc.)

```typescript
import { CustomEditor } from "@earendil-works/pi-coding-agent";

pi.registerCommand("modal-editor", {
  description: "Switch to modal editor",
  handler: async (_args, ctx) => {
    ctx.ui.setEditorComponent(
      new CustomEditor({
        // Custom keybindings, rendering, etc.
      })
    );
  },
});
```

---

### 5. **Overlays** (Modal components)
Temporary UI that renders on top without clearing the screen.

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyDialog({ onClose: done }),
  { 
    overlay: true,
    overlayOptions: {
      width: "50%",          // 50% of terminal
      minWidth: 40,          // minimum
      maxHeight: "80%",      // maximum
      anchor: "center",      // 9 positions available
      offsetX: -2,
      offsetY: 0,
      margin: 2,             // or { top, right, bottom, left }
      visible: (w, h) => w >= 80,  // responsive
    },
    onHandle: (handle) => {
      // handle.focus()      - bring to front
      // handle.unfocus()    - release input
      // handle.setHidden()  - toggle visibility
      // handle.hide()       - remove permanently
    }
  }
);
```

---

### 6. **Working Indicator**
Customize the spinner shown while streaming responses.

```typescript
// Static indicator
ctx.ui.setWorkingIndicator({ 
  frames: [ctx.ui.theme.fg("accent", "●")] 
});

// Animated
ctx.ui.setWorkingIndicator({
  frames: [
    theme.fg("dim", "·"),
    theme.fg("muted", "•"),
    theme.fg("accent", "●"),
    theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});

// Hide entirely
ctx.ui.setWorkingIndicator({ frames: [] });

// Restore default
ctx.ui.setWorkingIndicator();
```

---

## Component Library

Import from `@earendil-works/pi-tui`:

```typescript
import { 
  Text, 
  Box, 
  Container, 
  Spacer, 
  Markdown,
  Image,
  matchesKey, 
  Key,
  CURSOR_MARKER,
} from "@earendil-works/pi-tui";

// Text with wrapping
const text = new Text("Hello", paddingX, paddingY, bgFn);

// Box with background
const box = new Box(paddingX, paddingY, bgFn);

// Vertical container
const container = new Container();
container.addChild(component);

// Empty space
const spacer = new Spacer(2);

// Markdown rendering
const md = new Markdown("# Title", paddingX, paddingY, theme);

// Images (Kitty, iTerm2, Ghostty, WezTerm, Warp)
const image = new Image(base64Data, "image/png", theme, { 
  maxWidthCells: 80, 
  maxHeightCells: 24 
});
```

---

## Creating Custom Components

```typescript
import { Component, Focusable, CURSOR_MARKER } from "@earendil-works/pi-tui";

interface MyComponent extends Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}

class MyInput implements Component, Focusable {
  focused: boolean = false;
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    return [`> ${before}${marker}\x1b[7m${cursor}\x1b[27m${after}`];
  }
  
  handleInput(data: string) {
    if (matchesKey(data, Key.enter)) {
      this.onSubmit?.();
    }
  }
}
```

---

## Best Practices

1. **Register commands after `session_start`** to avoid autocomplete crashes
2. **Dispose resources** in component `dispose()` method
3. **Use themes** for consistent colors: `theme.fg("accent", text)`
4. **Handle focus** properly for IME support (Chinese/Japanese/Korean input)
5. **Request re-renders** with `tui.requestRender()` when state changes
6. **Use visibleWidth()** for accurate width calculations with ANSI codes

---

## Theme Colors

Available theme functions:
- `theme.fg("accent", text)` - branded color
- `theme.fg("success", text)` - green
- `theme.fg("warning", text)` - yellow
- `theme.fg("error", text)` - red
- `theme.fg("dim", text)` - low contrast
- `theme.fg("muted", text)` - very low contrast
- `theme.bg("accent", text)` - background colors

---

## File Locations

**Documentation**:
- `/docs/tui.md` - Complete TUI documentation
- `/docs/themes.md` - Theme system
- `/docs/extensions.md` - Extension API

**Examples**:
- `examples/extensions/status-line.ts` - `setStatus`
- `examples/extensions/custom-footer.ts` - `setFooter`
- `examples/extensions/plan-mode/index.ts` - `setWidget`
- `examples/extensions/working-indicator.ts` - `setWorkingIndicator`
- `examples/extensions/overlay-qa-tests.ts` - Overlays
- `examples/extensions/modal-editor.ts` - Custom editor