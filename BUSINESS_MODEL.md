# Fluent — Business Model & Commercialization Guide

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** Strategic Guide for Future Development

---

## **1. MODELO DE NEGÓCIO** 🏆

### **Visão Geral**
Fluent é uma extensão Chrome focada em melhorar a escrita multilíngue com IA. O modelo de negócio segue:
- **SaaS por quota de API**
- **Planos freemium com upsell para features premium**
- **Backend próprio gerenciando acesso à Gemini API**

### **Fluxo de Receita**

**Opção A: Planos Mensais Fixos (Recomendado)**
```
Free - R$ 0/mês
├─ 100 requisições/mês
├─ Text Improvement ✓
├─ Fluentify ✓
├─ Explain ✓
└─ Sem histórico

Pro - R$ 9,99/mês
├─ 5.000 requisições/mês (~160/dia)
├─ Todas as features Free
├─ Histórico de melhorias
├─ Prioridade no suporte
└─ Tone customization

Premium - R$ 29,99/mês
├─ Requisições ilimitadas
├─ Todas as features
├─ API pública para devs
├─ Integração Slack Bot
├─ Email + chat suporte 24/7
└─ Features beta primeiro
```

**Opção B: Pay-as-you-go (Alternativa)**
- Free tier: 100 req/mês
- Depois: $0.001 por requisição (1 senha = $0.01)
- Ideal para usuários leves

**Recomendação:** Opção A (mais previsível, melhor retenção)

---

## **2. EXPERIÊNCIA DO USUÁRIO** 👥

### **Onboarding (Primeiras 24h)**

1. **Splash Screen ao Instalar**
   ```
   "Bem-vindo ao Fluent! 🚀

   Melhor sua escrita em:
   - Slack, Gmail, LinkedIn, Twitter, etc.

   Quer começar?"

   [Criar Conta] [Uso Offline - Trial 7 dias]
   ```

2. **Setup Wizard (2 min)**
   - Selecionar idioma de escrita (English, Português, etc.)
   - Selecionar idioma nativo (para Explain)
   - Selecionar tone padrão (Casual, Professional, Executive)
   - Skip opção

3. **Primeiro Uso**
   - Tooltip aparece com dica: "Clique em 'Apply' para aceitar"
   - Analytics track: conversão de sugestão → aceita/rejeita

### **Dashboard de Uso**
(Via options page expandido)

```
Fluent Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seu Plano: Free (100/mês)
Requisições este mês: 23/100 (23%)

📊 Esta semana:
- 23 melhorias
- 15 aceitas (65%)
- 8 rejeitadas

🎯 Seus padrões:
- Esquece "s" em plurais: 3 erros
- Mistura PT/EN: 5x
- Tom preferido: Casual (70%)

[Upgrade para Pro] [Ver Histórico Completo]
```

### **Notificações & Feedback**
- ✅ Toast: "Sugestão aplicada!"
- ⏱️ "Demorando... tentando novamente"
- ❌ "Quota atingida. Próximo reset: 7 dias"
- 💡 "Dica: você ativa Fluentify com Cmd+Click"

### **Documentação**
- Help bubble no popup ("O que é Fluentify?")
- README em PT+EN
- FAQ inline
- Video tutorial (Loom, 30s)

---

## **3. QUALIDADE TÉCNICA** ⚙️

### **Testes**

```bash
# Unit Tests (Jest)
jest core.test.js          # Tests para buildSystemPrompt, buildExplainPrompt
jest content.test.js       # Tests para getInputText, applyText

# Integration Tests
jest extension.integration.test.js  # Popup + Options + Content Script

# E2E Tests (Playwright)
playwright test e2e/        # Testa em sites reais (Gmail, Slack)
```

**Requisito para release:** >80% coverage

### **Performance**

```javascript
// Lazy load do core.js
if (!textImprovementEnabled && !fluentifyEnabled && !explainEnabled) {
  // Não injetar content script em sites não-configurados
}

// Cache agressivo
const settingsCache = {
  ttl: 5 * 60 * 1000,  // 5 minutos
  lastFetch: null,
  data: {}
}

// Debounce otimizado
const DEBOUNCE_MS = {
  fast: 800,      // Em inputs pequenos
  normal: 1500,   // Default
  aggressive: 3000 // Em abas com 100+ inputs
}
```

### **Error Handling**

