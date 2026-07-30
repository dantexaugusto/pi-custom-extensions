# Análise da Implementação de Widgets

## Nosso Widget Atual: `subagent-cost-widget.ts`

### ✅ O que está CORRETO

1. **Uso do setWidget**: Corretamente usa `ctx.ui.setWidget(WIDGET_NAME, renderWidget)`
2. **Eventos corretos**: 
   - `session_start` para inicializar ✅
   - `session_end` para limpar ✅
   - `tool_result_end` para atualizar dados ✅
3. **Renderização com theme**: Usa `theme.fg()`, `theme.bold()` corretamente
4. **Componentes TUI**: Importa e usa `Container` e `Text` do `@earendil-works/pi-tui`
5. **verificação hasUI**: Checa `ctx.hasUI` antes de usar UI ✅

---

### ❌ Problemas Encontrados

#### 1. **Formato do registerCommand ERRADO (pode crashar!)**

```typescript
// ❌ Nosso código (formato antigo, causa crash):
pi.registerCommand?.({
  name: "toggle-cost-widget",  // DENTRO do objeto - ERRADO
  description: "...",
  execute: (...) => ...         // 'execute' - ERRADO
});

// ✅ Correto (baseado na documentação):
pi.registerCommand?.("toggle-cost-widget", {  // String como primeiro arg
  description: "...",
  handler: async (...) => ...                 // 'handler' não 'execute'
});
```

**Risco**: Se alguém digitar `/` com este código carregado, pode crashar com `TypeError: value.startsWith is not a function`

#### 2. **Chamada de registerCommand no factory (não no session_start)**

```typescript
// ❌ Nosso código (registra no factory):
export default function subagentCostWidgetExtension(pi: ExtensionAPI) {
  pi.registerCommand?.(...); // Aqui! Pode crashar autocomplete
  pi.on("session_start", ...);
}

// ✅ Correto (registra no session_start):
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    pi.registerCommand?.(...); // Seguro aqui
  });
}
```

**Risco**: Como descobrimos, `registerCommand` no factory causa crash ao digitar `/`

#### 3. **Uso de `pi.getActiveContext()` é anti-pattern**

```typescript
// ❌ Nosso código:
const updateWidget = () => {
  pi.getActiveContext()?.then((ctx: ExtensionContext | undefined) => {
    ctx.ui.setWidget(...);
  });
};

// ✅ Correto (guardar ctx do evento):
pi.on("session_start", async (_event, ctx) => {
  ctx.ui.setWidget(...);  // Usar ctx do evento
});
```

**Problema**: `getActiveContext()` pode retornar contexto errado ou undefined

---

### ⚠️ Melhorias Sugeridas

#### 1. **Mover registerCommand para session_start**

```typescript
// Atualizar para:
pi.on("session_start", async (_event, ctx) => {
  if (!ctx.hasUI) return;
  
  pi.registerCommand?.("toggle-cost-widget", {
    description: "Toggle the subagent cost tracker widget visibility",
    handler: async (_args, cmdCtx) => {
      // Toggle logic usando cmdCtx.ui
      cmdCtx.ui.setWidget(WIDGET_NAME, renderWidget);
      cmdCtx.ui.notify?.("Widget shown", "info"); // not optional chaining
    },
  });
});
```

#### 2. **Usar setStatus para resumo rápido**

```typescript
// Adicionar status line para total de custo
pi.on("turn_end", async (_event, ctx) => {
  const theme = ctx.ui.theme;
  const cost = formatCost(stats.totalCost);
  ctx.ui.setStatus("subagent-total", theme.fg("accent", `💰 ${cost}`));
});
```

#### 3. **Melhorar acessibilidade do theme**

```typescript
// ❌ Nosso código usa 'any':
const renderWidget = (_tui: any, theme: any) => {

// ✅ Melhor:
import type { Theme } from "@earendil-works/pi-coding-agent";
const renderWidget = (_tui: unknown, theme: Theme) => {
```

#### 4. **Considerar setFooter para estatísticas detalhadas**

Para informações mais completas, podemos usar `setFooter` em vez de widget:

```typescript
// Footer alternativo para quando widget está escondido
pi.registerCommand?.("cost-footer", {
  description: "Show cost in footer",
  handler: async (_args, ctx) => {
    ctx.ui.setFooter((tui, theme, footerData) => ({
      invalidate() {},
      render(width: number): string[] {
        const left = theme.fg("dim", `Agents: ${stats.agents.size}`);
        const right = theme.fg("accent", `Total: ${formatCost(stats.totalCost)}`);
        return [`${left} ... ${right}`];
      },
    }));
  },
});
```

---

### 🎯 Resumo das Correções Necessárias

| Problema | Severidade | Ação |
|----------|-----------|------|
| `registerCommand` formato errado | 🔴 **Alto** - Crash | Corrigir para string + handler |
| `registerCommand` no factory | 🔴 **Alto** - Crash | Mover para session_start |
| `getActiveContext()` | 🟡 **Médio** - Bug | Usar ctx dos eventos |
| Types `any` | 🟢 **Baixo** - Qualidade | Usar `Theme` type |
| `execute` vs `handler` | 🔴 **Alto** - Crash | Renomear para `handler` |

---

### 🚀 Código Corrigido (Sugestão)

```typescript
// ... imports mantidos ...

export default function subagentCostWidgetExtension(pi: ExtensionAPI) {
  const stats: SessionStats = { ... };

  const renderWidget = (_tui: unknown, theme: Theme) => {
    // ... render code mantido ...
  };

  const updateStats = (...) => {
    // ... stats logic mantida ...
  };

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    
    // Reset stats
    stats.agents.clear();
    stats.totalCost = 0;
    // ...
    
    // Register widget
    ctx.ui.setWidget(WIDGET_NAME, renderWidget);
    
    // ✅ Register command AFTER session_start (safe)
    pi.registerCommand?.("toggle-cost-widget", {
      description: "Toggle cost widget",
      handler: async (_args, cmdCtx) => {
        cmdCtx.ui.setWidget(WIDGET_NAME, renderWidget);
        cmdCtx.ui.notify("Widget shown", "info");
      },
    });
    
    // Optional: set status indicator
    ctx.ui.setStatus("subagent-cost", ctx.ui.theme.fg("dim", "Cost: $0.00"));
  });

  pi.on("tool_result_end", (event, ctx) => {
    if (!ctx.hasUI) return;
    // ... process and update stats ...
    ctx.ui.setWidget(WIDGET_NAME, renderWidget); // ✅ Use ctx from event
  });

  pi.on("session_end", (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget(WIDGET_NAME, undefined);
    ctx.ui.setStatus("subagent-cost", undefined);
  });
}
```

---

### 📚 Referências

- `examples/extensions/custom-footer.ts` - setFooter pattern
- `examples/extensions/status-line.ts` - setStatus pattern
- `examples/extensions/plan-mode/index.ts` - setWidget with todos
- `/docs/tui.md` - Complete widget documentation