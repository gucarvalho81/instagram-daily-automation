import dotenv from 'dotenv';
import path from 'node:path';

// Carrega as variáveis do arquivo .env
dotenv.config();

/**
 * Configuração centralizada da aplicação
 */
export const config = {
  // Google Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',

  // Meta Instagram Graph API
  metaIgAccountId: process.env.META_IG_ACCOUNT_ID || '',
  metaAccessToken: process.env.META_ACCESS_TOKEN || '',
  metaApiVersion: 'v21.0',
  instagramUsername: process.env.INSTAGRAM_USERNAME || 'thebackenddrop',

  // Regras de Conteúdo e Agendamento
  topicTheme: process.env.TOPIC_THEME || 'Dicas de Produtividade para Desenvolvedores de Software',
  scheduleTime: process.env.SCHEDULE_TIME || '09:00',
  timezone: process.env.TIMEZONE || 'America/Sao_Paulo',

  // Flag de execução simulada (Dry-Run)
  dryRun: process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run'),

  // Autenticação e Segurança do Dashboard Web
  dashboardPassword: process.env.DASHBOARD_PASSWORD || '',

  // Customização de Nicho e Layout do Card
  nicheLabel: process.env.NICHE_LABEL || 'TECH & SYSTEM DESIGN',
  cardCta: process.env.CARD_CTA || 'SALVE PARA CONSULTAR 📌',
  defaultHashtags: process.env.HASHTAGS || '',

  // Caminho para o banco de dados SQLite local
  dbPath: path.resolve(process.cwd(), 'data', 'history.db'),
};

/**
 * Valida se as variáveis de ambiente necessárias estão presentes.
 * Se o modo dryRun estiver ativo, apenas avisa sem interromper o processo.
 * @param {boolean} [enforce=true]
 */
export function validateConfig(enforce = true) {
  const missing = [];

  if (!config.geminiApiKey) missing.push('GEMINI_API_KEY');
  if (!config.metaIgAccountId) missing.push('META_IG_ACCOUNT_ID');
  if (!config.metaAccessToken) missing.push('META_ACCESS_TOKEN');

  if (missing.length > 0) {
    if (config.dryRun) {
      console.warn(`[CONFIG] MODO DRY-RUN ATIVO: Variáveis ausentes ignoradas: ${missing.join(', ')}`);
      return true;
    }

    if (enforce) {
      throw new Error(
        `[CONFIG ERRO] Variáveis de ambiente obrigatórias não foram configuradas no .env:\n- ${missing.join('\n- ')}\nPor favor, consulte o .env.example.`
      );
    }
    return false;
  }

  return true;
}
