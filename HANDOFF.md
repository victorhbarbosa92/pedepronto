# 📋 PedePronto PDV — Handoff Document

> **Para o próximo desenvolvedor / próxima sessão de Claude:** este documento contém TUDO que você precisa saber para continuar o projeto sem perder contexto.

**Última atualização:** 2026-06-02
**Versão atual:** 3.0.0
**Status:** Beta liberado para testes controlados
**Repo:** https://github.com/victorhbarbosa92/pedepronto
**Deploy:** https://pedepronto-40790.web.app
**Owner:** Victor Barbosa (victordarkxd@gmail.com)

---

## 🎯 O que é o PedePronto

Sistema PDV completo (PWA single-file HTML+JS+CSS) para bares, lanchonetes e restaurantes brasileiros. Roda em PC, tablet, celular Android e maquininhas (Mercado Pago Point). Backend: Firebase (Auth + Firestore + Hosting).

## 📁 Arquitetura

```
C:\Users\o_vic\pedepronto\
├── index.html              ← TUDO está aqui (~17.000 linhas, single-file)
├── sw.js                   ← Service Worker v3 (network-first + auto-update)
├── manifest.json           ← PWA manifest
├── firebase.json           ← Hosting + headers cache
├── .firebaserc             ← Project ID: pedepronto-40790
├── firestore.rules         ← Security rules
├── worker/
│   └── index.js            ← Cloudflare Worker (proxy Mercado Pago)
├── functions/              ← Cloud Functions (não usadas ativamente)
└── HANDOFF.md              ← Este arquivo
```

**Por que single-file?** Deploy ultra simples (1 arquivo no Firebase Hosting), zero build, fácil de auditar.

**Conseqüência:** Manutenção pesada. Sem testes automatizados. Mudança precisa ser cirúrgica.

---

## 🧩 Módulos principais (organize por nome de namespace)

| Módulo | Onde fica | O que faz |
|--------|-----------|-----------|
| `ST` | global state | Estado do app — `ST.cfg`, `ST.pedidos`, `ST.caixa`, etc. |
| `DB` | wrapper localStorage | `DB.get(k)`, `DB.set(k,v)` |
| `BT` | Bluetooth | Impressora térmica ESC/POS |
| `CXFLOW` | `~linha 4135` | **Fechamento de caixa profissional** (wizard 4 etapas + PDF + reabrir) |
| `PPCart` | `~linha 12940` | Comanda QR, divisão por item, comanda parcial |
| `PPInsights` | `~linha 13070` | IA estatística: picos atípicos, combo do dia, previsão demanda |
| `PPHaptic` | `~linha 13050` | Vibração tática (Android) |
| `PPSearch` | `~linha 14500` | Command palette / Ctrl+K |
| `PPOnboard` | `~linha 14600` | Tutorial primeira vez + checklist setup |
| `PPBeta` | `~linha 14400` | Termo aceite + lockout PIN + suporte WhatsApp + reportar bug |
| `LicCloud` | `~linha 14200` | **Controle remoto de licença via Firestore** (super admin liga/desliga) |
| `MAQ` | `~linha 11000` | Integração Mercado Pago Point (via Cloudflare Worker) |
| `_ppErrorLog` | global | Captura `window.onerror` → Firestore `/errors` |

**Convenção:** `_funcao` (underscore) = privada/interna. `Funcao` = exposta no escopo global.

---

## 🔐 Sistemas de segurança

### 1. Autenticação Firebase Auth
- Email/senha ou Google
- `fbAuth.currentUser` global
- `_estabUid` = UID do dono do estabelecimento

### 2. PIN do dono (4 dígitos)
- Salvo em `ST.cfg.pin`
- Lockout: 5 tentativas erradas = 5min, 10 erradas = 1h (`PPBeta.recordWrongAttempt`)
- Função `askPin(title, sub, cb)` / `requireOwnerPin(title, cb)`

### 3. Permissões por cargo
- `dono` / `gerente` / `caixa` / `cozinha` / `chefe_cozinha`
- Função `hasPermission('pdv'|'caixa_op'|'producao'|'cancelar'|...)`
- `_PAGE_PERMS` mapa controla acesso a páginas

### 4. Licença Cloud (NOVO — Beta)
- Coleção `/cloud_licenses/{estab_uid}` no Firestore
- Status: `active` | `suspended` | `blocked` | `expired`
- Plano: `beta_free` | `monthly` | `annual` | `lifetime` | `trial`
- Super admin controla via painel **Super Admin → Controle Beta**
- Cliente vê mudança em tempo real via `onSnapshot`
- Tela de bloqueio overlay fullscreen quando suspenso/bloqueado

