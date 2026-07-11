# 🔥 SDAI Manager — Contratos L3A

> **Sistema de Gestão Operacional para SDAI (Sistema de Detecção e Alarme de Incêndio)**  
> Plataforma web multi-cliente para gerenciamento técnico de centrais Bosch FPA/AVENAR em ambientes de grande porte (shoppings, condomínios, industrias).

---

## 📌 Visão Geral

O **SDAI Manager** é uma SPA (Single Page Application) de alto desempenho desenvolvida para a **L3A Engenharia**, rodando 100% no navegador com persistência híbrida: **localStorage** para operação offline e **Google Sheets via Apps Script** como banco de dados em nuvem — sem servidor dedicado, sem mensalidade de infraestrutura.

A plataforma suporta múltiplos clientes com bases de dados independentes. Cada cliente tem sua própria planilha Google Sheets e pode habilitar individualmente os módulos: **SDAI**, **CFTV**, **Controle de Acesso** e **Ambiente/Som**.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Pages                             │
│                     (index.html — SPA)                          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  SDAI    │  │  CFTV    │  │  Acesso  │  │  Ambiente    │   │
│  │  Module  │  │  Module  │  │  Module  │  │  Module      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                         ↕ localStorage (offline-first)          │
└─────────────────────────────┬───────────────────────────────────┘
                              │ fetch / JSONP (no-cors)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Google Apps Script (Code.gs — doGet/doPost)        │
│                                                                 │
│  ┌──────────────────────┐   ┌─────────────────────────────┐    │
│  │   Sheet Master       │   │   Sheet por Cliente (N)      │    │
│  │  ─ Clientes          │   │  ─ Painéis / Laços / FLMs   │    │
│  │  ─ Usuários Globais  │   │  ─ Falhas / Plano de Ação   │    │
│  │  ─ Histórico Global  │   │  ─ CFTV / Acesso / Ambiente │    │
│  └──────────────────────┘   │  ─ Plantas Baixas           │    │
│                             │  ─ Notificações             │    │
│                             └─────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Google Drive (fotos / plantas)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Stack:**
- **Frontend:** HTML5 + CSS3 + Vanilla JS (zero frameworks, zero build steps)
- **Backend:** Google Apps Script (serverless, deploy em 1 clique)
- **Banco de dados:** Google Sheets (1 planilha master + 1 por cliente)
- **Armazenamento de arquivos:** Google Drive
- **Hospedagem:** GitHub Pages (gratuita)

---

## 🚀 Funcionalidades

### 🔐 Autenticação e Perfis
| Perfil | Descrição |
|--------|-----------|
| **Master** | Acesso total: configura sistema, importa/exporta, gerencia usuários, backup |
| **Gestor** | Vê toda a operação; cria, edita e exclui falhas e planos de ação |
| **Operacional** | Registra falhas, atualiza status, conclui planos |
| **Visualizador** | Somente leitura + emissão de relatórios |

- Sessão por localStorage com ID de usuário
- Troca de senha obrigatória no primeiro login
- Controle granular de abas por perfil

### 🏢 Multi-clientes
- Seletor de cliente na sidebar — troca instantânea sem recarregar a página
- Base de dados 100% isolada por cliente (localStorage + Google Sheets separados)
- Módulos configuráveis por cliente: SDAI, CFTV, Acesso, Ambiente
- Usuários globais: a equipe L3A acessa todos os clientes com o mesmo login

### 🔥 SDAI (Sistema de Detecção e Alarme de Incêndio)
- Cadastro hierárquico: Painéis → Laços → FLMs/Módulos → Portas → Lojas/Equipamentos
- Rastreamento de falhas com histórico completo de status
- **Plano de Ação** (inspirado em SAP PM / ClickUp):
  - 4 KPIs em tempo real (Abertas, Em andamento, Concluídas, Atrasadas)
  - Filtros avançados por painel, laço, responsável, prazo, prioridade
  - Exportação para PDF (relatório gerencial)
  - Anexo de fotos diretamente no plano (upload para Google Drive)
