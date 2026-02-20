# GrammarMVP 🇧🇷
**Corretor de Português Brasileiro — LanguageTool local + Gemini Flash API**

> Detecção de erros 100% offline (LanguageTool) + reescrita inteligente via Gemini Flash (leve, rápido, gratuito com limites generosos).

---

## 🏗️ Arquitetura

```
[Browser: frontend/index.html]
         ↕  HTTP (localhost)
[FastAPI :8000  ←→  LanguageTool :8010]  ← 100% local
         ↕
   [Gemini Flash API]                     ← nuvem (só para reescrita)
```

| Componente       | Função                        | RAM aprox. |
|------------------|-------------------------------|------------|
| FastAPI          | API intermediária leve        | ~50 MB     |
| LanguageTool     | Correção gramatical pt-BR     | ~200 MB    |
| Gemini Flash API | Reescrita e explicações IA    | 0 MB local |
| **Total**        |                               | **~250 MB**|

---

## ⚡ Instalação em 3 passos

### Passo 1 — Obter a API Key (gratuita)
1. Acesse https://aistudio.google.com/app/apikey
2. Clique em **"Create API Key"**
3. Copie a chave gerada

### Passo 2 — Configurar a chave
Edite o arquivo `backend/.env`:
```
GEMINI_API_KEY=cole_sua_chave_aqui
```

### Passo 3 — Rodar
```bash
chmod +x start.sh
./start.sh
```

Depois abra `frontend/index.html` no navegador. Pronto!

---

## 🚀 Start Manual (sem o script)

### Terminal 1 — LanguageTool
```bash
# Com Docker:
docker run -d -p 8010:8010 erikvl87/languagetool

# Sem Docker (Java):
java -cp languagetool-server.jar \
     org.languagetool.server.HTTPServer \
     --port 8010 --allow-origin "*"
```

### Terminal 2 — FastAPI
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Abra `frontend/index.html` no navegador.

---

## 🎯 Funcionalidades

**🔍 Verificar Erros** — LanguageTool analisa gramática, ortografia e concordância em pt-BR. Sugestões clicáveis aplicam a correção diretamente no texto.

**✨ Melhorar com IA** — Gemini Flash reescreve com o tom escolhido: Profissional (e-mails), Acadêmico (artigos) ou Informal (mensagens).

**💡 Explicar Erros** — Gemini explica didaticamente por que cada trecho está errado e como corrigir.

---

## 📡 API Endpoints

```
GET  /        → status + verifica se chave está configurada
POST /check   → verificar erros (LanguageTool, sem IA)
POST /rewrite → reescrever texto (Gemini Flash)
POST /explain → explicar erros didaticamente (Gemini Flash)
```

Documentação interativa: `http://localhost:8000/docs`

---

## 🐛 Problemas Comuns

**"Backend offline"** → Execute `./start.sh` ou inicie o uvicorn manualmente.

**"GEMINI_API_KEY não configurada"** → Edite `backend/.env` com sua chave.

**Erro 503 no /check** → Docker não está rodando ou LanguageTool não subiu ainda.

---

## 📦 Estrutura

```
grammar-mvp/
├── backend/
│   ├── main.py           # FastAPI (3 endpoints)
│   ├── requirements.txt  # 5 dependências Python
│   └── .env              # sua GEMINI_API_KEY aqui
├── frontend/
│   └── index.html        # app completo (single file)
├── start.sh              # setup automático
└── README.md
```
