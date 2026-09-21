import cron from 'node-cron';
import { config } from './config.js';
import { runAutomationPipeline } from './pipeline.js';

let currentTask = null;
let isPipelineScheduledRunning = false;

/**
 * Converte o formato "HH:mm" em expressão cron "m H * * *"
 * @param {string} timeStr - Ex: "09:00" ou "14:30"
 * @returns {string} Ex: "0 9 * * *"
 */
export function parseTimeToCron(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return '0 9 * * *';
  }
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) {
    console.warn(`[SCHEDULER] Formato de hora inválido "${timeStr}". Usando padrão "09:00".`);
    return '0 9 * * *';
  }
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    console.warn(`[SCHEDULER] Hora fora do intervalo válido "${timeStr}". Usando padrão "09:00".`);
    return '0 9 * * *';
  }
  return `${minute} ${hour} * * *`;
}

/**
 * Callback executado no horário programado
 */
async function onScheduledTrigger() {
  if (isPipelineScheduledRunning) {
    console.warn('[SCHEDULER] A esteira anterior ainda está em execução. Pulando disparo programado.');
    return;
  }

  isPipelineScheduledRunning = true;
  console.log(`\n[SCHEDULER] Horário atingido (${config.scheduleTime}). Disparando esteira diária...`);

  try {
    await runAutomationPipeline();
    console.log('[SCHEDULER] Execução diária concluída com sucesso. Aguardando próximo ciclo.');
  } catch (err) {
    console.error(`[SCHEDULER ERRO] Falha no ciclo diário: ${err.message}`);
  } finally {
    isPipelineScheduledRunning = false;
  }
}

/**
 * Inicia o agendador contínuo para disparo diário
 * @param {string} [customTime]
 * @param {string} [customTz]
 * @returns {cron.ScheduledTask}
 */
export function startScheduler(customTime, customTz) {
  const scheduleTime = customTime || config.scheduleTime;
  const timezone = customTz || config.timezone;
  const cronExpression = parseTimeToCron(scheduleTime);

  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  console.log('='.repeat(70));
  console.log('[SCHEDULER] Agendador Diário do Instagram Inicializado');
  console.log(`[SCHEDULER] Horário configurado: ${scheduleTime} (${cronExpression})`);
  console.log(`[SCHEDULER] Fuso Horário: ${timezone}`);
  console.log(`[SCHEDULER] Renderizador: Local Nativo (1080x1350 HD)`);
  console.log(`[SCHEDULER] Modo: ${config.dryRun ? 'DRY-RUN (Simulado)' : 'PRODUÇÃO (Real)'}`);
  console.log('='.repeat(70));
  console.log('[SCHEDULER] Aguardando o horário programado para executar a esteira...');

  currentTask = cron.schedule(
    cronExpression,
    onScheduledTrigger,
    {
      scheduled: true,
      timezone: timezone
    }
  );

  return currentTask;
}

/**
 * Reagenda a rotina diária dinamicamente em tempo de execução
 * @param {string} newTime
 * @param {string} [newTz]
 * @returns {cron.ScheduledTask}
 */
export function reschedule(newTime, newTz) {
  console.log(`[SCHEDULER] Reagendando rotina diária para: ${newTime} (Fuso: ${newTz || config.timezone})...`);
  return startScheduler(newTime, newTz);
}

/**
 * Encerra o agendador contínuo
 */
export function stopScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
    console.log('[SCHEDULER] Agendador contínuo finalizado.');
  }
}