### 5. Super Admin
- Email definido em `_SUPER_ADMIN_EMAIL`
- Painel completo em `nav('admin')`: Dashboard, Estabelecimentos, **Controle Beta** (novo), Licenças, Usuários, Ações
- Função `isSuperAdmin()` para checar

---

## 💾 Persistência de dados

### LocalStorage (cliente)
Todas as keys têm prefixo `pp_`:
- `pp_cfg`, `pp_pedidos`, `pp_caixa`, `pp_produtos`, `pp_categorias`, `pp_clientes`, `pp_funcionarios`, `pp_vouchers`, `pp_despesas`

### Firestore (cloud)
```
/estabelecimentos/{uid}
  /dados/principal           ← ST completo
  /backups/{YYYY-MM-DD}      ← Backup automático diário (mantém 7)
  /pedidos/{id}              ← Para comanda cliente público
/cloud_licenses/{uid}        ← Licenças (controle remoto)
/errors                      ← Erros capturados (window.onerror)
/bug_reports                 ← Reportes enviados via UI
/convites/{code}             ← Convites de funcionários
/user_map/{email}            ← Map email → estab_uid + cargo
```

### Sincronização
- `fsListen(uid)` — listener realtime em todos os dados
- `fsForcePush()` — sync imediato após save
- `enablePersistence()` — Firestore offline cache

---

## 🚀 Stack & Infra

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + JS vanilla (NÃO TEM framework, é proposital) |
| CSS | Variáveis customizadas + design tokens (`--surface-*`, `--r-*`, `--e-*`, `--ease-*`) |
| Backend | Firebase Hosting + Firestore + Auth (compat SDK v10.11.1) |
| Worker | Cloudflare Worker para proxy Mercado Pago API |
| Print | Web Bluetooth API (ESC/POS) |
| PWA | Service Worker v3 (network-first agressivo) |
| QR | api.qrserver.com (público) + QRCode.js (local) |
| AI | Suporta Groq / Anthropic / OpenAI / OpenRouter / custom (`ST.cfg.ai_agent`) |

---

## ⚡ Comandos essenciais

```powershell
# Deploy
firebase deploy --only hosting

# Run local
npx http-server . -p 8080

# Git
git add index.html
git commit -m "..."
git push origin main
```

**IMPORTANTE:** Sempre fazer `firebase deploy` + `git add + commit + push` ao final de cada tarefa.

---

## 🎨 Convenções de UI

### Layout
- **Desktop:** sidebar + main + topbar
- **Tablet paisagem (768-1280px):** sidebar slim 88px só ícones
- **Mobile (<768px):** sem sidebar, FAB voltar (esq), botão Menu na topbar
- **Maquininha (<400px):** layout horizontal, ícones grandes

### Topbar v3 (3 zonas)
- **Esquerda:** botão verde "Menu" (mobile) ou Logo (desktop)
- **Centro:** título da página + pills (offline/update) + ícones (tema, alertas, BT, sync, busca)
- **Direita:** badge caixa + botão vermelho "Fechar Caixa" (só quando aberto)

### Sidebar (6 seções únicas)
1. **Operação:** Início, Mesas, Balcão, Delivery, Produção
2. **Cadastros:** Cardápio, Clientes, Funcionários
3. **Financeiro:** Caixa, Despesas, Comissão
4. **Análises:** Dados, Relatórios, Avançadas
5. **Marketing:** Promoções
6. **Sistema:** Configurações, Agente IA, Super Admin

### Cores/temas
- Tema padrão: dark
- Temas extras: light, metro, metro-light, neon
- Toggle: botão lua/sol na topbar
- CSS tokens: `--surface-1/2/3`, `--text-1/2/3`, `--border-1/2/3`

---

## 📦 Funcionalidades implementadas (resumo)

### Operação
- ✅ PDV completo (mesas, balcão, delivery)
- ✅ Wizard de novo pedido (5 etapas mobile)
- ✅ Venda direta + Venda expressa (1 clique)
- ✅ KDS / Produção com tabs cozinha/bar
- ✅ Editar pedido em qualquer momento
- ✅ Comanda parcial impressa (extrato durante consumo)
- ✅ Comanda cliente em tempo real (QR + URL pública)
- ✅ Divisão de conta (igualmente ou por item)