```javascript
// Retry com exponential backoff
async function callGeminiWithRetry(text, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGemini(text);
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries) {
        const wait = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        await sleep(wait);
        continue;
      }
      if (err.status === 401) {
        // Token expirado
        notifyUser("Seu acesso expirou. Faça login novamente.");
        openAuthPage();
        return;
      }
      throw err;
    }
  }
}

// User-friendly messages
const errorMessages = {
  429: "Está demorando... Tentando novamente em 30s",
  401: "Sessão expirada. Faça login novamente.",
  500: "Erro no servidor. Tente mais tarde.",
  offline: "Sem conexão. Tente novamente quando online.",
  quotaExceeded: "Seu limite mensal foi atingido. Upgrade para Pro?"
}
```

### **Monitoring & Analytics**

```javascript
// Sentry para crashes
Sentry.init({ dsn: process.env.SENTRY_DSN });

// LogRocket para UX replay
LogRocket.init(process.env.LOGROCKET_ID);

// Custom analytics
analytics.track('suggestion_shown', {
  site: 'gmail.com',
  language: 'English',
  tone: 'casual',
  responseTime: 1200 // ms
});

analytics.track('suggestion_applied', {
  accepted: true,
  daysSinceInstall: 5,
  planType: 'free'
});

// Dashboard interno (admin only)
GET /api/admin/analytics
  ├─ Error rate (%)
  ├─ Avg response time (ms)
  ├─ Requests per second
  ├─ User retention (7/14/30 days)
  └─ Conversion rate (free → pro)
```

---

## **4. SEGURANÇA & PRIVACIDADE** 🔐

### **Privacy Policy Highlights**
- ✅ Não armazenamos API key Gemini no servidor
- ✅ Requisições proxy pelo backend (usuário nunca conecta direto)
- ✅ Histórico armazenado encrypted em DB
- ✅ Opção de deletar histórico 1-click
- ✅ GDPR/CCPA compliant (direito ao esquecimento)
- ✅ Sem rastreamento de terceiros (Google Analytics apenas, com consentimento)

### **Permissions Audit**

**Atuais (Problema):**
```json
"host_permissions": ["<all_urls>"]
```

**Melhorado (Solução):**
```json
"host_permissions": [
  "https://www.gmail.com/*",
  "https://web.whatsapp.com/*",
  "https://slack.com/*",
  "https://www.linkedin.com/*",
  "https://twitter.com/*"
]
```

**Com opção "Extensão nos meus sites favoritos":**
- User seleciona quais sites ativar
- Default: apenas Gmail, Slack, LinkedIn

### **Code Open Source**
- Publicar `/extension` + `/backend/auth` no GitHub (público)
- Keep `/backend/payment` privado (inclui Stripe keys)
- Builds verificáveis (GitHub Actions → Chrome Web Store)

---

## **5. DISTRIBUIÇÃO** 📦

### **Chrome Web Store Listing**

**Nome:** `Fluent — AI Writing Assistant`

**Descrição:**
```
Melhore sua escrita em qualquer site usando IA.

✨ Text Improvement — Sugestões automáticas de escrita
🌍 Multilingual — 12+ idiomas
💬 Explain — Traduza/Explique qualquer seleção
⚡ Lightning-fast — Respostas em <2s

Funciona em: Gmail, Slack, LinkedIn, Twitter, Discord, Teams...

Gratuito. Sem extração de dados. 100% privado.
```

**Screenshots (4x):**
1. Fluentify button em ação (Slack)
2. Text improvement tooltip
3. Explain feature com tradução
4. Settings com 3 toggles independentes

