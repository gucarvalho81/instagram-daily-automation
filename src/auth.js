import crypto from 'node:crypto';
import { config } from './config.js';

// Segredo do servidor para assinar tokens HMAC (gerado na inicialização ou derivado da senha)
const SERVER_SECRET = crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias de validade

// Rate limiting de login em memória: IP -> { attempts, lockedUntil }
const loginAttemptsMap = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 segundos de bloqueio temporário

/**
 * Retorna se o dashboard exige autenticação com base na presença de DASHBOARD_PASSWORD
 * @returns {boolean}
 */
export function isAuthRequired() {
  return Boolean(config.dashboardPassword && config.dashboardPassword.trim().length > 0);
}

/**
 * Cria um token de sessão assinado contendo timestamp e assinatura HMAC
 * @returns {string} Token de sessão
 */
export function createSessionToken() {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const data = `session_${expiresAt}`;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

/**
 * Valida a integridade e expiração de um token de sessão
 * @param {string} token
 * @returns {boolean}
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [data, signature] = parts;
  if (!data.startsWith('session_')) return false;

  const expectedSignature = crypto.createHmac('sha256', SERVER_SECRET).update(data).digest('hex');

  // Comparação segura contra timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  const expiresAt = parseInt(data.replace('session_', ''), 10);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  return true;
}

/**
 * Verifica se um IP está temporariamente bloqueado por excesso de tentativas incorretas
 * @param {string} ip
 * @returns {boolean}
 */
export function isRateLimited(ip) {
  const record = loginAttemptsMap.get(ip);
  if (!record) return false;

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return true;
  }

  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttemptsMap.delete(ip);
    return false;
  }

  return false;
}

/**
 * Registra uma tentativa de login falha e aciona o bloqueio temporário se atingir o limite
 * @param {string} ip
 */
export function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttemptsMap.get(ip) || { attempts: 0, lockedUntil: null };

  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.warn(`[AUTH] IP ${ip} bloqueado temporariamente por ${LOCKOUT_DURATION_MS / 1000}s após ${MAX_ATTEMPTS} tentativas falhas.`);
  }

  loginAttemptsMap.set(ip, record);
}

/**
 * Reseta o contador de tentativas de login após um login bem-sucedido
 * @param {string} ip
 */
export function clearFailedAttempts(ip) {
  loginAttemptsMap.delete(ip);
}

/**
 * Extrai o token de autenticação dos headers da requisição HTTP (Bearer ou Cookie)
 * @param {import('node:http').IncomingMessage} req
 * @returns {string|null}
 */
export function extractToken(req) {
  // 1. Cabeçalho Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. Cookie de sessão: instaauto_session=<token>
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('instaauto_session=')) {
        return c.substring('instaauto_session='.length).trim();
      }
    }
  }

  return null;
}

/**
 * Autentica uma requisição HTTP. Suporta token assinado ou uso direto de DASHBOARD_PASSWORD como Bearer.
 * @param {import('node:http').IncomingMessage} req
 * @returns {{ authenticated: boolean, reason?: string }}
 */
export function authenticateRequest(req) {
  if (!isAuthRequired()) {
    return { authenticated: true, reason: 'AUTH_DISABLED' };
  }

  const token = extractToken(req);
  if (!token) {
    return { authenticated: false, reason: 'TOKEN_MISSING' };
  }

  // Suporte a chamada programática via Webhook/cURL com a senha diretamente no Bearer
  if (token === config.dashboardPassword) {
    return { authenticated: true, reason: 'PASSWORD_BEARER' };
  }

  // Validação de token de sessão assinado
  if (verifySessionToken(token)) {
    return { authenticated: true, reason: 'VALID_SESSION' };
  }

  return { authenticated: false, reason: 'INVALID_TOKEN' };
}