### Financeiro
- ✅ Caixa com abertura/fechamento
- ✅ **CXFLOW**: Conferência profissional em 4 etapas (resumo, conferência por forma, movimentações, conclusão)
- ✅ Histórico de fechamentos com diferenças destacadas
- ✅ Export PDF do fechamento
- ✅ Reabrir caixa em até 60min (configurável)
- ✅ Passagem de turno (operador A fecha → B já abre)
- ✅ Comissão por atendente (% configurável)
- ✅ Despesas / contas a pagar
- ✅ Detector de padrão suspeito (forma sempre negativa)
- ✅ Alerta de sangria alta

### Pagamentos
- ✅ Dinheiro / Crédito / Débito / PIX / Voucher / Maquininha
- ✅ Mercado Pago Point (via Cloudflare Worker)
- ✅ PIX com QR Code gerado localmente
- ✅ Pagamento dividido em múltiplas formas
- ✅ Sangria e suprimento com histórico

### Cardápio & Clientes
- ✅ Produtos com foto, custo, preço, tempo, destinos, horário, estoque
- ✅ Categorias + grupos de obs/adicionais
- ✅ Vouchers e promoções automáticas (happy hour)
- ✅ Cardápio digital público (?menu=1)
- ✅ Clientes com pontos, tier (Pintinho/Bronze/Prata/Ouro), CRM
- ✅ Roleta premiada
- ✅ Sistema de fidelidade

### Inteligência
- ✅ **PPInsights**: picos atípicos, combo do dia, previsão de demanda
- ✅ Coach IA (briefing diário com dados reais)
- ✅ Agente IA conversacional (Groq/OpenAI/Anthropic)
- ✅ Agente WhatsApp delivery (Meta Business API)
- ✅ Análises avançadas: heatmap, ABC, comparativo

### Beta Safety (NOVO)
- ✅ **PPBeta**: banner permanente + termo de aceite bloqueante
- ✅ Lockout de PIN (5/10 tentativas)
- ✅ Canal de suporte WhatsApp + Modal reportar bug
- ✅ Backup automático para Firestore (diário)
- ✅ Captura de erros automática (`window.onerror`)
- ✅ **LicCloud**: super admin controla licenças em tempo real
- ✅ Tela de bloqueio quando suspenso/bloqueado

### UX / DX
- ✅ **PPSearch**: command palette (Ctrl+K) com fuzzy search
- ✅ **PPOnboard**: tutorial primeira vez (4 etapas + persona + checklist)
- ✅ Atalhos teclado físico (F1-F12, Ctrl+B/M/D/P, /)
- ✅ Auto-update inteligente (modal 3 opções: agora / fechar caixa / mais tarde)
- ✅ Service Worker v3 network-first
- ✅ Modo Garçom (tela cheia simplificada)
- ✅ Swipe-to-dismiss no carrinho mobile
- ✅ FAB voltar que sobe com teclado virtual (visualViewport)
- ✅ Design tokens centralizados
- ✅ Acessibilidade básica (aria-labels, alt, viewport zoom liberado)

---

## ⚠️ Bugs conhecidos e edge cases (cuidados)

### Limitações arquiteturais
1. **Single-file 17k+ linhas** — não escala bem. Refatorar em módulos requer setup de build.
2. **Sem testes automatizados** — toda validação é manual via `eval` no preview.
3. **Imagens base64 no localStorage** — limite ~10MB, restaurante com 50 produtos chega no limite.
4. **`innerHTML=` rebuilds** — performance ruim com 500+ pedidos no histórico.
5. **WhatsApp suporte** — número hardcoded em `PPBeta.SUPPORT_WHATSAPP = '5569991110000'` — **TROCAR** antes de liberar.

### Pendências legais/fiscais para venda comercial
1. **NFC-e** — obrigatório para restaurantes acima de R$ 360k/ano
2. **LGPD** — falta política de privacidade, termo, botão "esquecer cliente"
3. **PIX manual** — confirmação manual cria risco de fraude
4. **Sem domínio próprio** (está em `*.web.app`)

### Comportamentos atenção
- `recalcPedido()` agora inclui `obs_extras` (fix recente)
- `_itemPraDest()` suporta `dest` legado + `dests` array (multi-destino)
- `nav()` corrigido — `backNav` aponta pra página anterior real, não a antiga
- `esc()` agora é null-safe e escapa `"` e `'`
- `renderPedidoWizard()` tem guard para `ST.novoPedido` nulo

---

## 🛣️ Próximos passos sugeridos (ordem de prioridade)

