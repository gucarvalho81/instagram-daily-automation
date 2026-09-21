import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, savePostRecord, getRecentTopics, updatePostRecord } from '../src/database.js';
import { buildCardSvg, renderSvgToPng, renderLocalCard } from '../src/services/localRenderer.js';
import { validateConfig, config } from '../src/config.js';
import { generateInstagramPost, formatCaption } from '../src/services/gemini.js';

console.log('='.repeat(70));
console.log('🧪 [SUÍTE DE TESTES UNITÁRIOS] Iniciando validação completa da automação...');
console.log('='.repeat(70));

// -----------------------------------------------------------------------------
// 1. Testes de Banco de Dados (SQLite nativo em memória)
// -----------------------------------------------------------------------------
console.log('\n📦 [BLOCO 1] Testes do Banco de Dados SQLite (node:sqlite)...');

const testDb = getDatabase(':memory:');
assert.ok(testDb, 'A instância do banco em memória deve ser inicializada com sucesso.');

console.log('  ✔ Inserindo 20 posts simulados no histórico...');
for (let i = 1; i <= 20; i++) {
  const insertId = savePostRecord(
    {
      topic_title: `Dica de Arquitetura #${i}`,
      point_1: `Ponto prático 1 da dica #${i}`,
      point_2: `Ponto prático 2 da dica #${i}`,
      point_3: `Ponto prático 3 da dica #${i}`,
      caption: `Legenda completa da dica #${i} com #dev`,
      image_url: `https://cdn.example.com/cards/card-${i}.png`,
      render_id: `render-local-${i}`,
      meta_container_id: `container-id-${i}`,
      meta_post_id: `post-id-${i}`,
      status: 'PUBLISHED'
    },
    testDb
  );
  assert.equal(insertId, i, `O ID inserido deve ser incremental (${i})`);
}

console.log('  ✔ Validando filtro anti-repetição (limite estrito de 15 posts)...');
const recentTopics = getRecentTopics(15, testDb);
assert.equal(recentTopics.length, 15, 'Deve retornar exatamente os últimos 15 posts.');
assert.equal(recentTopics[0].topic_title, 'Dica de Arquitetura #20', 'O post mais recente deve ser o #20 (ordenação DESC).');
assert.equal(recentTopics[14].topic_title, 'Dica de Arquitetura #6', 'O 15º post deve ser o #6.');

console.log('  ✔ Validando atualização de status e metadados de publicação...');
updatePostRecord(1, { status: 'ARCHIVED', meta_post_id: 'updated-post-1' }, testDb);
const updatedPost = testDb.prepare('SELECT status, meta_post_id FROM posts_history WHERE id = 1').get();
assert.equal(updatedPost.status, 'ARCHIVED', 'O status deve ser atualizado para ARCHIVED.');
assert.equal(updatedPost.meta_post_id, 'updated-post-1', 'O ID do post da Meta deve ser atualizado.');

// -----------------------------------------------------------------------------
// 2. Testes do Motor Gráfico Nativo (localRenderer)
// -----------------------------------------------------------------------------
console.log('\n🎨 [BLOCO 2] Testes do Gerador Gráfico Local HD (1080x1350)...');

const mockContent = {
  tag: 'RESILIÊNCIA & TESTE',
  titulo: 'Circuit Breaker <Pattern> em Produção & Alta Carga',
  ponto_1: 'Monitore taxa de erro > 50% em janelas de 10s.',
  ponto_2: 'Abra o circuito e retorne fallback instantâneo.',
  ponto_3: 'Use estado half-open com tráfego "canary" reduzido.',
  legenda: 'Legenda explicativa para teste com hashtags.'
};

console.log('  ✔ Validando construção de SVG e sanitização de XML...');
const svg = buildCardSvg(mockContent);
assert.ok(svg.includes('width="1080"'), 'O SVG deve conter a largura exata de 1080px.');
assert.ok(svg.includes('height="1350"'), 'O SVG deve conter a altura exata de 1350px.');
assert.ok(svg.includes('viewBox="0 0 1080 1350"'), 'O viewBox deve ser 0 0 1080 1350.');
assert.ok(svg.includes('&amp;'), 'Caracteres especiais como "&" devem ser devidamente escapados.');
assert.ok(svg.includes('&lt;Pattern&gt;'), 'Tags XML literais como "<Pattern>" devem ser escapadas como &lt;Pattern&gt;.');
assert.ok(svg.includes('RESILIÊNCIA &amp; TESTE'), 'A tag da categoria deve estar presente no SVG.');

