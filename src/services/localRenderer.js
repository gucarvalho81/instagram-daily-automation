import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Quebra um texto em múltiplas linhas respeitando palavras inteiras
 * @param {string} text
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
function wrapText(text, maxCharsPerLine = 38) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Escapa caracteres especiais para inserção segura em XML/SVG
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Gera o código SVG completo de alta definição (1080x1350)
 * @param {import('./gemini.js').GeneratedPostContent} content
 * @returns {string}
 */
export function buildCardSvg(content) {
  const tag = escapeXml(content.tag || 'SYSTEM DESIGN');
  const rawTitle = content.titulo || content.card_title || 'Arquitetura de Software';
  const titleLines = wrapText(rawTitle, 28).slice(0, 2);

  const ponto1 = content.ponto_1 || content.point_1 || '';
  const ponto2 = content.ponto_2 || content.point_2 || '';
  const ponto3 = content.ponto_3 || content.point_3 || '';

  const p1Lines = wrapText(ponto1, 38).slice(0, 2);
  const p2Lines = wrapText(ponto2, 38).slice(0, 2);
  const p3Lines = wrapText(ponto3, 38).slice(0, 2);

  const titleTspans = titleLines
    .map((line, idx) => `<tspan x="100" dy="${idx === 0 ? 0 : 70}">${escapeXml(line)}</tspan>`)
    .join('');

  const buildPointCard = (num, lines, yPos) => {
    const textY = lines.length === 1 ? 104 : 78;
    const tspans = lines
      .map((l, i) => `<tspan x="200" dy="${i === 0 ? 0 : 50}">${escapeXml(l)}</tspan>`)
      .join('');

    return `
    <!-- Card Ponto ${num} -->
    <g transform="translate(0, ${yPos})">
      <!-- Fundo do Card com borda sutil -->
      <rect x="80" y="0" width="920" height="184" rx="20" fill="#131d2e" stroke="#1e2d44" stroke-width="2"/>
      
      <!-- Indicador Numérico / Ícone -->
      <rect x="110" y="44" width="60" height="60" rx="16" fill="#0284c7" fill-opacity="0.2" stroke="#38bdf8" stroke-width="2"/>
      <text x="140" y="86" font-family="'JetBrains Mono', monospace, sans-serif" font-size="30" font-weight="700" fill="#38bdf8" text-anchor="middle">0${num}</text>

      <!-- Texto da Dica com Fonte Aumentada e Mais Legível -->
      <text x="200" y="${textY}" font-family="'Inter', 'JetBrains Mono', system-ui, sans-serif" font-size="38" font-weight="600" fill="#f1f5f9" letter-spacing="-0.3">
        ${tspans}
      </text>
    </g>
    `;
  };

  return `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Gradiente de Fundo Profundo -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="60%" stop-color="#0e1524"/>
        <stop offset="100%" stop-color="#0a0f1a"/>
      </linearGradient>

      <!-- Brilho Radial no Topo -->
      <radialGradient id="topGlow" cx="50%" cy="15%" r="60%">
        <stop offset="0%" stop-color="#0284c7" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
      </radialGradient>

      <linearGradient id="cyanLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#818cf8"/>
      </linearGradient>
    </defs>

    <!-- Fundo Base -->
    <rect width="1080" height="1350" fill="url(#bgGrad)"/>
    <rect width="1080" height="1350" fill="url(#topGlow)"/>

    <!-- Grade Tecnológica Sutil -->
    <g opacity="0.04" stroke="#ffffff" stroke-width="1">
      <line x1="80" y1="0" x2="80" y2="1350"/>
      <line x1="540" y1="0" x2="540" y2="1350"/>
      <line x1="1000" y1="0" x2="1000" y2="1350"/>
      <line x1="0" y1="200" x2="1080" y2="200"/>
      <line x1="0" y1="600" x2="1080" y2="600"/>
      <line x1="0" y1="1000" x2="1080" y2="1000"/>
    </g>

    <!-- Barra de Destaque Superior -->
    <rect x="80" y="80" width="80" height="6" rx="3" fill="url(#cyanLine)"/>

    <!-- Tag Badge -->
    <g transform="translate(80, 110)">
      <rect x="0" y="0" width="${Math.max(160, tag.length * 16 + 40)}" height="44" rx="10" fill="#0369a1" fill-opacity="0.25" stroke="#0284c7" stroke-width="1.5"/>
      <text x="20" y="29" font-family="'JetBrains Mono', monospace, sans-serif" font-size="20" font-weight="700" fill="#38bdf8" letter-spacing="1.5">${tag}</text>
    </g>

    <!-- Título Principal -->
    <text x="100" y="250" font-family="'Poppins', 'Inter', system-ui, sans-serif" font-size="58" font-weight="700" fill="#ffffff" letter-spacing="-0.8">
      ${titleTspans}
    </text>

    <!-- Linha Divisória de Seção -->
    <line x1="80" y1="${titleLines.length > 1 ? 380 : 320}" x2="1000" y2="${titleLines.length > 1 ? 380 : 320}" stroke="#1e293b" stroke-width="2"/>

    <!-- 3 Blocos de Conteúdo Prático -->
    ${buildPointCard(1, p1Lines, titleLines.length > 1 ? 410 : 360)}
    ${buildPointCard(2, p2Lines, titleLines.length > 1 ? 626 : 580)}
    ${buildPointCard(3, p3Lines, titleLines.length > 1 ? 842 : 800)}

    <!-- Rodapé de Ação / CTA -->
    <g transform="translate(80, 1200)">
      <line x1="0" y1="0" x2="920" y2="0" stroke="#1e293b" stroke-width="1.5"/>
      <text x="0" y="55" font-family="'JetBrains Mono', monospace, sans-serif" font-size="22" font-weight="600" fill="#94a3b8" letter-spacing="0.5">
        @${escapeXml(config.instagramUsername || 'thebackenddrop')} • ${escapeXml(content.niche || config.nicheLabel || 'TECH & SYSTEM DESIGN')}
      </text>
      <text x="920" y="55" font-family="'JetBrains Mono', monospace, sans-serif" font-size="22" font-weight="700" fill="#38bdf8" text-anchor="end">
        ${escapeXml(content.cta || config.cardCta || 'SALVE PARA CONSULTAR 📌')}
      </text>
    </g>
  </svg>
  `.trim();
}