### Curto prazo (1-2 semanas)
1. **Trocar número WhatsApp** em `PPBeta.SUPPORT_WHATSAPP`
2. **Testar pessoalmente** por 5+ dias rodando operação real
3. **Liberar para 3 amigos pilotos** com expectativa setada
4. **Monitorar coleções** `/errors` e `/bug_reports` diariamente

### Médio prazo (1 mês)
5. **NFC-e** — integrar com TecnoSpeed ou Focus NFe (~R$200-500/mês)
6. **LGPD** — termo de uso + política de privacidade + esquecer cliente
7. **Migrar fotos** de base64 para Firebase Storage
8. **Sentry** ou similar para captura profissional de erros

### Longo prazo (2-3 meses)
9. **Testes automatizados** (Playwright nos 10 fluxos críticos)
10. **Ambiente staging** separado
11. **Domínio próprio** + SSL
12. **Modelo de cobrança** (Stripe ou MP recorrente)
13. **Refatorar single-file** para módulos (Vite + esbuild)

---

## 🔧 Como continuar trabalhando

### Setup inicial
```powershell
cd C:\Users\o_vic\pedepronto
npx http-server . -p 8080
# Abrir http://localhost:8080
```

### Fluxo de mudança
1. Editar `index.html` (ou outro arquivo)
2. Validar no preview local
3. `firebase deploy --only hosting`
4. `git add . && git commit -m "..." && git push origin main`
5. Cliente recebe via auto-update do SW (modal "Nova atualização")

### Onde adicionar coisas novas
- **Nova feature visível:** considera criar módulo `PPXxxx` próprio
- **Novo render de página:** registra em `renders={}` dentro de `nav()` + adiciona `<div id="pg-xxx">`
- **Nova seção de config:** adiciona em `_cfgMenuItems()` + `case 'xxx':` em `_renderCfgSection()`
- **Novo atalho teclado:** edita `_initAtalhos()`
- **Novo comando busca global:** edita `PPSearch.collectAll()` adicionando ao array `comandos`

### Debugging
- Erros vão para `window._ppErrorLog` (últimos 20)
- Firestore tem `/errors` com últimos 50 por sessão
- Console: `PPInsights.detectarPicos()`, `CXFLOW.calcEsperadoPorForma()`, etc.

---

## 📞 Contatos

- **Owner:** Victor Barbosa
- **Email:** victordarkxd@gmail.com
- **WhatsApp suporte (placeholder):** 5569991110000 (TROCAR)
- **Repo:** github.com/victorhbarbosa92/pedepronto
- **Firebase Console:** console.firebase.google.com/project/pedepronto-40790

---

## 📜 Histórico de commits importantes

```
8d2c793 UI: reorganizar sidebar - 6 seções únicas
4c02fe2 Super Admin: Controle Beta (LicCloud)
f48fb08 Beta Safety: termo + backup + lockout + suporte
afa45dd Fix bugs críticos auditoria geral
40c6490 Big batch: comanda QR, divisão item, parcial, IA, vibração, tablet, atalhos
16b845a Sprint 2: design tokens + swipe + busca global + onboarding
3751eb8 CXFLOW: módulo profissional fechamento de caixa
7100742 Topbar v3 + FAB ajusta teclado
ff1f28d Auto-update agressivo: SW network-first
128684b Touch-first v3: botões 56px + gaveta + venda expressa
1563fd7 Sprint 1 fix: bugs perda de dinheiro + multi-destino + a11y
```

---

## 🎓 Para o próximo Claude

Quando você ler isso pela primeira vez:

1. **Antes de mudar qualquer coisa:** leia este HANDOFF inteiro
2. **Antes de implementar feature grande:** apresente plano expandido com sugestões antes (o owner prefere análise crítica)
3. **Sempre:** commit + push + deploy ao final de cada tarefa
4. **Em mudanças visuais:** valide com `preview_inspect` ou `preview_eval`
5. **Em mudanças funcionais:** rode testes manuais via `preview_eval` simulando edge cases
6. **NUNCA quebre:** o termo de aceite beta, o lockout PIN, o backup auto, a captura de erros — são camadas críticas
7. **Convenção de commit:** mensagem detalhada em PowerShell here-string sem parênteses (parser falha)

**Estilo de trabalho do owner:**
- Quer **análise crítica honesta** (não puxar sacos)
- Aprova rápido se a proposta for clara
- Quer comentários explicativos no código pra entender depois
- Prefere "fazer agora" a "planejar muito"
- Não tem medo de mudança grande se justificada

Boa sorte! 🚀