- **Plantas Baixas** interativas: drag-and-drop de dispositivos, zoom, upload de imagem
- Importação em massa via planilha Excel (wizard de 3 etapas com validação)
- Auditoria automática Falhas ↔ Plano de Ação (1 falha = 1 plano, sempre)

### 📹 CFTV
- Cadastro de câmeras e gravadores com status (Operando / Falha / Offline)
- Filtros por tipo (câmera / gravador) e por falhas ativas
- IP, modelo, local e piso por equipamento

### 🔒 Controle de Acesso
- Portas, catracas, leitores, cancelas e centrais
- Status: Operando / Em falha / Bloqueado
- Painel de falhas ativas

### 🌡️ Ambiente / Som
- Sensores de temperatura, CO₂, fumaça ambiental
- Alto-falantes, amplificadores e controladores de sonorização

### 🔔 Notificações
- Central de notificações (sino no header) com badge de não lidas
- Notificações geradas automaticamente ao atribuir responsável em falhas/planos
- Marcação individual ou em massa como lida

### 📊 Relatórios
- Relatório de falhas por período com filtros customizados
- Relatório do plano de ação com KPIs
- Exportação PDF (print CSS otimizado)

### ☁️ Sincronização Google Sheets
- Sync automático configurável (intervalo em segundos)
- Anti-race: só um envio simultâneo; novos `markDirty()` enquanto synca reagendam automaticamente
- Verificação pós-sync: relê os dados do Sheets e compara contagens (detecta falha silenciosa no Apps Script)
- Token de segurança com hash SHA-256
- Upload de fotos via iframe oculto (contorna CORS do Google Apps Script)

---

## 📂 Estrutura de Arquivos

```
├── index.html          # SPA completa (~400 KB, auto-contida)
├── Code.gs             # Backend Google Apps Script
└── README.md
```

> O projeto inteiro é **2 arquivos**. Não há node_modules, não há bundler, não há CI/CD complexo.

---

## ⚙️ Deploy e Configuração

### 1. GitHub Pages

1. Faça fork ou clone este repositório
2. Acesse **Settings → Pages** e defina `main` / `root` como fonte
3. Aguarde o deploy — o sistema estará em `https://<seu-usuario>.github.io/<repo>/`

### 2. Google Apps Script (backend)

