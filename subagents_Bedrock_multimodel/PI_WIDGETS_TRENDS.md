# Widgets e Extensões TUI para Pi Agent - Tendências 2026

## Visão Geral
Este documento sintetiza as melhores práticas, padrões populares e tendências para desenvolvimento de widgets e extensões TUI para o Pi agent, baseado na análise de exemplos oficiais e padrões de implementação.

## 1. Tipos de Widgets Mais Populares

### Status Lines (Linhas de Status)
✓ **Implementação mais segura e estável**
- `ctx.ui.setStatus()` para linha de rodapé persistente
- Temas automáticos via `ctx.ui.theme`
- Exemplo: `status-line.ts` - mostra contador de turnos com cores temáticas
- **Vantagem:** Não quebra layout, renderização segura, fácil manutenção

### Headers Personalizados
✓ **Substitui o cabeçalho padrão**
- `ctx.ui.setHeader()` para controle completo
- Renderização responsiva com `render(width): string[]`
- Componente renderizado dinamicamente
- Exemplo: `custom-header.ts` - mascote Pi com versão

### Footers Personalizados
✓ **Informações contextuais personalizadas**
- `ctx.ui.setFooter()` com acesso a dados via `footerData`
- Token stats, branch git, status de extensões
- Exemplo: `custom-footer.ts` - stats de tokens + branch git

### Widgets de Posicionamento
✓ **Widgets acima/abaixo do editor**
- `ctx.ui.setWidget()` com opções `placement: "belowEditor"`
- Não interfere com conteúdo principal
- Exemplo: `widget-placement.ts` - widgets acima e abaixo

### Overlays Modais
✓ **Componentes interativos sobrepostos**
- `ctx.ui.custom()` com `{ overlay: true }`
- Suporte a IME com `Focusable` interface
- Exemplo: `overlay-test.ts` - menus interativos com inputs inline

### Jogos e Entretenimento
✓ **Widgets interativos enquanto aguarda**
- Jogo Snake e Tic-Tac-Toe (`snake.ts`, `tic-tac-toe.ts`)
- DOOM overlay real-time (35 FPS)
- **Penetração:** Mantém usuário engajado durante processamento

## 2. Padrões de Implementação Seguros (Sem Crash de Largura)

### Limites de Renderização CRÍTICOS
```typescript
render(width: number): string[] {
  // NUNCA exceda width especificado
  // Use truncateToWidth e visibleWidth da pi-tui
}
```

### Biblioteca de Utilitários
```typescript
import { 
  truncateToWidth, 
  visibleWidth,      // Calcula largura visual (ANSI/wide chars)
  wrapTextWithAnsi   // Quebra texto mantendo cores
} from "@earendil-works/pi-tui"
```

### Validação Automática
- **ChatGPT:** Implemente sempre `visibleWidth()` para caracteres wide
- **Fallback:** Truncamento automático usando `truncateToWidth()`
- **Responsivo:** Use `%` em overlays vs valores fixos

### Exemplo de Renderização Segura
```typescript
render(width: number): string[] {
  const innerW = width - 2; // margens
  const content = theme.fg("accent", "Meu widget");
  const vis = visibleWidth(content);
  const padded = content + " ".repeat(Math.max(0, innerW - vis));
  return [truncateToWidth(padded, width)];
}
```

## 3. Bibliotecas e Componentes TUI Disponíveis

### Pacote Principal (@earendil-works/pi-tui)
```typescript
import {
  Component,             // Interface base de componentes
  Focusable,            // Interface para IME support
  Container,            // Componente container
  Text,                 // Componente de texto simples
  Box,                  // Bordas e layout
  CURSOR_MARKER,        // Marcador para cursor IME
  matchesKey,           // Helper para bindings de teclado
  visibleWidth,         // Largura visual (ANSI, wide chars)
  truncateToWidth,      // Truncamento seguro
  wrapTextWithAnsi      // Quebra de linha com cores
} from "@earendil-works/pi-tui";
```

### Componentes Built-in Usados pela Pi
- **Editor:** Componente de editor principal
- **Input:** Campo de entrada de texto
- **Select/Confirm:** Diálogos modais padrão
- **Menu:** Sistema de navegação

## 4. Exemplos de Código que Funcionam

### Widget Minimal Seguro
```typescript
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export default function(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWidget("safe-widget", (tui, theme) => ({
      render(width: number): string[] {
        const text = theme.fg("accent", "Widget seguro");
        // Sempre respeita width
        return [truncateToWidth(text, width)];
      },
      invalidate() {}
    }));
  });
}
```

### Overlay Responsivo com Edge Cases
```typescript
// Baseado em overlay-test.ts
class SafeOverlay implements Component {
  readonly width = 70; // Tamanho fixo, responsivo
  
  render(width: number): string[] {
    const lines = [];
    const innerW = Math.min(this.width, width - 4);
    
    // Testa edge cases sem crash
    lines.push(`Wide: ${"中文日本語한글テスト".slice(0, innerW)}`);
    lines.push(`Emoji: ${"👨‍👩‍👧‍👦🚀".slice(0, innerW)}`);
    
    return lines.map(line => truncateToWidth(line, width));
  }
  
  invalidate() {}
}
```

### Status Line com Cache de Performance
```typescript
// Baseado em custom-footer.ts com cache
class CachedStatusLine {
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private version = 0;
  private cachedVersion = -1;
  
  render(width: number): string[] {
    if (width === this.cachedWidth && this.cachedVersion === this.version) {
      return this.cachedLines;
    }
    
    this.cachedWidth = width;
    this.cachedVersion = this.version;
    this.cachedLines = [/* renderização segura */];
    
    return this.cachedLines;
  }
  
  invalidate() {
    this.version++;
  }
}
```

## 5. Tendências 2026

### Modularidade e Hot-Reload
- **Extensões auto-descobertas** (`~/.pi/agent/extensions/`)
- **Hot-reload** com `/reload` command
- **State persistence** via `details` em tool results

### Cross-Platform Compatibility
- **TUI/RPC/JSON** modos transparentes
- **IME Support** completo (chinês, japonês, coreano)
- **Hardware cursor** opcional para IME positioning

### Segurança e Controle
- **Permission gates** para dangerous commands
- **Path protection** contra writes acidentais
- **Git checkpointing** com recovery automático

### Performance e Caching
- **Render cache** (como custom-footer.ts)
- **Overlay responsive** com `minWidth`/`maxHeight`
- **Lazy rendering** de componentes pesados

### Interatividade Avançada
- **Games real-time** (DOOM 35 FPS)
- **Multi-step wizards** com state management
- **Custom editors** (vim-mode, rainbow editors)

## Recomendações Finais

### COMO FAZER:
1. **Sempre use `truncateToWidth` e `visibleWidth`**
2. **Teste com wide chars e emojis**
3. **Implemente cache de renderização para performance**
4. **Respeite `ctx.mode === "tui"` checks**

### O QUE EVITAR:
1. **Linhas que excedem `width` especificado**
2. **Widgets sem fallbacks responsivos**
3. **Hardcoded terminal dimensions**
4. **State sharing não persistente**

### BIBLIOTECAS RECOMENDADAS:
- **`@earendil-works/pi-tui`** - componentes TUI primários
- **`typebox`** - validação de parâmetros
- **Event system** - comunicação entre extensões

## Links de Referência
- `/examples/extensions/` - exemplos oficiais
- `docs/extensions.md` - API completa
- `docs/tui.md` - sistema de componentes TUI
- `custom-header.ts`/`custom-footer.ts` - exemplos de widgets estáveis

