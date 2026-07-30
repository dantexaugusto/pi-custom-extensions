# 🔄 Gerenciamento de Sessões no Pi

## Visão Geral

O Pi tem **dois sistemas** de persistência trabalhando juntos:

### 1️⃣ Sistema Nativo (JSONL)
- **Armazena**: Árvore completa de mensagens com branching
- **Local**: `~/.pi/agent/sessions/<workspace>/*.jsonl`
- **Uso Principal**: Retomar conversas exatas com contexto

### 2️⃣ Nossa Extensão (SQLite)
- **Armazena**: Mensagens em banco relacional com FTS5
- **Local**: `~/.pi/agent/session-db/history.db`
- **Uso Principal**: Busca full-text, estatísticas, análise

---

## 🚀 Como Escolher e Carregar Sessões

### Método 1: Usar Scripts (Recomendado)

```bash
# Instale os aliases primeiro
source ~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-alias.sh

# Liste todas as sessões
pilist

# Saída:
# === SESSÕES NATIVAS (JSONL) ===
#   019fb05d | 2026-07-30 | 455 msgs | 1.5M
#   019fb0bf | 2026-07-30 | 11 msgs  | 6.1K
#
# Para retomar: pi --resume <id>

# Ver estatísticas
pistats

# Buscar no histórico
pisearch "persistência"

# Selecionar sessão interativamente
pi.pick()

# Retomar sessão específica
piresume 019fb05d
```

### Método 2: Comandos Nativos do Pi

```bash
# Listar sessões com detalhes
pi --resume
pi --list-sessions

# Retomar sessão específica (por ID ou partial)
pi --resume 019fb05d
pi --r 019fb0

# Usar arquivo específico
pi --session ~/.pi/agent/sessions/--home-ubuntu--/2026-07-30*.jsonl

# Continuar última sessão
pi -c "o que discutimos?"

# Nova sessão com nome
pi --name "Refatoração Auth"

# Fork (nova sessão derivada)
pi --fork 019fb05d
```

### Método 3: Scripts Manager Direto

```bash
cd ~/pi-custom-extensions/subagents_Bedrock_multimodel

# Ver todas as opções
./pi-session-manager.sh help

# Listar JSONL
./pi-session-manager.sh list-jsonl

# Listar SQLite
./pi-session-manager.sh list-sqlite

# Buscar
./pi-session-manager.sh search "configuração"

# Limpar sessões vazias
./pi-session-manager.sh cleanup
```

---

## 📊 Comparação: Quando Usar Cada Sistema

| O que você quer | Use | Comando |
|---------------|-----|---------|
| Retomar conversa exata | JSONL | `pi --resume <id>` |
| Buscar algo que foi dito | SQLite | `pisearch "termo"` |
| Ver custos/tokens | SQLite | `pistats` |
| Exportar para HTML | JSONL | `pi --export <arquivo>` |
| Analisar padrões | SQLite | SQL direto no `.db` |
| Branching de conversa | JSONL | `pi --fork <id>` |

---

## 🔍 Buscas Avançadas (SQLite)

```bash
# Abrir banco diretamente
sqlite3 ~/.pi/agent/session-db/history.db

-- Todas as mensagens de uma sessão
SELECT * FROM messages WHERE session_id LIKE '%019fb05d%' LIMIT 10;

-- Cost por sessão
SELECT s.id, COUNT(*) as msgs, SUM(m.cost) as total
FROM sessions s
JOIN messages m ON s.id = m.session_id
GROUP BY s.id;

-- Full-text search (FTS5)
SELECT * FROM messages_fts WHERE content MATCH 'persistência';
```

---

## 🛠️ Instalação Permanente

### Bash
```bash
echo 'source ~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-alias.sh' >> ~/.bashrc
```

### Zsh
```bash
echo 'source ~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-alias.sh' >> ~/.zshrc
```

---

## 💡 Dicas

1. **IDs de sessão**: Use os primeiros 8 caracteres (e.g., `019fb05d`)
2. **Caminhos**: Sessões JSONL incluem timestamp (e.g., `2026-07-30T01-59-23-796Z`)
3. **Limpei**: Use `pi-session-manager.sh cleanup` para remover vazias
4. **Backup**: O banco SQLite é um arquivo único - copie para backup

---

## 🐛 Solução de Problemas

### "Sessão não encontrada"
```bash
# Verifique se ID existe
find ~/.pi/agent/sessions -name "*<id>*" 2>/dev/null
```

### "Banco SQLite não existe"
```bash
# Execute uma sessão Pi primeiro para criar
pi --no-session "test"
# Ou manualmente
mkdir -p ~/.pi/agent/session-db
touch ~/.pi/agent/session-db/history.db
```

### "Comandos não encontrados"
```bash
# Verifique permissões
chmod +x ~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-manager.sh

# Ou use caminho completo
~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-manager.sh list
```