1. Acesse [script.google.com](https://script.google.com) e crie um novo projeto
2. Cole o conteúdo de `Code.gs` e salve
3. Clique em **Implantar → Nova implantação**:
   - Tipo: **Aplicativo da Web**
   - Executar como: **Eu mesmo**
   - Quem tem acesso: **Qualquer pessoa**
4. Copie a URL gerada
5. No sistema, acesse **Sistema → Banco de Dados** e cole a URL
6. Execute `testarSetup()` no editor do Apps Script para criar as planilhas e autorizar o Drive
7. Configure um token de segurança (mínimo 8 caracteres) em **Sistema → Token API**

### 3. Primeiro acesso

| Campo | Valor padrão |
|-------|-------------|
| Login | `admin@local` |
| Senha | `1234` |

> ⚠️ O sistema obriga a troca de senha no primeiro login.

---

## 🔒 Segurança

- **Token de API:** todas as requisições ao Apps Script exigem um token armazenado em `ScriptProperties` (nunca no código)
- **Senhas com hash SHA-256** (migração automática de senhas legadas em texto puro)
- **XSS:** toda string exibida passa pela função `esc()` antes de ser inserida no DOM
- **Controle de acesso por perfil:** PERM_MATRIX define quais ações cada perfil pode executar; rotas de render verificam `can(action)` antes de exibir/habilitar qualquer elemento
- **Modo offline-first:** dados nunca se perdem por queda de conexão — localStorage garante persistência local com throttle de 600ms

---

## 🗄️ Schema do Banco de Dados

### Sheet Master (global)
| Aba | Descrição |
|-----|-----------|
| `Clientes` | Cadastro de clientes com módulos habilitados |
| `Usuarios` | Usuários globais (compartilhados entre clientes) |
| `Historico_Global` | Auditoria cross-cliente |
| `Configuracoes` | Configurações do sistema |

### Sheet por Cliente (1 planilha por cliente no Drive)
| Aba | Descrição |
|-----|-----------|
| `Paineis` | Centrais de alarme |
| `Lacos` | Laços de detecção |
| `FLMs` | Módulos de campo (Field Line Modules) |
| `Portas` | Portas/canais dos FLMs |
| `Lojas_Areas` | Locais monitorados |
| `Equipamentos` | Detectores e acionadores |
| `Falhas` | Registro de falhas com histórico de status |
| `Plano_Acao` | Planos de ação vinculados às falhas |
| `Plantas` | Plantas baixas com metadados de imagem |
| `CFTV` | Câmeras e gravadores |
| `Acesso_Pontos` | Pontos de controle de acesso |
| `Ambiente_Equip` | Equipamentos de ambiente e som |
| `Notificacoes` | Notificações por usuário |
| `Historico` | Auditoria do cliente |

---

## 🧠 Decisões Técnicas Relevantes

**Por que Vanilla JS?**  
Zero dependências em runtime = zero atualizações de segurança forçadas, zero breaking changes de frameworks, zero tempo de compilação. O sistema roda em qualquer navegador moderno offline.

**Por que Google Sheets como banco?**  
Custo zero de infraestrutura, interface amigável para o cliente ver os dados direto, sem precisar de painel administrativo separado. Backup automático pelo próprio Google.

**Por que `no-cors` no fetch?**  
O Apps Script só responde em JSONP (GET) ou aceita POST sem preflight (Content-Type: text/plain). A resposta POST não é lida pelo frontend — só importa que chegou. Para GET com resposta, usamos JSONP com callback dinâmico.

**Por que throttle no `persistLocal`?**  
Escritas no localStorage síncronas dentro de um loop de render travam a UI. O throttle de 600ms agrupa todas as alterações de uma sequência de edições em uma única escrita, com flush forçado no `beforeunload`.

**Por que 1 falha = 1 plano de ação?**  
A função `sincronizarPlanosFalhas()` roda em todo carregamento de base (`normalizeAllStatuses`) garantindo integridade referencial mesmo em bases importadas ou corrompidas — sem precisar de transação.

---

## 📋 Changelog

| Versão | Data | Principais mudanças |
|--------|------|---------------------|
| v6.33 | Jul/26 | Multi-cliente, CFTV, Controle de Acesso, Ambiente, Code.gs v2 com Sheet por cliente |
| v6.32 | Jul/26 | Perfis v2 (Master/Gestor/Operacional/Visualizador), responsáveis do cadastro de usuários, central de notificações |
| v6.31 | Jul/26 | Remoção de 36 funções duplicadas (−130 KB), throttle no localStorage, XSS fix, wizard de importação, desfazer exclusão |
| v6.30 | Jul/26 | Plantas baixas interativas (drag-and-drop, zoom, upload) |
| v6.24 | Jul/26 | Plano de Ação redesenhado (KPIs, filtros compactos, PDF dropdown), fix MCDONALD'S, `sincronizarPlanosFalhas` |

---

## 🤝 Sobre o Projeto

Desenvolvido pela **L3A Engenharia** para gestão dos contratos de manutenção de SDAI.

- **Foco:** Bosch FPA-1200 / FPA-5000 / AVENAR 2000 / AVENAR 8000
- **Ambiente de referência:** Shopping Pantanal — Cuiabá/MT
- **Contato:** [helio@setupsolucoes.com](mailto:helio@setupsolucoes.com)

---

<div align="center">
  <sub>Built with ❤️ by L3A Engenharia · GitHub Pages + Google Apps Script · v6.33</sub>
</div>
