#!/bin/bash
# Session Manager for Pi coding agent
# Lists and manages both native JSONL and SQLite sessions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cmd="${1:-list}"

show_help() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           PI SESSION MANAGER                              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Comandos disponíveis:"
    echo ""
    echo -e "  ${GREEN}list${NC}                  Lista todas as sessões (JSONL + SQLite)"
    echo -e "  ${GREEN}list-jsonl${NC}            Lista sessões nativas JSONL"
    echo -e "  ${GREEN}list-sqlite${NC}           Lista sessões do banco SQLite"
    echo -e "  ${GREEN}resume <id>${NC}           Retoma sessão JSONL (por ID ou arquivo)"
    echo -e "  ${GREEN}search <termo>${NC}        Busca no histórico SQLite (full-text)"
    echo -e "  ${GREEN}stats${NC}                   Estatísticas de uso"
    echo -e "  ${GREEN}export <id> [file]${NC}    Exporta sessão para HTML"
    echo -e "  ${GREEN}cleanup${NC}                 Remove sessões vazias antigas"
    echo ""
}

list_jsonl() {
    echo -e "${BLUE}=== SESSÕES NATIVAS (JSONL) ===${NC}"
    echo ""
    
    local session_dir="${HOME}/.pi/agent/sessions"
    
    if [[ ! -d "$session_dir" ]]; then
        echo "Diretório de sessões não encontrado: $session_dir"
        return 1
    fi
    
    local count=0
    for dir in "$session_dir"/*; do
        [[ -d "$dir" ]] || continue
        local workspace=$(basename "$dir")
        
        for session in "$dir"/*.jsonl; do
            [[ -f "$session" ]] || continue
            
            local filename=$(basename "$session")
            local msgs=$(wc -l < "$session")
            local size=$(ls -lh "$session" | awk '{print $5}')
            local id=$(echo "$filename" | grep -o '[0-9a-f-]\{8\}-[0-9a-f-]\{4\}-[0-9a-f-]\{4\}-[0-9a-f-]\{4\}-[0-9a-f-]\{12\}' | head -1)
            local date=$(echo "$filename" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}')
            
            # Pega o nome da sessão (primeira linha do arquivo)
            local name=""
            if [[ $msgs -gt 0 ]]; then
                name=$(head -1 "$session" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','unnamed'))" 2>/dev/null || echo "unnamed")
            fi
            
            printf "  ${YELLOW}%-8.8s${NC} | ${GREEN}%-12s${NC} | %5s msgs | %5s | %s\n" \
                "$id" "$date" "$msgs" "$size" "$name"
            ((count++))
        done
    done
    
    echo ""
    echo "Total: $count sessões"
    echo ""
    echo -e "Para retomar: ${GREEN}pi --resume <id>${NC}"
    echo -e "Ou:          ${GREEN}pi --session <path>${NC}"
}

list_sqlite() {
    echo -e "${BLUE}=== SESSÕES SQLITE (Global) ===${NC}"
    echo ""
    
    local db_path="${HOME}/.pi/agent/session-db/history.db"
    
    if [[ ! -f "$db_path" ]]; then
        echo "Banco de dados não encontrado em: $db_path"
        echo "Execute uma sessão Pi para criar o banco."
        return 1
    fi
    
    # Cria tabela temporária para FTS5 se não existir
    sqlite3 "$db_path" ".mode column" ".headers on" "
        SELECT 
            substr(s.id, 1, 8) as id,
            COALESCE(NULLIF(s.name, ''), 'unnamed') as name,
            substr(s.project_path, 1, 30) as project,
            COUNT(m.id) as msgs,
            ROUND(s.total_cost, 4) as cost_usd,
            datetime(s.last_modified) as last_modified
        FROM sessions s
        LEFT JOIN messages m ON s.id = m.session_id
        GROUP BY s.id
        ORDER BY s.last_modified DESC
        LIMIT 20;
    " 2>/dev/null || echo "Erro ao consultar banco"
    
    echo ""
    echo -e "Para buscar no histórico: ${GREEN}pi-session-manager.sh search <termo>${NC}"
}

search_sqlite() {
    local term="${1:-}"
    
    if [[ -z "$term" ]]; then
        echo "Uso: pi-session-manager.sh search <termo>"
        return 1
    fi
    
    local db_path="${HOME}/.pi/agent/session-db/history.db"
    
    echo -e "${BLUE}=== BUSCANDO: \"${term}\" ===${NC}"
    echo ""
    
    sqlite3 "$db_path" ".mode column" 
        "SELECT 
            substr(m.session_id, 1, 8) as session,
            datetime(m.timestamp) as when,
            substr(m.content, 1, 80) as content_snippet
        FROM messages m
        WHERE m.content LIKE '%${term}%'
        ORDER BY m.timestamp DESC
        LIMIT 50;" 2>/dev/null || echo "Erro na busca"
}

show_stats() {
    echo -e "${BLUE}=== ESTATÍSTICAS ===${NC}"
    echo ""
    
    local db_path="${HOME}/.pi/agent/session-db/history.db"
    local session_dir="${HOME}/.pi/agent/sessions"
    
    # Stats JSONL
    local jsonl_count=$(find "$session_dir" -name "*.jsonl" 2>/dev/null | wc -l)
    local jsonl_size=$(du -sh "$session_dir" 2>/dev/null | cut -f1)
    
    echo "📁 SESSÕES NATIVAS (JSONL):"
    echo "   Total: $jsonl_count sessões"
    echo "   Tamanho: $jsonl_size"
    echo ""
    
    # Stats SQLite
    if [[ -f "$db_path" ]]; then
        local sql_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM sessions;" 2>/dev/null)
        local msg_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM messages;" 2>/dev/null)
        local total_cost=$(sqlite3 "$db_path" "SELECT ROUND(SUM(total_cost), 4) FROM sessions;" 2>/dev/null)
        local db_size=$(ls -lh "$db_path" | awk '{print $5}')
        
        echo "🗄️  SESSÕES SQLITE (Global):"
        echo "   Sessões: ${sql_count:-0}"
        echo "   Mensagens: ${msg_count:-0}"
        echo "   Custo total: \$${total_cost:-0}"
        echo "   Tamanho DB: $db_size"
    fi
    
    echo ""
}

resume_session() {
    local id="${1:-}"
    
    if [[ -z "$id" ]]; then
        list_jsonl
        echo ""
        echo "Digite o ID da sessão para retomar:"
        read id
    fi
    
    # Tenta encontrar o arquivo
    local pattern="${HOME}/.pi/agent/sessions/*/*${id}*.jsonl"
    local files=($pattern)
    
    if [[ ${#files[@]} -eq 0 ]] || [[ ! -f "${files[0]}" ]]; then
        echo "Sessão não encontrada: $id"
        return 1
    fi
    
    if [[ ${#files[@]} -gt 1 ]]; then
        echo "Múltiplas sessões encontradas:"
        for f in "${files[@]}"; do
            echo "  - $f"
        done
        return 1
    fi
    
    echo "Retomando sessão: ${files[0]}"
    pi --session "${files[0]}"
}

# Main
case "$cmd" in
    help|--help|-h)
        show_help
        ;;
    list|--list|-l)
        list_jsonl
        echo ""
        list_sqlite
        ;;
    list-jsonl|--jsonl)
        list_jsonl
        ;;
    list-sqlite|--sqlite)
        list_sqlite
        ;;
    search|--search|-s)
        search_sqlite "$2"
        ;;
    stats|--stats)
        show_stats
        ;;
    resume|--resume|-r)
        resume_session "$2"
        ;;
    export|--export|-e)
        if [[ -z "$2" ]]; then
            echo "Uso: pi-session-manager.sh export <session-id> [output.html]"
            exit 1
        fi
        pi --export "$2" "${3:-}"
        ;;
    cleanup|--cleanup)
        echo "Removendo sessões vazias..."
        find "${HOME}/.pi/agent/sessions" -name "*.jsonl" -size 0 -delete 2>/dev/null
        echo "✅ Limpeza concluída"
        ;;
    *)
        show_help
        ;;
esac