console.log('  ✔ Validando renderização SVG -> Buffer PNG via resvg-js...');
const pngBuffer = renderSvgToPng(svg);
assert.ok(Buffer.isBuffer(pngBuffer), 'O resultado deve ser um Buffer válido do Node.js.');
assert.ok(pngBuffer.length > 50000, 'A imagem HD gerada deve ter tamanho consistente (> 50KB).');

// Validação dos primeiros 8 bytes mágicos do formato PNG (89 50 4E 47 0D 0A 1A 0A)
const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
for (let i = 0; i < pngHeader.length; i++) {
  assert.equal(pngBuffer[i], pngHeader[i], `Byte mágico do PNG na posição ${i} deve ser válido.`);
}

console.log('  ✔ Validando renderLocalCard em modo simulação...');
const prevDryRun = config.dryRun;
config.dryRun = true;
try {
  const renderResult = await renderLocalCard(mockContent);
  assert.ok(renderResult.renderId, 'Deve retornar um renderId.');
  assert.ok(renderResult.imageUrl, 'Deve retornar uma URL de imagem.');
  assert.ok(renderResult.imageUrl.startsWith('http'), 'A URL deve ser HTTP(S) válida.');

  const diskPath = path.resolve(process.cwd(), 'data', 'latest-card-1080x1350.png');
  assert.ok(fs.existsSync(diskPath), 'O arquivo físico latest-card-1080x1350.png deve ser salvo no diretório data/.');
} finally {
  config.dryRun = prevDryRun;
}

// -----------------------------------------------------------------------------
// 3. Testes de Configuração e Validações
// -----------------------------------------------------------------------------
console.log('\n⚙️ [BLOCO 3] Testes de Validação de Configurações...');

console.log('  ✔ Validando validateConfig em modo DRY-RUN...');
const originalDryRun = config.dryRun;
config.dryRun = true;
assert.equal(validateConfig(false), true, 'Em modo DRY-RUN, validateConfig deve sempre aprovar a execução.');
config.dryRun = originalDryRun;

console.log('  ✔ Validando integridade das configurações básicas...');
assert.ok(typeof config.geminiModel === 'string' && config.geminiModel.length > 0, 'geminiModel deve estar definido.');
assert.ok(typeof config.scheduleTime === 'string', 'scheduleTime deve ser uma string válida (HH:mm).');
assert.ok(typeof config.timezone === 'string', 'timezone deve ser uma string de fuso horário válida.');

// -----------------------------------------------------------------------------
// 4. Testes de Estrutura de Conteúdo do Gemini e Formatação da Legenda
// -----------------------------------------------------------------------------
console.log('\n🤖 [BLOCO 4] Testes de Estrutura de Conteúdo do Gemini e Formatação da Legenda...');

config.dryRun = true;
try {
  const generated = await generateInstagramPost([], 'Microsserviços e Mensageria');
  assert.ok(generated.titulo || generated.card_title, 'Deve conter um título.');
  assert.ok(generated.ponto_1 || generated.point_1, 'Deve conter o ponto 1.');
  assert.ok(generated.ponto_2 || generated.point_2, 'Deve conter o ponto 2.');
  assert.ok(generated.ponto_3 || generated.point_3, 'Deve conter o ponto 3.');
  assert.ok(generated.legenda || generated.caption, 'Deve conter a legenda com hashtags.');
  assert.ok(generated.tag, 'Deve conter a tag da categoria.');

  // Validação da quebra de linha arejada e bullets
  assert.ok(generated.legenda.includes('\n\n'), 'A legenda deve conter quebras de linha duplas entre parágrafos.');
  assert.ok(generated.legenda.includes('1️⃣') || generated.legenda.includes('•') || generated.legenda.includes('🔹'), 'A legenda deve conter bullets/marcadores visuais.');

  console.log('  ✔ Validando formatCaption com texto denso sem quebras...');
  const uglyDenseText = "Problema crítico em microsserviços. 1️⃣ Primeiro ponto importante. 2️⃣ Segundo ponto importante. 3️⃣ Terceiro ponto importante. Salve este post para consultar depois! #backend #microservices";
  const formatted = formatCaption(uglyDenseText);
  assert.ok(formatted.includes('\n\n1️⃣'), 'formatCaption deve quebrar linha dupla antes do marcador 1️⃣');
  assert.ok(formatted.includes('\n\n2️⃣'), 'formatCaption deve quebrar linha dupla antes do marcador 2️⃣');
  assert.ok(formatted.includes('\n\n3️⃣'), 'formatCaption deve quebrar linha dupla antes do marcador 3️⃣');
  assert.ok(formatted.includes('\n\nSalve este post'), 'formatCaption deve quebrar linha dupla antes da CTA');
  assert.ok(formatted.includes('\n\n#backend'), 'formatCaption deve quebrar linha dupla antes das hashtags');
} finally {
  config.dryRun = originalDryRun;
}