/**
 * Renderiza o SVG em imagem PNG nativa de 1080x1350
 * @param {string} svgContent
 * @returns {Buffer}
 */
export function renderSvgToPng(svgContent) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 1080
    },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0
  });

  return resvg.render().asPng();
}

/**
 * Valida se uma URL pública realmente serve uma imagem válida e acessível para o crawler da Meta
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function verifyPublicImageUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) return false;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return false;

    // Garante que o arquivo não está vazio nem truncado (mínimo de 5KB para um PNG 1080x1350)
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > 0 && contentLength < 5000) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Faz upload do PNG para um servidor de mídia público temporário gratuito para a Meta poder baixar
 * Utiliza cadeia multi-provedor (Uguu.se -> Tmpfiles.org -> Catbox.moe) com validação de formato
 * @param {Buffer} pngBuffer
 * @returns {Promise<string>} URL pública HTTPS da imagem
 */
async function uploadToPublicHost(pngBuffer) {
  console.log('[LOCAL RENDERER] Hospedando imagem temporária para acesso da Instagram Graph API...');

  const errors = [];
  const fileName = `card-${Date.now()}.png`;

  // 1. Provedor Primário: Uguu.se (Upload direto, CDN global rápida e 100% aceito pela Meta)
  try {
    console.log('[LOCAL RENDERER] Tentando provedor primário (Uguu.se)...');
    const uguuForm = new FormData();
    uguuForm.append('files[]', new Blob([pngBuffer], { type: 'image/png' }), fileName);

    const uguuRes = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: uguuForm,
      signal: AbortSignal.timeout(12000)
    });

    if (uguuRes.ok) {
      const data = await uguuRes.json();
      const directUrl = data?.files?.[0]?.url;
      if (directUrl && (await verifyPublicImageUrl(directUrl))) {
        console.log(`[LOCAL RENDERER] Imagem 1080x1350 hospedada e validada com sucesso via Uguu: ${directUrl}`);
        return directUrl;
      }
    }
  } catch (err) {
    errors.push(`Uguu.se: ${err.message}`);
    console.warn('[LOCAL RENDERER] Falha no Uguu.se, tentando próximo provedor...', err.message);
  }

  // 2. Provedor Secundário: Tmpfiles.org (com extração do token oficial de download da página)
  try {
    console.log('[LOCAL RENDERER] Tentando provedor secundário (Tmpfiles.org)...');
    const tmpForm = new FormData();
    tmpForm.append('file', new Blob([pngBuffer], { type: 'image/png' }), fileName);

    const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: tmpForm,
      signal: AbortSignal.timeout(12000)
    });

    if (tmpRes.ok) {
      const data = await tmpRes.json();
      const pageUrl = data?.data?.url;
      if (pageUrl) {
        // O tmpfiles.org exige o token de download presente na página de visualização
        const pageRes = await fetch(pageUrl, { signal: AbortSignal.timeout(8000) });
        const html = await pageRes.text();
        const match = html.match(/href="([^"]*\/dl\/[^"]+)"/);
        const directUrl = (match && match[1]) ? match[1] : pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

        if (await verifyPublicImageUrl(directUrl)) {
          console.log(`[LOCAL RENDERER] Imagem 1080x1350 hospedada e validada com sucesso via Tmpfiles: ${directUrl}`);
          return directUrl;
        }
      }
    }
  } catch (err) {
    errors.push(`Tmpfiles.org: ${err.message}`);
    console.warn('[LOCAL RENDERER] Falha no Tmpfiles.org, tentando próximo provedor...', err.message);
  }

  // 3. Provedor Terciário: Catbox.moe (com validação rigorosa de integridade)
  try {
    console.log('[LOCAL RENDERER] Tentando provedor terciário (Catbox.moe)...');
    const catboxForm = new FormData();
    catboxForm.append('reqtype', 'fileupload');
    catboxForm.append('fileToUpload', new Blob([pngBuffer], { type: 'image/png' }), fileName);

    const catboxRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxForm,
      signal: AbortSignal.timeout(12000)
    });

    if (catboxRes.ok) {
      const url = (await catboxRes.text()).trim();
      if (url.startsWith('http') && (await verifyPublicImageUrl(url))) {
        console.log(`[LOCAL RENDERER] Imagem 1080x1350 hospedada e validada com sucesso via Catbox: ${url}`);
        return url;
      }
    }
  } catch (err) {
    errors.push(`Catbox.moe: ${err.message}`);
    console.warn('[LOCAL RENDERER] Falha no Catbox.moe...', err.message);
  }

  throw new Error(`Falha crítica: Não foi possível hospedar imagem em nenhum provedor público com formato validado. Erros: ${errors.join(' | ')}`);
}

