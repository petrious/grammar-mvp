#!/bin/bash
# ============================================================
#  GrammarMVP — Setup & Start Script (versão Gemini Flash)
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    GrammarMVP — Gemini Flash Setup   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# 1. Python
echo -e "${YELLOW}[1/4] Verificando Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 não encontrado. Instale: https://python.org${NC}"; exit 1
fi
echo -e "${GREEN}✓ $(python3 --version)${NC}"

# 2. Criar venv e instalar dependências
echo ""
echo -e "${YELLOW}[2/4] Configurando ambiente virtual Python...${NC}"
if [ ! -d "backend/venv" ]; then
    python3 -m venv backend/venv
    echo -e "${GREEN}✓ venv criado em backend/venv${NC}"
fi
source backend/venv/bin/activate
pip install -r backend/requirements.txt -q
echo -e "${GREEN}✓ Dependências instaladas no venv${NC}"

# 3. API Key — aceita GOOGLE_API_KEY ou GEMINI_API_KEY
echo ""
echo -e "${YELLOW}[3/4] Verificando API Key do Gemini...${NC}"
if [ -n "$GOOGLE_API_KEY" ]; then
    echo -e "${GREEN}✓ GOOGLE_API_KEY encontrada no ambiente${NC}"
elif [ -n "$GEMINI_API_KEY" ]; then
    echo -e "${GREEN}✓ GEMINI_API_KEY encontrada no ambiente${NC}"
elif [ -f "backend/.env" ] && ! grep -q "SUA_CHAVE_AQUI" backend/.env; then
    echo -e "${GREEN}✓ Chave encontrada no backend/.env${NC}"
else
    echo -e "${RED}  ⚠ Nenhuma API Key encontrada!${NC}"
    echo -e "${YELLOW}  → Defina no terminal: export GOOGLE_API_KEY=sua_chave${NC}"
    echo -e "${YELLOW}  → Ou edite: backend/.env${NC}"
fi

# 4. LanguageTool
echo ""
echo -e "${YELLOW}[4/4] Verificando LanguageTool (Docker)...${NC}"
if command -v docker &> /dev/null; then
    if docker ps 2>/dev/null | grep -q "languagetool"; then
        echo -e "${GREEN}✓ LanguageTool já está rodando${NC}"
    else
        docker run -d --name languagetool -p 8010:8010 --restart unless-stopped erikvl87/languagetool 2>/dev/null || docker start languagetool 2>/dev/null
        sleep 3
        echo -e "${GREEN}✓ LanguageTool em localhost:8010${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Docker não encontrado — veja README.md${NC}"
fi

echo ""
echo -e "${BLUE}══════════════════════════════════════${NC}"
echo -e "${GREEN}  🌐 Abra: frontend/index.html${NC}"
echo -e "${GREEN}  📡 API:  http://localhost:8000${NC}"
echo -e "${GREEN}  📚 Docs: http://localhost:8000/docs${NC}"
echo -e "${BLUE}══════════════════════════════════════${NC}"
echo ""

cd backend && ../backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