// -----------------------------------------------------------------------------
// 5. Testes do Gerenciador de Configurações (.env & Mascaramento)
// -----------------------------------------------------------------------------
console.log('\n🔐 [BLOCO 5] Testes do ConfigManager e Mascaramento de Chaves...');
const { getSafeConfig } = await import('../src/configManager.js');
const safeCfg = getSafeConfig();
assert.ok(typeof safeCfg.hasGeminiKey === 'boolean', 'hasGeminiKey deve ser booleano.');
assert.ok(typeof safeCfg.hasMetaToken === 'boolean', 'hasMetaToken deve ser booleano.');
assert.ok(typeof safeCfg.geminiApiKeyMasked === 'string', 'geminiApiKeyMasked deve ser string.');
if (safeCfg.geminiApiKeyMasked) {
  assert.ok(safeCfg.geminiApiKeyMasked.includes('...'), 'A chave da API deve estar mascarada com reticências para segurança.');
}

// -----------------------------------------------------------------------------
// 6. Testes de Isolamento e Segurança do Modo Dry-Run (Sem Publicação no Feed)
// -----------------------------------------------------------------------------
console.log('\n🛡️ [BLOCO 6] Testes de Isolamento e Segurança do Modo Dry-Run...');
const { runAutomationPipeline } = await import('../src/pipeline.js');

console.log('  ✔ Executando runAutomationPipeline com { dryRun: true }...');
const pipelineResult = await runAutomationPipeline({ dryRun: true, theme: 'Teste de Segurança Dry-Run' });

assert.strictEqual(pipelineResult.success, true, 'O pipeline deve concluir com sucesso.');
assert.strictEqual(pipelineResult.dryRun, true, 'A flag dryRun do retorno deve ser true.');
assert.ok(
  String(pipelineResult.postId).startsWith('mock-post-'),
  `O postId gerado em modo dry-run deve ser simulado (mock-post-*), recebido: ${pipelineResult.postId}`
);

const defaultDb = getDatabase();
const lastSaved = defaultDb.prepare('SELECT * FROM posts_history ORDER BY id DESC LIMIT 1').get();
assert.strictEqual(
  lastSaved.status,
  'SIMULATED',
  `O status persistido no banco SQLite em modo dry-run DEVE ser rigorosamente 'SIMULATED', recebido: ${lastSaved?.status}`
);
assert.ok(
  String(lastSaved.meta_post_id).startsWith('mock-post-'),
  'O ID da Meta salvo no banco DEVE ser mock, sem IDs reais de post.'
);
console.log('  ✔ Verificado com sucesso: nenhuma chamada foi disparada para a Meta e o status foi registrado como SIMULATED.');

// -----------------------------------------------------------------------------
// 7. Testes do Agendador Diário e Reagendamento Dinâmico
// -----------------------------------------------------------------------------
console.log('\n⏰ [BLOCO 7] Testes do Agendador (parseTimeToCron & Reagendamento)...');
const { parseTimeToCron, startScheduler, reschedule, stopScheduler } = await import('../src/scheduler.js');

console.log('  ✔ Validando conversão de HH:mm para cron...');
assert.equal(parseTimeToCron('09:00'), '0 9 * * *', '09:00 deve converter para "0 9 * * *"');
assert.equal(parseTimeToCron('14:30'), '30 14 * * *', '14:30 deve converter para "30 14 * * *"');
assert.equal(parseTimeToCron('23:59'), '59 23 * * *', '23:59 deve converter para "59 23 * * *"');
assert.equal(parseTimeToCron('invalido'), '0 9 * * *', 'Formato inválido deve retornar padrão "0 9 * * *"');
assert.equal(parseTimeToCron('25:99'), '0 9 * * *', 'Horas/minutos fora do limite devem retornar padrão');

console.log('  ✔ Validando inicialização e reagendamento dinâmico...');
const task = startScheduler('10:00', 'America/Sao_Paulo');
assert.ok(task, 'startScheduler deve retornar uma instância válida de ScheduledTask');
const rescheduledTask = reschedule('11:30', 'America/Sao_Paulo');
assert.ok(rescheduledTask, 'reschedule deve retornar uma nova ScheduledTask');
stopScheduler();

// -----------------------------------------------------------------------------
// 8. Testes do Servidor HTTP Embutido e Endpoints da API REST
// -----------------------------------------------------------------------------
console.log('\n🌐 [BLOCO 8] Testes do Servidor HTTP e API REST...');
const { startServer, stopServer } = await import('../src/server.js');

const TEST_PORT = 3199;
const server = await startServer(TEST_PORT);
assert.ok(server, 'O servidor HTTP deve iniciar na porta de teste com sucesso.');

