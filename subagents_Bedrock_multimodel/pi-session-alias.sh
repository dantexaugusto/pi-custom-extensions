#!/bin/bash
# Add to ~/.bashrc or ~/.zshrc for easy session management

# Quick aliases for session management
alias pilist='~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-manager.sh list'
alias pistats='~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-manager.sh stats'
alias pisearch='~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-manager.sh search'
alias piresume='~/pi-custom-extensions/subagents_Bedrock_multimodel/pi-session-manager.sh resume'

# Interactive session picker
pi.pick() {
    local sessions=$(ls -1t ~/.pi/agent/sessions/*/*.jsonl 2>/dev/null | head -20)
    if [[ -z "$sessions" ]]; then
        echo "Nenhuma sessão encontrada"
        return 1
    fi
    
    echo "Selecione uma sessão para retomar:"
    local i=1
    local ids=()
    while IFS= read -r session; do
        local msgs=$(wc -l < "$session")
        local date=$(basename "$session" | cut -d'_' -f1)
        local id=$(basename "$session" | grep -o '[0-9a-f-]\{8\}' | head -1)
        ids+=("$id")
        echo "  [$i] $date | $msgs msgs | $id"
        ((i++))
    done <<< "$sessions"
    
    echo ""
    echo -n "Escolha (1-$((i-1)) ou digite o ID): "
    read choice
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ $choice -ge 1 ]] && [[ $choice -lt $i ]]; then
        local idx=$((choice-1))
        piresume "${ids[$idx]}"
    else
        piresume "$choice"
    fi
}

echo "Alias adicionados: pilist, pistats, pisearch, piresume, pi.pick"
echo ""
echo "Uso:"
echo "  pilist         # Lista todas as sessões"
echo "  pistats        # Estatísticas de uso"
echo "  pisearch       # Busca no histórico"
echo "  piresume <id>  # Retoma sessão"
echo "  pi.pick()      # Seleciona sessão interativamente"