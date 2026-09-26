import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { config } from './config.js';
import { getSafeConfig, updateEnvFile } from './configManager.js';
import { getDatabase, getRecentTopics } from './database.js';
import { runAutomationPipeline } from './pipeline.js';
import { reschedule } from './scheduler.js';
import { generateInstagramPost } from './services/gemini.js';
import { renderLocalCard } from './services/localRenderer.js';
import {
  isAuthRequired,
  createSessionToken,
  authenticateRequest,
  recordFailedAttempt,
  clearFailedAttempts,
  isRateLimited
} from './auth.js';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.resolve(process.cwd(), 'data');

let isPipelineRunning = false;
let serverInstance = null;
const serverStartTime = Date.now();
let lastExecution = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Lê o corpo da requisição HTTP como JSON
 * @param {http.IncomingMessage} req
 * @returns {Promise<Object>}
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload muito grande (máximo 2MB)'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Formato JSON inválido no corpo da requisição'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Envia uma resposta JSON padronizada
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {Object} data
 */
function sendJson(res, status, data, customHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...customHeaders
  });
  res.end(JSON.stringify(data));
}

/**
 * Manipula as rotas e requisições HTTP do servidor
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';

  try {
    // -------------------------------------------------------------------------
    // API: POST /api/auth/login
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      if (!isAuthRequired()) {
        return sendJson(res, 200, { success: true, message: 'Autenticação desativada.' });
      }

      if (isRateLimited(clientIp)) {
        return sendJson(res, 429, {
          success: false,
          message: 'Muitas tentativas falhas. Aguarde 60 segundos antes de tentar novamente.'
        });
      }

      const body = await parseRequestBody(req);
      const password = (body.password || '').trim();

      if (password === config.dashboardPassword) {
        clearFailedAttempts(clientIp);
        const token = createSessionToken();
        const cookie = `instaauto_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
        return sendJson(
          res,
          200,
          { success: true, token, message: 'Login realizado com sucesso!' },
          { 'Set-Cookie': cookie }
        );
      } else {
        recordFailedAttempt(clientIp);
        return sendJson(res, 401, { success: false, message: 'Senha incorreta.' });
      }
    }

    // -------------------------------------------------------------------------
    // API: POST /api/auth/logout
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const cookie = 'instaauto_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
      return sendJson(res, 200, { success: true, message: 'Sessão encerrada com sucesso.' }, { 'Set-Cookie': cookie });
    }

    // -------------------------------------------------------------------------
    // Middleware de Proteção para Rotas de Ação e Edição
    // -------------------------------------------------------------------------
    const protectedPostRoutes = ['/api/config', '/api/trigger', '/api/preview', '/api/test-gemini', '/api/test-meta'];
    if (req.method === 'POST' && protectedPostRoutes.includes(pathname)) {
      const auth = authenticateRequest(req);
      if (!auth.authenticated) {
        return sendJson(res, 401, {
          success: false,
          error: 'Acesso não autorizado. Autenticação obrigatória.',
          authRequired: true
        });
      }
    }

    // -------------------------------------------------------------------------
    // API: GET /api/status
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/status') {
      const db = getDatabase();
      const countStmt = db.prepare('SELECT COUNT(*) as total FROM posts_history');
      const totalCount = countStmt.get()?.total || 0;

      const lastPostStmt = db.prepare('SELECT * FROM posts_history ORDER BY id DESC LIMIT 1');
      const lastPost = lastPostStmt.get() || null;

      const authStatus = authenticateRequest(req);

      return sendJson(res, 200, {
        isPipelineRunning,
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
        scheduleTime: config.scheduleTime,
        timezone: config.timezone,
        instagramUsername: config.instagramUsername || 'thebackenddrop',
        totalPosts: totalCount,
        lastPost,
        lastExecution,
        hasGeminiKey: Boolean(config.geminiApiKey),
        hasMetaCredentials: Boolean(config.metaAccessToken && config.metaIgAccountId),
        authRequired: isAuthRequired(),
        authenticated: authStatus.authenticated
      });
    }

    // -------------------------------------------------------------------------
    // API: GET /api/config
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/config') {
      return sendJson(res, 200, getSafeConfig());
    }

    // -------------------------------------------------------------------------
    // API: POST /api/config
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/config') {
      const body = await parseRequestBody(req);
      const updates = {};

      if (body.geminiApiKey !== undefined && body.geminiApiKey.trim() !== '') {
        updates.GEMINI_API_KEY = body.geminiApiKey.trim();
      }
      if (body.geminiModel) {
        updates.GEMINI_MODEL = body.geminiModel.trim();
      }
      if (body.metaIgAccountId !== undefined) {
        updates.META_IG_ACCOUNT_ID = body.metaIgAccountId.trim();
      }
      if (body.metaAccessToken !== undefined && body.metaAccessToken.trim() !== '') {
        updates.META_ACCESS_TOKEN = body.metaAccessToken.trim();
      }
      if (body.instagramUsername !== undefined) {
        updates.INSTAGRAM_USERNAME = body.instagramUsername.trim().replace(/^@/, '');
      }
      if (body.topicTheme) {
        updates.TOPIC_THEME = body.topicTheme.trim();
      }
      if (body.scheduleTime) {
        updates.SCHEDULE_TIME = body.scheduleTime.trim();
      }
      if (body.timezone) {
        updates.TIMEZONE = body.timezone.trim();
      }
      if (body.dashboardPassword !== undefined) {
        updates.DASHBOARD_PASSWORD = body.dashboardPassword.trim();
      }
      if (body.nicheLabel !== undefined) {
        updates.NICHE_LABEL = body.nicheLabel.trim();
      }
      if (body.cardCta !== undefined) {
        updates.CARD_CTA = body.cardCta.trim();
      }
      if (body.defaultHashtags !== undefined) {
        updates.HASHTAGS = body.defaultHashtags.trim();
      }

      updateEnvFile(updates);

      // Reagenda dinamicamente a rotina em segundo plano se houver alteração de horário ou fuso
      if (updates.SCHEDULE_TIME || updates.TIMEZONE) {
        try {
          reschedule(config.scheduleTime, config.timezone);
        } catch (schedErr) {
          console.warn('[SERVER] Aviso ao reagendar rotina cron:', schedErr.message);
        }
      }

      return sendJson(res, 200, { success: true, message: 'Configurações salvas com sucesso!', config: getSafeConfig() });
    }

    // -------------------------------------------------------------------------
    // API: POST /api/test-gemini
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/test-gemini') {
      const body = await parseRequestBody(req);
      const testKey = (body.apiKey || config.geminiApiKey || '').trim();

      if (!testKey) {
        return sendJson(res, 400, {
          success: false,
          message: 'Chave de API do Gemini não fornecida. Insira uma chave do Google AI Studio para testar.'
        });
      }

      try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${testKey}`;
        const apiRes = await fetch(testUrl, { signal: AbortSignal.timeout(15000) });

        if (!apiRes.ok) {
          const errText = await apiRes.text();
          let humanMsg = `Erro na validação do Gemini (HTTP ${apiRes.status})`;
          if (apiRes.status === 400 || errText.includes('API_KEY_INVALID')) {
            humanMsg = 'Chave do Google AI Studio inválida. Verifique os caracteres e gere uma nova no AI Studio.';
          } else if (apiRes.status === 403) {
            humanMsg = 'Chave de API sem permissão para acessar a API Generativa do Google AI Studio.';
          } else if (apiRes.status === 429) {
            humanMsg = 'Limite temporário de requisições (Quota/Rate Limit) atingido no Google AI Studio.';
          }
          return sendJson(res, apiRes.status, {
            success: false,
            message: humanMsg,
            details: errText
          });
        }

        const data = await apiRes.json();
        const availableModels = (data.models || [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace('models/', ''));

        return sendJson(res, 200, {
          success: true,
          message: 'Conexão com Google Gemini realizada com sucesso!',
          models: availableModels
        });
      } catch (err) {
        return sendJson(res, 500, {
          success: false,
          message: `Falha na conexão com Google Gemini: ${err.message}`
        });
      }
    }

    // -------------------------------------------------------------------------
    // API: POST /api/test-meta
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/test-meta') {
      const body = await parseRequestBody(req);
      const testToken = (body.accessToken !== undefined ? body.accessToken : (config.metaAccessToken || '')).trim();
      const testId = (body.accountId !== undefined ? body.accountId : (config.metaIgAccountId || '')).trim();

      if (!testToken) {
        return sendJson(res, 400, {
          success: false,
          message: 'Access Token da Meta não fornecido. Insira um token válido para testar.'
        });
      }
      if (!testId) {
        return sendJson(res, 400, {
          success: false,
          message: 'Instagram Business Account ID não fornecido. Insira o ID da conta para testar.'
        });
      }

      try {
        const testUrl = `https://graph.facebook.com/${config.metaApiVersion}/${testId}?fields=id,username,name&access_token=${testToken}`;
        const apiRes = await fetch(testUrl, { signal: AbortSignal.timeout(15000) });
        const resData = await apiRes.json();

        if (!apiRes.ok) {
          const errObj = resData?.error || {};
          let humanMessage = `Erro na Meta Graph API: ${errObj.message || 'Falha na requisição'}`;

          if (errObj.code === 190) {
            humanMessage = 'Token de acesso inválido ou expirado. Gere um novo token de longa duração no Meta for Developers.';
          } else if (errObj.code === 100) {
            humanMessage = 'ID da Conta do Instagram inválido ou não encontrado. Verifique se você usou o Instagram Business Account ID e não o ID da Página do Facebook.';
          } else if (errObj.code === 10 || errObj.code === 200) {
            humanMessage = 'Permissões insuficientes. Certifique-se de que o token possui permissões: instagram_basic, instagram_content_publish e pages_show_list.';
          }

          return sendJson(res, apiRes.status, {
            success: false,
            message: humanMessage,
            code: errObj.code,
            details: errObj.message
          });
        }

        return sendJson(res, 200, {
          success: true,
          message: `Conexão bem sucedida com o Instagram! Conta vinculada: @${resData.username || resData.name || testId}`,
          account: {
            id: resData.id,
            username: resData.username,
            name: resData.name
          }
        });
      } catch (err) {
        return sendJson(res, 500, {
          success: false,
          message: `Falha ao conectar com os servidores da Meta: ${err.message}`
        });
      }
    }

    // -------------------------------------------------------------------------
    // API: GET /api/posts
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/posts') {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '30', 10);
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM posts_history ORDER BY id DESC LIMIT ?');
      const posts = stmt.all(limit);
      return sendJson(res, 200, {
        posts,
        instagramUsername: config.instagramUsername || 'thebackenddrop'
      });
    }

    // -------------------------------------------------------------------------
    // API: POST /api/trigger (Disparo imediato)
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/trigger') {
      if (isPipelineRunning) {
        return sendJson(res, 409, { success: false, message: 'A esteira já está em execução no momento.' });
      }

      const body = await parseRequestBody(req);
      const dryRunMode = typeof body.dryRun === 'boolean' ? body.dryRun : config.dryRun;
      const customTheme = body.theme || null;

      // Validação amigável pré-disparo para evitar falhas silenciosas
      if (!dryRunMode) {
        const missing = [];
        if (!config.geminiApiKey) missing.push('Chave do Google Gemini (GEMINI_API_KEY)');
        if (!config.metaIgAccountId) missing.push('ID da Conta do Instagram (META_IG_ACCOUNT_ID)');
        if (!config.metaAccessToken) missing.push('Token de Acesso da Meta (META_ACCESS_TOKEN)');

        if (missing.length > 0) {
          return sendJson(res, 400, {
            success: false,
            message: `Não é possível publicar no Instagram em modo Real: Credenciais obrigatórias não configuradas: ${missing.join(', ')}. Configure-as na aba "Chaves & Agendador" ou execute em modo "Simulação (Dry-Run)".`
          });
        }
      }

      console.log(`[SERVER API] Disparo manual via Web recebido. Modo: ${dryRunMode ? 'DRY-RUN (Simulação Segura)' : 'PRODUÇÃO (Publicação Real)'}`);

      // Executa de forma assíncrona para não bloquear a resposta HTTP
      isPipelineRunning = true;
      runAutomationPipeline({ dryRun: dryRunMode, theme: customTheme })
        .then((result) => {
          console.log(`[SERVER API] Pipeline disparado via Web concluído com sucesso (${dryRunMode ? 'DRY-RUN' : 'PRODUÇÃO'}).`);
          lastExecution = {
            success: true,
            timestamp: Date.now(),
            mode: dryRunMode ? 'DRY-RUN' : 'PRODUÇÃO',
            cardTitle: result?.cardTitle || '',
            postId: result?.postId || '',
            message: dryRunMode
              ? `Simulação concluída com sucesso! Card "${result?.cardTitle || 'Novo Post'}" gerado.`
              : `Post publicado no Feed com sucesso! ID: ${result?.postId || ''}`
          };
        })
        .catch((err) => {
          console.error('[SERVER API] Falha na execução disparada via Web:', err.message);
          lastExecution = {
            success: false,
            timestamp: Date.now(),
            mode: dryRunMode ? 'DRY-RUN' : 'PRODUÇÃO',
            error: err.message,
            message: `Falha na execução: ${err.message}`
          };
        })
        .finally(() => {
          isPipelineRunning = false;
        });

      return sendJson(res, 202, {
        success: true,
        message: `Esteira iniciada com sucesso no modo ${dryRunMode ? 'DRY-RUN (Simulação)' : 'PRODUÇÃO'}!`,
        dryRun: dryRunMode
      });
    }

    // -------------------------------------------------------------------------
    // API: POST /api/preview (Gera arte e conteúdo na hora sem publicar)
    // -------------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/preview') {
      try {
        const body = await parseRequestBody(req);
        const customTheme = body.theme || config.topicTheme;

        console.log('[SERVER API] Gerando prévia instantânea...');
        const recent = getRecentTopics(15);
        const postContent = await generateInstagramPost(recent, customTheme);
        // O preview local utiliza modo simulado para renderização local instantânea sem consumo de rede
        const renderRes = await renderLocalCard(postContent, { dryRun: true });

        return sendJson(res, 200, {
          success: true,
          content: postContent,
          imageUrl: `/api/media/latest-card-1080x1350.png?t=${Date.now()}`,
          cdnUrl: renderRes.imageUrl
        });
      } catch (err) {
        console.error('[SERVER API] Erro ao gerar prévia:', err.message);
        let errorMsg = err.message;
        if (!config.geminiApiKey) {
          errorMsg = 'Para gerar prévias com IA em tempo real, configure sua GEMINI_API_KEY na aba "Chaves & Agendador".';
        }
        return sendJson(res, 500, {
          success: false,
          error: errorMsg
        });
      }
    }

    // -------------------------------------------------------------------------
    // API: Servir mídia gerada localmente: GET /api/media/:filename
    // -------------------------------------------------------------------------
    if (req.method === 'GET' && pathname.startsWith('/api/media/')) {
      const filename = path.basename(pathname.replace('/api/media/', ''));
      const filePath = path.resolve(DATA_DIR, filename);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        });
        return fs.createReadStream(filePath).pipe(res);
      } else {
        return sendJson(res, 404, { error: 'Arquivo de mídia não encontrado.' });
      }
    }

    // Bloqueia rotas da API não reconhecidas antes de cair no servidor de arquivos estáticos
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: `Endpoint da API não encontrado: ${pathname}` });
    }

    // -------------------------------------------------------------------------
    // Servidor de Arquivos Estáticos (Frontend SPA em public/)
    // -------------------------------------------------------------------------
    let filePath = path.resolve(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));

    // Segurança contra Directory Traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Acesso proibido.');
    }

    // Se o arquivo não existir, fallback para index.html (SPA routing)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      filePath = path.resolve(PUBLIC_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'text/plain',
        'Cache-Control': 'no-cache'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Página não encontrada.');
  } catch (err) {
    console.error('[SERVER ERRO]', err);
    return sendJson(res, 500, { error: err.message });
  }
}

/**
 * Inicia o servidor HTTP da interface web
 * @param {number} [port=3000]
 * @returns {Promise<http.Server>}
 */
export function startServer(port = parseInt(process.env.PORT || '3000', 10)) {
  return new Promise((resolve) => {
    // Garante que as pastas public e data existam
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    serverInstance = http.createServer(handleRequest);

    serverInstance.listen(port, () => {
      console.log('='.repeat(70));
      console.log(`🌐 [DASHBOARD WEB ATIVO] Acesse no navegador: http://localhost:${port}`);
      console.log(`⚡ Painel de controle, gestão de chaves e visualizador do Instagram ativo`);
      console.log('='.repeat(70));
      resolve(serverInstance);
    });
  });
}

/**
 * Encerra o servidor web graciosamente
 */
export function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}