try {
  // Teste 8.1: GET /api/status
  console.log('  ✔ Validando GET /api/status...');
  const resStatus = await fetch(`http://localhost:${TEST_PORT}/api/status`);
  assert.equal(resStatus.status, 200, 'GET /api/status deve responder 200 OK');
  const dataStatus = await resStatus.json();
  assert.ok(typeof dataStatus.isPipelineRunning === 'boolean', 'isPipelineRunning deve ser booleano');
  assert.ok(typeof dataStatus.totalPosts === 'number', 'totalPosts deve ser numérico');

  // Teste 8.2: GET /api/config
  console.log('  ✔ Validando GET /api/config...');
  const resConfig = await fetch(`http://localhost:${TEST_PORT}/api/config`);
  assert.equal(resConfig.status, 200, 'GET /api/config deve responder 200 OK');
  const dataConfig = await resConfig.json();
  assert.ok(dataConfig.geminiModel, 'geminiModel deve ser retornado');
  assert.ok(typeof dataConfig.hasGeminiKey === 'boolean', 'hasGeminiKey deve ser booleano');

  // Teste 8.3: GET /api/posts
  console.log('  ✔ Validando GET /api/posts...');
  const resPosts = await fetch(`http://localhost:${TEST_PORT}/api/posts?limit=5`);
  assert.equal(resPosts.status, 200, 'GET /api/posts deve responder 200 OK');
  const dataPosts = await resPosts.json();
  assert.ok(Array.isArray(dataPosts.posts), 'posts deve ser um array');

  // Teste 8.4: POST /api/preview (Modo Simulado Rápido)
  console.log('  ✔ Validando POST /api/preview (Geração rápida em dry-run)...');
  const resPreview = await fetch(`http://localhost:${TEST_PORT}/api/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'PostgreSQL Indexes' })
  });
  assert.equal(resPreview.status, 200, 'POST /api/preview deve responder 200 OK');
  const dataPreview = await resPreview.json();
  assert.equal(dataPreview.success, true, 'preview deve retornar success: true');
  assert.ok(dataPreview.imageUrl, 'preview deve retornar imageUrl');
  assert.ok(dataPreview.content, 'preview deve retornar postContent');

  // Teste 8.5: Rota desconhecida /api/* retornando 404 JSON
  console.log('  ✔ Validando tratamento de 404 em rota de API inexistente...');
  const res404 = await fetch(`http://localhost:${TEST_PORT}/api/endpoint-inexistente`);
  assert.equal(res404.status, 404, 'Rota desconhecida deve retornar HTTP 404');
  const data404 = await res404.json();
  assert.ok(data404.error, 'Resposta 404 de API deve conter mensagem de erro em JSON');

  // Teste 8.6: Rota SPA Frontend (GET /)
  console.log('  ✔ Validando entrega do HTML da SPA (GET /)...');
  const resHtml = await fetch(`http://localhost:${TEST_PORT}/`);
  assert.equal(resHtml.status, 200, 'GET / deve retornar HTTP 200');
  const htmlText = await resHtml.text();
  assert.ok(htmlText.includes('InstaAuto'), 'Deve servir a SPA InstaAuto');

} finally {
  stopServer();
}

// -----------------------------------------------------------------------------
// 9. Testes de Robustez e Quebra de Linha do Motor Gráfico SVG
// -----------------------------------------------------------------------------
console.log('\n📐 [BLOCO 9] Testes de Robustez do Layout SVG...');

const multiLineMock = {
  tag: 'ARQUITETURA DE MICROSSERVIÇOS DISTRIBUÍDOS',
  titulo: 'Estratégias de Idempotência e Tratamento de Conflitos em Alta Concorrência',
  ponto_1: 'Utilize chaves de idempotência únicas com expiração no Redis para evitar duplicação.',
  ponto_2: 'Armazene o payload da resposta processada com lock pessimista.',
  ponto_3: 'Retorne status 200 com a resposta original cacheada sem reprocessar regras.',
  legenda: 'Legenda detalhada sobre idempotência com tags.'
};

const longSvg = buildCardSvg(multiLineMock);
assert.ok(longSvg.includes('<tspan'), 'Títulos longos devem ser quebrados em tspans');
assert.ok(longSvg.includes('viewBox="0 0 1080 1350"'), 'O SVG gerado mantém a proporção 1080x1350');
const longPng = renderSvgToPng(longSvg);
assert.ok(Buffer.isBuffer(longPng) && longPng.length > 50000, 'PNG resultante de conteúdo longo deve ser válido e ter resolução total');

console.log('\n' + '='.repeat(70));
console.log('🎉 [TESTES CONCLUÍDOS] 100% dos testes unitários passaram com sucesso!');
console.log('='.repeat(70) + '\n');
