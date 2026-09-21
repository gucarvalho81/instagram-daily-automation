import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const ENV_PATH = path.resolve(process.cwd(), '.env');

/**
 * Lê o arquivo .env e retorna as linhas originais
 * @returns {string}
 */
export function readEnvRaw() {
  if (!fs.existsSync(ENV_PATH)) {
    return '';
  }
  return fs.readFileSync(ENV_PATH, 'utf-8');
}

/**
 * Atualiza ou insere variáveis de ambiente no arquivo .env preservando comentários
 * @param {Record<string, string>} updates - Dicionário de chaves e novos valores
 * @returns {boolean}
 */
export function updateEnvFile(updates) {
  let content = readEnvRaw();
  const lines = content.split(/\r?\n/);
  const updatedKeys = new Set();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) return line;

    const key = line.slice(0, eqIndex).trim();
    if (key in updates) {
      updatedKeys.add(key);
      const val = updates[key];
      // Se tiver espaços ou quebras, coloca aspas
      const formattedVal = typeof val === 'string' && (val.includes(' ') || val.includes('\n'))
        ? `"${val.replace(/"/g, '\\"')}"`
        : val;
      return `${key}=${formattedVal}`;
    }

    return line;
  });

  // Adiciona chaves que não existiam no arquivo
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      const formattedVal = typeof val === 'string' && (val.includes(' ') || val.includes('\n'))
        ? `"${val.replace(/"/g, '\\"')}"`
        : val;
      newLines.push(`${key}=${formattedVal}`);
    }
  }

  const finalContent = newLines.join('\n');
  fs.writeFileSync(ENV_PATH, finalContent, 'utf-8');

  // Atualiza também o objeto config em memória
  for (const [k, v] of Object.entries(updates)) {
    process.env[k] = v;
    if (k === 'GEMINI_API_KEY') config.geminiApiKey = v;
    if (k === 'GEMINI_MODEL') config.geminiModel = v;
    if (k === 'META_IG_ACCOUNT_ID') config.metaIgAccountId = v;
    if (k === 'META_ACCESS_TOKEN') config.metaAccessToken = v;
    if (k === 'INSTAGRAM_USERNAME') config.instagramUsername = v;
    if (k === 'TOPIC_THEME') config.topicTheme = v;
    if (k === 'SCHEDULE_TIME') config.scheduleTime = v;
    if (k === 'TIMEZONE') config.timezone = v;
    if (k === 'DRY_RUN') config.dryRun = String(v).toLowerCase() === 'true';
  }

  return true;
}

/**
 * Retorna uma versão segura das configurações com chaves de API mascaradas
 * @returns {Object}
 */
export function getSafeConfig() {
  const maskKey = (key) => {
    if (!key || typeof key !== 'string') return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  };

  return {
    geminiModel: config.geminiModel,
    geminiApiKeyMasked: maskKey(config.geminiApiKey),
    hasGeminiKey: Boolean(config.geminiApiKey),
    metaIgAccountId: config.metaIgAccountId,
    metaAccessTokenMasked: maskKey(config.metaAccessToken),
    hasMetaToken: Boolean(config.metaAccessToken),
    instagramUsername: config.instagramUsername || 'thebackenddrop',
    topicTheme: config.topicTheme,
    scheduleTime: config.scheduleTime,
    timezone: config.timezone,
    dryRun: config.dryRun
  };
}