/**
 * Orquestra a geração local em 1080x1350 HD
 * @param {import('./gemini.js').GeneratedPostContent} content
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<{renderId: string, imageUrl: string}>}
 */
export async function renderLocalCard(content, options = {}) {
  const isDryRun = Boolean(options.dryRun ?? config.dryRun);
  console.log('[LOCAL RENDERER] 🎨 Gerando card nativo em ALTA RESOLUÇÃO (1080 x 1350 HD)...');

  // 1. Constrói o SVG baseado no conteúdo
  const svg = buildCardSvg(content);

  // 2. Renderiza para PNG de alta fidelidade
  const pngBuffer = renderSvgToPng(svg);

  // 3. Salva uma cópia física no diretório data/ do projeto para histórico/conferência
  const localFilePath = path.resolve(process.cwd(), 'data', 'latest-card-1080x1350.png');
  fs.writeFileSync(localFilePath, pngBuffer);
  console.log(`[LOCAL RENDERER] Cópia local em alta resolução salva em: ${localFilePath}`);

  // Se estiver em modo DRY-RUN
  if (isDryRun) {
    console.log('[LOCAL RENDERER] [DRY-RUN] Simulação concluída sem upload externo.');
    return {
      renderId: `local-render-simulated-${Date.now()}`,
      imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&h=1350&fit=crop'
    };
  }

  // 4. Faz upload para disponibilizar URL pública para a Meta Instagram Graph API
  const publicUrl = await uploadToPublicHost(pngBuffer);

  return {
    renderId: `local-${Date.now()}`,
    imageUrl: publicUrl
  };
}
