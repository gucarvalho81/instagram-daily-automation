#!/usr/bin/env node
import { config } from './config.js';
import { runAutomationPipeline } from './pipeline.js';
import { startScheduler } from './scheduler.js';
import { startServer } from './server.js';

function showHelp() {
  console.log(`
Uso: node src/index.js [opções]

Opções:
  --web, --ui            Inicia o Dashboard Web interativo e o Agendador contínuo (Padrão)
  --schedule             Inicia o serviço agendado contínuo com Dashboard Web
  --run-once             Executa a esteira imediatamente uma única vez via CLI e encerra
  --dry-run              Modo de teste simulado: não faz postagens reais
  --theme "<tema>"       Define ou substitui o tema do post para esta execução
  --port <numero>        Define a porta do servidor web (Padrão: 3000 ou $PORT)
  --help, -h             Exibe esta mensagem de ajuda

Exemplos:
  # Iniciar Dashboard Web e Agendador diário:
  npm run web
  node src/index.js --web

  # Disparo de teste imediato com simulação (Dry-Run):
  npm run run:dry
  node src/index.js --run-once --dry-run

  # Disparo real imediato via CLI:
  npm run run:once
  node src/index.js --run-once
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Permite sobrescrever o tema via argumento CLI: --theme "..."
  const themeIndex = args.indexOf('--theme');
  let customTheme = null;
  if (themeIndex !== -1 && args[themeIndex + 1]) {
    customTheme = args[themeIndex + 1];
  }

  // Porta customizada via CLI: --port 8080
  const portIndex = args.indexOf('--port');
  let customPort = parseInt(process.env.PORT || '3000', 10);
  if (portIndex !== -1 && args[portIndex + 1]) {
    customPort = parseInt(args[portIndex + 1], 10);
  }

  const isRunOnce = args.includes('--run-once');

  if (isRunOnce) {
    const isDryRun = args.includes('--dry-run') || config.dryRun;
    console.log(`[CLI] Modo de execução imediata (--run-once) solicitado. Modo: ${isDryRun ? 'DRY-RUN (Simulado)' : 'PRODUÇÃO (Real)'}`);
    try {
      await runAutomationPipeline({ theme: customTheme, dryRun: isDryRun });
      process.exit(0);
    } catch (err) {
      console.error('[CLI ERRO] A execução imediata falhou.');
      process.exit(1);
    }
  } else {
    // Inicia o Servidor HTTP do Dashboard Web e o Agendador Contínuo
    await startServer(customPort);
    startScheduler();
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
