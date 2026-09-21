import { config } from '../config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cria o container de mídia no Instagram Graph API v21.0
 * @param {string} imageUrl - URL pública e acessível da imagem
 * @param {string} caption - Legenda completa do post
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<string>} ID do container criado
 */
export async function createMediaContainer(imageUrl, caption, options = {}) {
  const isDryRun = Boolean(options.dryRun ?? config.dryRun);

  if (isDryRun) {
    console.log('[META INSTAGRAM] [DRY-RUN] Simulação ativa: container mock gerado sem envio à Meta.');
    return `mock-container-${Date.now()}`;
  }

  console.log('[META INSTAGRAM] Criando container de mídia no Instagram Graph API...');

  const url = `https://graph.facebook.com/${config.metaApiVersion}/${config.metaIgAccountId}/media`;
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption: caption,
    access_token: config.metaAccessToken
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'POST'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status} ao criar container no Instagram: ${errorBody}`);
  }

  const data = await response.json();

  if (!data || !data.id) {
    throw new Error(`Meta Graph API não retornou ID de container: ${JSON.stringify(data)}`);
  }

  console.log(`[META INSTAGRAM] Container de mídia criado com sucesso! ID: ${data.id}`);
  return data.id;
}

/**
 * Aguarda o processamento do container pela Meta via polling até status_code === 'FINISHED'
 * @param {string} containerId
 * @param {number} [maxAttempts=20]
 * @param {number} [intervalMs=5000]
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<boolean>}
 */
export async function waitForContainerFinished(containerId, maxAttempts = 20, intervalMs = 5000, options = {}) {
  const isDryRun = Boolean(options.dryRun ?? config.dryRun);

  if (isDryRun || String(containerId).startsWith('mock-')) {
    console.log('[META INSTAGRAM] [DRY-RUN] Simulação ativa: polling de container ignorado com sucesso.');
    return true;
  }

  console.log(`[META INSTAGRAM] Aguardando processamento do container ${containerId}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(intervalMs);

    const url = `https://graph.facebook.com/${config.metaApiVersion}/${containerId}?fields=status_code,status&access_token=${config.metaAccessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[META INSTAGRAM] Tentativa ${attempt}: Erro HTTP ${response.status} ao checar status: ${errorText}`);
      continue;
    }

    const data = await response.json();
    const statusCode = data.status_code;

    console.log(`[META INSTAGRAM] Status do container (Tentativa ${attempt}/${maxAttempts}): ${statusCode}`);

    if (statusCode === 'FINISHED') {
      console.log('[META INSTAGRAM] Processamento concluído com sucesso. Container pronto para publicação!');
      return true;
    }

    if (statusCode === 'ERROR') {
      throw new Error(`Meta falhou ao processar imagem do container: ${JSON.stringify(data)}`);
    }

    if (statusCode === 'EXPIRED') {
      throw new Error(`O container ${containerId} expirou antes da publicação.`);
    }
  }

  throw new Error(`Timeout aguardando processamento do container na Meta após ${maxAttempts * (intervalMs / 1000)}s.`);
}

/**
 * Publica o container previamente processado no feed do Instagram
 * @param {string} containerId
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<{id: string, permalink: string}>} ID oficial e link do post publicado
 */
export async function publishMedia(containerId, options = {}) {
  const defaultAccountUrl = `https://www.instagram.com/${config.instagramUsername || 'thebackenddrop'}/`;
  const isDryRun = Boolean(options.dryRun ?? config.dryRun);

  if (isDryRun || String(containerId).startsWith('mock-')) {
    console.log('[META INSTAGRAM] [DRY-RUN] Simulação ativa: publicação oficial no Feed bloqueada com segurança.');
    return {
      id: `mock-post-${Date.now()}`,
      permalink: defaultAccountUrl
    };
  }

  console.log(`[META INSTAGRAM] Publicando container ${containerId} no Feed...`);

  const url = `https://graph.facebook.com/${config.metaApiVersion}/${config.metaIgAccountId}/media_publish`;
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: config.metaAccessToken
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'POST'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status} ao publicar mídia no Instagram: ${errorBody}`);
  }

  const data = await response.json();

  if (!data || !data.id) {
    throw new Error(`Meta Graph API não retornou ID de post publicado: ${JSON.stringify(data)}`);
  }

  console.log(`[META INSTAGRAM] Post publicado no Instagram com sucesso! ID do Post: ${data.id}`);

  // Consulta o permalink oficial do post na Meta Graph API
  let permalink = defaultAccountUrl;
  try {
    const permalinkUrl = `https://graph.facebook.com/${config.metaApiVersion}/${data.id}?fields=permalink&access_token=${config.metaAccessToken}`;
    const permalinkRes = await fetch(permalinkUrl);
    if (permalinkRes.ok) {
      const pData = await permalinkRes.json();
      if (pData.permalink) {
        permalink = pData.permalink;
        console.log(`[META INSTAGRAM] Permalink oficial do post: ${permalink}`);
      }
    }
  } catch (err) {
    console.warn('[META INSTAGRAM] Aviso: Não foi possível obter permalink direto, utilizando perfil da conta:', err.message);
  }

  return { id: data.id, permalink };
}
