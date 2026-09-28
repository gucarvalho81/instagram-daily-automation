# ⚡ Execução Autônoma no Windows com PM2

Este documento detalha a implementação e operação do **PM2 (Process Manager 2)** configurado para manter a automação do Instagram rodando 24/7 na máquina local, com recuperação automática de falhas e inicialização silenciosa com o Windows.

---

## 🎯 Objetivo da Implementação

Garantir que a esteira diária do Instagram e o Dashboard Web funcionem **sem intervenção manual**:
1. **Sem janelas de terminal abertas** ocupando a barra de tarefas.
2. **Auto-inicialização no boot do Windows**: ao ligar o computador e fazer logon, o serviço sobe silenciosamente.
3. **Resiliência e Auto-restart**: se o processo Node sofrer qualquer erro imprevisto ou crash de memória, o PM2 o reinicia instantaneamente.
4. **Gerenciamento de logs centralizado**: rotação e gravação contínua de saídas e erros em arquivos de log dedicados.

---

## 🏗️ Arquitetura dos Componentes

```
+-----------------------------------------------------------------------+
|                         BOOT DO WINDOWS                               |
|                                                                       |
|  [HKCU\...\CurrentVersion\Run]                                         |
|         │                                                             |
|         ▼                                                             |
|  wscript.exe invisible.vbs pm2_resurrect.cmd                          |
|         │                                                             |
|         ▼ (Execução silenciosa em background, sem prompt visível)    |
|  pm2 resurrect  --->  Restaura C:\Users\<user>\.pm2\dump.pm2          |
+-----------------------------------┬-----------------------------------+
                                    │
                                    ▼
+-----------------------------------------------------------------------+
|                          PM2 DAEMON                                   |
|                                                                       |
|  Processo: insta-daily-automation                                     |
|  Arquivo: ecosystem.config.cjs                                        |
|  Modo: fork (compatibilidade total com Node.js ES Modules)            |
|  Auto-restart: ON                                                     |
|  Limite de Memória: 500MB                                             |
|                                                                       |
|  ┌─────────────────────────────┐     ┌─────────────────────────────┐  |
|  │      Dashboard Web          │     │     Agendador (Cron)        │  |
|  │  http://localhost:3000      │     │  Diariamente às 08:30       │  |
|  └─────────────────────────────┘     └─────────────────────────────┘  |
|                 │                                    │                |
|                 ▼                                    ▼                |
|          logs/pm2-out.log                     logs/pm2-error.log      |
+-----------------------------------------------------------------------+
```

---

## 📁 Arquivos Criados e Modificados

### 1. `ecosystem.config.cjs`
Arquivo oficial de declaração de processos do PM2, otimizado para o projeto:

```javascript
module.exports = {
  apps: [
    {
      name: 'insta-daily-automation',
      script: './src/index.js',
      args: '--web',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork', // Obrigatório para projetos ES Modules ("type": "module")
      autorestart: true,
      watch: false,      // Evita reinícios cíclicos ao gravar imagens ou dados no SQLite
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
```

### 2. Inicialização Automática no Registro do Windows
Implementada via pacote `pm2-windows-startup`:
- **Chave de Registro:** `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
- **Valor:** `PM2`
- **Comando:**
  ```cmd
  wscript.exe "C:\Users\<user>\AppData\Roaming\npm\node_modules\pm2-windows-startup\invisible.vbs" "C:\Users\<user>\AppData\Roaming\npm\node_modules\pm2-windows-startup\pm2_resurrect.cmd"
  ```
- **Arquivo de Estado:** O estado ativo foi salvo com `pm2 save`, gerando `C:\Users\<user>\.pm2\dump.pm2`.

### 3. Atalhos Adicionados ao `package.json`
Comandos diretos para facilitar a gestão diária:

```json
"scripts": {
  "pm2:start": "pm2 start ecosystem.config.cjs",
  "pm2:stop": "pm2 stop ecosystem.config.cjs",
  "pm2:restart": "pm2 restart ecosystem.config.cjs",
  "pm2:status": "pm2 status",
  "pm2:logs": "pm2 logs insta-daily-automation",
  "pm2:save": "pm2 save"
}
```

---

## 🕹️ Guia Prático de Operação (Cheat Sheet)

Todos os comandos podem ser executados no PowerShell na raiz do projeto:

### 1. Verificar se o serviço está ativo
```powershell
npm.cmd run pm2:status
# ou
pm2.cmd status
```
*Saída esperada:* status `online`, modo `fork`, consumo de memória estável (~65MB).

### 2. Acompanhar os logs em tempo real
```powershell
npm.cmd run pm2:logs
# ou diretamente nos arquivos:
Get-Content logs\pm2-out.log -Tail 30 -Wait
```

### 3. Reiniciar a aplicação após editar código ou `.env`
```powershell
npm.cmd run pm2:restart
```

### 4. Parar temporariamente o serviço
```powershell
npm.cmd run pm2:stop
```

### 5. Iniciar o serviço novamente
```powershell
npm.cmd run pm2:start
```

### 6. Atualizar a lista de inicialização do Windows
Sempre que fizer alterações no `ecosystem.config.cjs` ou renomear o processo:
```powershell
npm.cmd run pm2:save
```

---

## ⚠️ Boas Práticas e Recomendações

1. **Suspensão de Energia do Windows (Sleep Mode):**
   - O agendador interno do Node.js (`node-cron`) só executa se o computador estiver ligado no horário programado (`08:30`).
   - Se o seu computador for um notebook ou entrar em suspensão profunda antes das 08:30, certifique-se de ajustar o plano de energia do Windows (*Opções de Energia -> Alterar quando o computador entra em suspensão*).

2. **Sincronização do OneDrive:**
   - O banco de dados local SQLite fica localizado em `data/history.db`.
   - Para evitar conflitos de bloqueio de arquivo (*file locking*) durante a sincronização em nuvem do OneDrive, garanta que a pasta do projeto esteja configurada como **"Sempre manter neste dispositivo"**.

3. **Validade dos Tokens da Meta:**
   - O token de acesso do Instagram dura cerca de 60 dias. Acesse periodicamente o Dashboard em `http://localhost:3000` para conferir se o status das credenciais permanece verde.