**Video:** 30s Loom demo (https://loom.com/fluentai)

**Keywords:**
- grammar checker, writing assistant, translator, text improvement
- english learning, language learning, multilingual
- ai writing, chatgpt alternative, grammarly

**Category:** Productivity

**Rating Target:** 4.5+ stars

### **Marketing**

**Phase 1 — Beta (1 mês)**
- Private beta com 100 users
- Feedback loop: Discord server
- Target: 10 PROs convertidos

**Phase 2 — Soft Launch (1 mês)**
- Product Hunt 🐰
- Twitter: "Show HN"
- Reddit r/languagelearning, r/productivity
- Email to Product Hunt subscribers

**Phase 3 — Scaled Growth (3+ meses)**
- Google Ads ($500/mês budget)
- Partnerships com language learning apps
- Affiliate program (20% commission)
- Content marketing: Blog posts, tutorials

---

## **6. FEATURES PREMIUM ROADMAP** ⭐

### **MVP Free (Agora)**
- ✅ Text Improvement
- ✅ Fluentify Button
- ✅ Explain (translate)
- ✅ Per-site disable
- ✅ 3 tones
- ✅ 12 languages

### **Phase 1 — Pro Features (2-3 meses)**
- 📜 **Histórico de Melhorias**
  - Storage: 30 dias (Free), unlimited (Pro)
  - UI: nova aba "History" nas Options
  - Export como CSV/PDF

- 🎯 **Tone Customization**
  - User define seu próprio tone
  - Salva como preset ("Meu tom de CEO")
  - Share presets com team

- 🔔 **Real-time Sync**
  - Settings sincronizam entre devices
  - Histórico sync (iCloud, Google Drive integration)

### **Phase 2 — Premium Features (3-6 meses)**
- 🤖 **Slack Bot**
  - `/fluent explain selected text`
  - `/fluent improve this draft`
  - Integration via OAuth

- 🔌 **API Pública**
  - Developers podem usar Fluent em apps
  - Webhook para webhook de sugestões
  - Pricing: Base $9.99 + $0.001/req

- 📚 **Learning Insights**
  - "Você tem tendência a misturar PT/EN"
  - "Melhorou 30% em gramática em 7 dias"
  - Spaced repetition para erros comuns

### **Phase 3 — Enterprise (6+ meses)**
- 🏢 **Team Workspace**
  - Shared style guide
  - Audit log de quem aceita/rejeita
  - Admin dashboard

- 🌐 **More Languages**
  - Árabe, Chinês (simplificado + tradicional)
  - Russo, Japonês (melhor support)

- 📱 **Mobile (Kiwix app)**
  - Extension para móvel
  - Integração com Gmail app, Twitter app, etc.

---

## **7. COMPLIANCE & LEGAIS** ⚖️

### **Documentos Necessários**

```
/legal/
├── terms-of-service.md
├── privacy-policy.md
├── privacy-policy.pt.md
├── gdpr-compliance.md
├── cookies-policy.md
└── attribution/
    └── google-gemini-api.md
```

**Pontos-chave:**

**ToS:**
- Proíbe: spam, scraping, uso ilegal
- Limita: abuso de API (rate limiting)
- Responsabilidades: conteúdo gerado pela IA pode ter erros

**Privacy:**
- Collect: usage analytics (qual site, qual feature)
- NOT Collect: conteúdo que o user escreve (arquivado localmente)
- Share: com Stripe (pagamento), Sentry (errors)
- NOT Share: com Google, com terceiros

**GDPR:**
- Direito ao esquecimento (botão "Delete all data")
- Data export (JSON com histórico)
- DPA com Stripe/AWS

---

## **8. INFRAESTRUTURA** 🏗️

### **Tech Stack Recomendado**

```yaml
Frontend:
  - Chrome Extension (JS/HTML/CSS) ✓ Já existe
  - Options page (React opcional, ou vanilla)
  - Dashboard (React + Vite)

Backend:
  - Node.js + Express OR Python (FastAPI)
  - Database: PostgreSQL (users, quotas, history)
  - Cache: Redis (rate limiting, settings)
  - File storage: AWS S3 (exports)

Authentication:
  - OAuth 2.0 (Google, GitHub)
  - JWT tokens (extension → backend)
  - Session storage: Redis

Payment:
  - Stripe (billing, subscriptions)
  - Stripe webhooks para quota updates

Monitoring:
  - Sentry (error tracking)
  - LogRocket (session replay)
  - DataDog (infra metrics)
  - CloudFlare (DDoS protection)

Deployment:
  - Docker + Docker Compose
  - GitHub Actions (CI/CD)
  - AWS (EC2 + RDS + ElastiCache)
    OR DigitalOcean (simpler, cheaper)
    OR Railway.app (easiest setup)
```

### **Database Schema (PostgreSQL)**

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  provider VARCHAR(50), -- 'google', 'github', 'email'
  plan_type VARCHAR(50) DEFAULT 'free', -- 'free', 'pro', 'premium'
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API Quotas
CREATE TABLE api_quotas (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  month VARCHAR(7), -- '2026-02'
  requests_used INT DEFAULT 0,
  requests_limit INT, -- 100 (free), 5000 (pro), unlimited (premium)
  reset_at TIMESTAMP
);

-- Improvement History
CREATE TABLE improvements (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  original_text VARCHAR(10000),
  improved_text VARCHAR(10000),
  site VARCHAR(255), -- 'gmail.com', 'slack.com'
  language VARCHAR(50),
  tone VARCHAR(50),
  accepted BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscription History
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plan_type VARCHAR(50),
  stripe_subscription_id VARCHAR(255),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  status VARCHAR(50) -- 'active', 'cancelled', 'expired'
);
```

---

## **9. PRIORIZAÇÃO PARA MVP COMERCIAL** 🎯

### **Fase 1 — Implementação (1-2 meses)**

**Semana 1-2: Backend Setup**
- [ ] Node.js + Express boilerplate
- [ ] PostgreSQL + migrations
- [ ] Docker compose untuk dev
- [ ] GitHub Actions (auto tests + deploy)

**Semana 3-4: Authentication**
- [ ] Google OAuth integration
- [ ] JWT tokens + refresh logic
- [ ] Login/signup page (web)
- [ ] "Connect Fluent" modal no popup

**Semana 5-6: Quotas & Billing**
- [ ] Stripe integration
- [ ] API quota tracking + enforcement
- [ ] Usage dashboard (basic)
- [ ] Webhook handlers (paid_subscription, failed_payment)

**Semana 7-8: Compliance**
- [ ] Privacy policy + ToS (legal review)
- [ ] GDPR delete endpoint
- [ ] Chrome Web Store assets (screenshots, video)

**Semana 9: Testing & Polish**
- [ ] Unit + integration tests
- [ ] Manual QA em Chrome Web Store
- [ ] Error handling + monitoring

**Week 10: Launch**
- [ ] Chrome Web Store submission
- [ ] Product Hunt launch
- [ ] Email to beta users

---

### **Fase 2 — Consolidação (3-4 meses)**

- [ ] Histórico de melhorias (UI + export)
- [ ] Analytics dashboard (admin)
- [ ] Email notifications (new tier reached)
- [ ] Slack Bot MVP
- [ ] Marketing: Google Ads, content

---

### **Fase 3 — Scale (6+ meses)**

- [ ] API pública
- [ ] Team workspace
- [ ] Enterprise support
- [ ] Mobile extension

---

## **10. MÉTRICAS DE SUCESSO** 📊

### **Year 1 Goals**

```
Users:
- Month 1: 100 (beta)
- Month 3: 5,000
- Month 6: 25,000
- Month 12: 100,000

Conversion:
- Free → Pro: 5%
- Free → Premium: 1%

Retention:
- 7-day: 40%
- 30-day: 25%
- 90-day: 15%

Revenue:
- Month 6: $2,000 MRR
- Month 12: $15,000 MRR (500 Pro @ $9.99 + 50 Premium @ $29.99)

NPS: 45+
```

### **Key Performance Indicators (KPIs)**

```
Product:
- Avg response time: <2s
- Error rate: <0.5%
- Feature adoption (Text Improvement): 70%+
- Feature adoption (Explain): 40%+
- Acceptance rate: 60%+ (user clica "Apply")

Growth:
- DAU/MAU ratio: 30%+
- Feature discovery: 80% users discover all 3 features within 7 days
- Referral rate: 10% of new users come from existing users

Business:
- CAC (Customer Acquisition Cost): <$2
- LTV (Lifetime Value): >$50
- Payback period: <3 months
- Gross margin: 70%+
```

---

## **NEXT STEPS** 🚀

1. **Validar mercado** (2 semanas)
   - Entrevistas com 10 users potenciais
   - Survey em r/languagelearning (100 responses)
   - Pricing feedback

2. **Prototipar backend** (1 semana)
   - Setup PostgreSQL local
   - Primero endpoint: autenticação Google
   - Testar fluxo login → extension

3. **MVP beta** (4 semanas)
   - Convidar 50 beta users
   - Coletar feedback
   - Iterar no UX

4. **Submeter Chrome Web Store** (2 semanas)
   - Preparar assets
   - Legal review
   - Submit + esperar approval (3-7 dias)

5. **Soft Launch** (1 semana)
   - Product Hunt
   - Twitter, Reddit
   - Email pré-launch list

---

## **Contatos & Recursos**

- **Stripe Docs:** https://stripe.com/docs/stripe-js/elements
- **Chrome API:** https://developer.chrome.com/docs/extensions/
- **GDPR Compliance Kit:** https://gdpr.eu/
- **Sentry:** https://sentry.io/
- **LogRocket:** https://logrocket.com/

---

**Última Atualização:** Fevereiro 2026
**Próxima Revisão:** Junho 2026
**Responsável:** @petrious
