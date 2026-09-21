# 📖 Manual de Utilização — Automação Diária do Instagram
**Conta Oficial:** [@thebackenddrop](https://www.instagram.com/thebackenddrop/)  
**Versão da Esteira:** 1.0 (Dark Glassmorphism Edition)

---

## 📑 Índice
1. [Visão Geral](#-1-visão-geral)
2. [Primeiros Passos e Inicialização](#-2-primeiros-passos-e-inicialização)
3. [Guia Completo do Painel Web (Dashboard)](#-3-guia-completo-do-painel-web-dashboard)
   - [Aba 1: Visão Geral & Métricas](#aba-1-visão-geral--métricas)
   - [Aba 2: Laboratório & Prévia Instantânea](#aba-2-laboratório--prévia-instantânea)
   - [Aba 3: Histórico & Galeria](#aba-3-histórico--galeria)
   - [Aba 4: Chaves & Configurações](#aba-4-chaves--configurações)
4. [Entendendo os Modos de Execução (Produção vs Dry-Run)](#-4-entendendo-os-modos-de-execução)
5. [Comandos de Terminal (CLI)](#-5-comandos-de-terminal-cli)
6. [Executando 24/7 na Nuvem ou VPS (Docker & PM2)](#-6-executando-247-na-nuvem-ou-vps)
7. [Perguntas Frequentes & Resolução de Problemas](#-7-perguntas-frequentes--resolução-de-problemas)

---

## 🌟 1. Visão Geral

Esta automação é um sistema completo e autônomo para criação, design e publicação diária no Feed do Instagram da conta **@thebackenddrop**, focado em conteúdos técnicos de Engenharia de Software, Backend e System Design.

### Principais Pilares do Motor:
- **Inteligência Artificial (Google Gemini Flash):** Cria tópicos originais sem repetições (consultando os últimos 15 posts do histórico local).
- **Renderizador Gráfico Nativo HD (1080x1350):** Constrói a arte vertical de alto padrão gráfico localmente (zero custos com APIs de terceiros).
- **Publicação Direta na Meta Graph API (v21.0):** Cria os containers oficiais de mídia no feed e captura os links definitivos (*permalinks*).
- **Painel de Gestão Web Integrado:** Dashboard embutido no processo Node.js para visualização, disparos e ajustes em tempo real.

---

## 🚀 2. Primeiros Passos e Inicialização

### Pré-requisitos
- **Node.js**: Versão 20 ou superior instalada.
- Arquivo `.env` configurado com as chaves:
  - `GEMINI_API_KEY`: Chave do Google AI Studio.
  - `META_IG_ACCOUNT_ID`: ID da conta do Instagram (`17841429809097880`).
  - `META_ACCESS_TOKEN`: Token de longa duração da Meta Graph API.
  - `INSTAGRAM_USERNAME`: Nome de usuário da conta (`thebackenddrop`).

### Como Iniciar o Sistema
Basta executar no terminal da pasta do projeto:

```bash
npm start
```
*(ou se preferir: `npm run web`)*

> [!TIP]
> **No Windows PowerShell**, caso ocorra restrição de política de script do Windows, execute com `npm.cmd`:
> ```powershell
> npm.cmd start
> # ou diretamente com o Node:
> node src/index.js --web
> ```

### O que acontece ao iniciar?
O sistema sobe **dois serviços simultâneos no mesmo processo**:
1. **Servidor Web e API**: Ativo na porta `3000` (`http://localhost:3000`).
2. **Agendador Diário (Cron)**: Fica rodando em segundo plano aguardando o horário configurado (ex: `08:30` da manhã) para publicar sozinho.

---

## 🖥️ 3. Guia Completo do Painel Web (Dashboard)

Abra o seu navegador de preferência e acesse:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### Aba 1: Visão Geral & Métricas
É a tela de comando principal da esteira.

```
+-----------------------------------------------------------------------------------+
|  [Status: Sistema Ativo]   Agendado: 08:30   |   [Simular (Dry-Run)]  [Publicar]  |
+-----------------------------------------------------------------------------------+
|  CARDS DE MÉTRICAS:                                                               |
|  - Horário Diário: 08:30 (America/Sao_Paulo)                                      |
|  - Motor de IA: Gemini Flash                                                      |
|  - Total Publicado: 19 Posts                                                      |
+-----------------------------------------------------------------------------------+
|  ÚLTIMO POST PUBLICADO                                                            |
|  [ Imagem 1080x1350 ]    [TAG] Título do Post                                     |
|                          • Ponto 1                                                |
|                          • Ponto 2                                                |
|                          • Ponto 3                                                |
|                          Legenda: ...                                             |
|                          [🔗 Ver Post no @thebackenddrop ↗]                       |
+-----------------------------------------------------------------------------------+
```

- **Status do Sistema:** Ponto pulsante verde indica que o agendador está monitorando o relógio. Quando uma publicação estiver sendo gerada, o indicador muda para amarelo *"Processando Post..."*.
- **Botão "Publicar no Instagram Agora":** Dispara a esteira imediatamente para o feed real (com modal de confirmação).
- **Botão "Simular Teste (Dry-Run)":** Roda toda a esteira sem publicar no Instagram para teste seguro em 2 segundos.
- **Botão "🔗 Ver Post no @thebackenddrop ↗":** Abre diretamente o link do post oficial ou o perfil da conta.

---

### Aba 2: Laboratório & Prévia Instantânea
Espaço interativo para testar novas ideias de posts antes de disparar para os seguidores.

1. **Campo de Tema Personalizado:** Digite qualquer assunto que queira ver (Ex: *"PostgreSQL Connection Pooling com PgBouncer"*).
2. **Sugestões Rápidas:** Clique nos botões de atalho (*Kafka vs RabbitMQ*, *Caching Redis*, *Clean Architecture*, etc.) para preenchimento rápido.
3. **Botão "Gerar e Renderizar Prévia":**
   - A IA formula o conteúdo na hora.
   - O gerador gráfico desenha a arte vetorial e renderiza em alta definição.
   - O resultado é exibido dentro de um **mockup de smartphone**, simulando o feed real com cabeçalho de `@thebackenddrop`.
4. **Botão "📋 Copiar Legenda":** Copia o texto formulado pronto para a sua área de transferência.

---

### Aba 3: Histórico & Galeria
Exibe a grade visual de todos os posts já gerados e armazenados no banco local SQLite:

- Cada card exibe a miniatura da arte em alta definição, tag de assunto, pontos-chave e data/hora.
- **Botão "Ver no @thebackenddrop ↗":** Leva diretamente ao post correspondente no Instagram.
- **Botão "Atualizar Galeria":** Recarrega o histórico sem precisar atualizar a página inteira.

---

### Aba 4: Chaves & Configurações
Permite gerenciar todas as credenciais e parâmetros operacionais da esteira com segurança visual:

- **Google Gemini API:** Altere o modelo utilizado (`gemini-3.5-flash`, `gemini-3.8-flash`, etc.) e insira novas chaves de API. As chaves existentes são exibidas mascaradas (ex: `AIzaSy...4xK9`).
- **Botão "Testar Conexão do Gemini":** Faz um ping de validação em tempo real com os servidores da Google e lista os modelos disponíveis.
- **Meta Instagram API:** Visualize o ID da conta do Instagram (`17841429809097880`), gerencie o token e configure o username oficial (`thebackenddrop`).
- **Agendador Diário:** Defina o horário exato do disparo (ex: `08:30` ou `09:00`) e o fuso horário (`America/Sao_Paulo`).

> [!NOTE]
> Ao salvar qualquer alteração nas configurações, o sistema grava atomicamente no arquivo `.env` e atualiza a memória em tempo de execução sem reiniciar o servidor.

---

## 🧪 4. Entendendo os Modos de Execução

| Característica | Modo Produção (Real) | Modo Dry-Run (Simulação) |
| :--- | :--- | :--- |
| **Geração de Conteúdo com IA** | ✅ Sim (Google Gemini) | ✅ Sim (Google Gemini) |
| **Filtro Anti-Repetição (SQLite)** | ✅ Sim (Últimos 15 posts) | ✅ Sim (Últimos 15 posts) |
| **Renderização Gráfica HD** | ✅ Sim (1080x1350) | ✅ Sim (1080x1350 salva em `data/`) |
| **Upload para CDN de Imagens** | ✅ Sim (Upload público) | 🛑 Não (Sem upload externo) |
| **Publicação no Feed do Instagram** | 🚀 **SIM (Post Oficial)** | 🛑 **NÃO (100% Simulado)** |
| **Registro no Banco SQLite** | Gravado como `PUBLISHED` | Gravado como `SIMULATED` |
| **Tempo Médio de Execução** | ~30 a 60 segundos | ~2 segundos |

---

## 💻 5. Comandos de Terminal (CLI)

Se preferir utilizar a linha de comando sem a interface web:

### 1. Iniciar o Portal Web + Agendador (Padrão)
```bash
npm start
# ou: node src/index.js --web
```

### 2. Disparar uma publicação única imediata via CLI
```bash
npm run run:once
# ou passando um tema específico:
node src/index.js --run-once --theme "Estratégias de Idempotência em APIs"
```

### 3. Rodar uma simulação rápida (Dry-Run) via CLI
```bash
npm run run:dry
```

### 4. Executar os Testes Unitários Automatizados
Valida todo o ecossistema em 9 blocos (SQLite, renderizador gráfico HD 1080x1350, validações de config, Gemini multi-modelo, segurança Dry-Run, endpoints HTTP da API e scheduler com reagendamento):
```bash
node tests/pipeline.test.js
# ou via npm (no Windows PowerShell com restrição, utilize npm.cmd):
npm.cmd test
```

---

## ☁️ 6. Executando 24/7 na Nuvem ou VPS

Para deixar a automação operando 24 horas por dia, 7 dias por semana em um servidor (AWS, DigitalOcean, Hetzner, GCP ou VPS local):

### Opção A: Com Docker Compose (Recomendado)
O projeto já conta com [Dockerfile](file:///c:/Users/guria/OneDrive/Documentos/instagram-daily-automation/Dockerfile) e [docker-compose.yml](file:///c:/Users/guria/OneDrive/Documentos/instagram-daily-automation/docker-compose.yml) otimizados com volume persistente para o banco SQLite e **porta 3000 exposta para acesso ao Dashboard Web**:

```bash
# Iniciar em background
docker compose up -d

# Acessar o Dashboard Web no navegador:
# http://localhost:3000

# Ver logs em tempo real
docker compose logs -f

# Parar o serviço
docker compose down
```

### Opção B: Com PM2 (Process Manager)
```bash
# Instalar o PM2 globalmente
npm install -g pm2

# Iniciar o serviço com reinicialização automática em falhas
pm2 start src/index.js --name "instagram-automation" -- --web

# Configurar para iniciar junto com o boot do sistema operacional
pm2 startup
pm2 save
```

---

## ❓ 7. Perguntas Frequentes & Resolução de Problemas

### 1. "O horário agendado chegou, mas o post não foi publicado. O que verificar?"
- Certifique-se de que o processo `npm start` ou container Docker permaneceu em execução. Se o terminal for fechado, o agendador é interrompido.
- Verifique os logs no terminal ou no arquivo `.log`. Se o token da Meta expirou, a API retornará código 400 ou 401.

### 2. "Como renovar o token de acesso da Meta quando expirar?"
- Os tokens de longa duração duram em média **60 dias**.
- Acesse o [Meta for Developers Graph Explorer](https://developers.facebook.com/tools/explorer/).
- Gere um novo token com as permissões: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
- Cole o novo token na aba **Configurações** do seu Dashboard Web e clique em **Salvar Configurações da Meta**.

### 3. "O Gemini retornou erro temporário 503 (High Demand). O que a esteira faz?"
- A esteira possui algoritmo de resiliência embutido. Ela tenta novamente até 2 vezes com backoff exponencial e, se o modelo principal estiver sob pico de tráfego, aciona automaticamente os modelos de fallback (como `gemini-3.8-flash` e `gemini-3.5-flash-lite`).

### 4. "Onde as artes geradas ficam salvas localmente?"
- O último card renderizado em alta definição fica salvo em:  
  `data/latest-card-1080x1350.png`
- O histórico de todos os posts e seus links oficiais é mantido no arquivo:  
  `data/history.db`
