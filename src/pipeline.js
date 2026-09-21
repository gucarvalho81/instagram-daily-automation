import { config, validateConfig } from './config.js';
import { getRecentTopics, savePostRecord } from './database.js';
import { generateInstagramPost } from './services/gemini.js';
import { renderLocalCard } from './services/localRenderer.js';
import { createMediaContainer, waitForContainerFinished, publishMedia } from './services/metaInstagram.js';

let isPipelineActive = false;

/**
 * Executa a esteira diária completa de automação do Instagram
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @param {string} [options.theme]
 * @returns {Promise<{success: boolean, postId?: string, cardTitle?: string, executionTimeMs: number}>}
 */
export async function runAutomationPipeline(options = {}) {
  if (isPipelineActive) {
    console.warn('[PIPELINE] A esteira já está em execução neste momento. Rejeitando chamada concorrente.');
    throw new Error('A esteira já está em execução no momento. Aguarde a finalização do ciclo atual.');
  }

  const isDryRun = Boolean(options.dryRun ?? config.dryRun);

  isPipelineActive = true;
  const startTime = Date.now();
  console.log('='.repeat(70));
  console.log(`[PIPELINE] Iniciando esteira de automação do Instagram - ${new Date().toISOString()}`);
  console.log(`[PIPELINE] Modo DRY-RUN: ${isDryRun ? 'ATIVADO (Simulado - Nenhuma publicação será feita no Instagram)' : 'DESATIVADO (Produção Real)'}`);
  console.log('='.repeat(70));

  try {
    // 1. Validação de configurações (em modo simulado, não interrompe se faltar token da Meta)
    validateConfig(!isDryRun);

    // 2. Consulta histórico local para extrair os últimos 15 posts
    console.log('\n[PASSO 1/5] Consultando banco SQLite para evitar temas repetidos...');
    const recentPosts = getRecentTopics(15);
    console.log(`[PASSO 1/5] Encontrados ${recentPosts.length} posts recentes no histórico.`);
    if (recentPosts.length > 0) {
      console.log('Últimos temas abordados:');
      recentPosts.slice(0, 5).forEach((p, idx) => console.log(`  ${idx + 1}. ${p.topic_title}`));
    }

    // 3. Geração de conteúdo inédito via Google Gemini 1.5 Flash
    console.log('\n[PASSO 2/5] Gerando card e legenda via Google Gemini...');
    const postContent = await generateInstagramPost(
      recentPosts,
      options.theme || config.topicTheme,
      { dryRun: isDryRun }
    );
    if (postContent.tag) {
      console.log(`[PASSO 2/5] Tag: [${postContent.tag}]`);
    }
    console.log(`[PASSO 2/5] Título gerado: "${postContent.titulo || postContent.card_title}"`);
    console.log(`[PASSO 2/5] Ponto 1: ${postContent.ponto_1 || postContent.point_1}`);
    console.log(`[PASSO 2/5] Ponto 2: ${postContent.ponto_2 || postContent.point_2}`);
    console.log(`[PASSO 2/5] Ponto 3: ${postContent.ponto_3 || postContent.point_3}`);

    // 4. Renderização do Card (Local 1080x1350 HD nativo)
    console.log('\n[PASSO 3/5] Renderizando imagem via GERADOR LOCAL (1080x1350 HD)...');
    const { renderId, imageUrl } = await renderLocalCard(postContent, { dryRun: isDryRun });
    console.log(`[PASSO 3/5] Imagem ${isDryRun ? 'simulada localmente' : 'pronta na CDN'}: ${imageUrl}`);

    // 5. Envio do container e publicação no Meta Instagram Graph API v21.0
    console.log('\n[PASSO 4/5] Criando container de mídia no Instagram...');
    const containerId = await createMediaContainer(imageUrl, postContent.caption, { dryRun: isDryRun });

    console.log('[PASSO 4/5] Aguardando processamento do container...');
    await waitForContainerFinished(containerId, 20, 5000, { dryRun: isDryRun });

    console.log('[PASSO 4/5] Publicando post oficial no Feed...');
    const publishResult = await publishMedia(containerId, { dryRun: isDryRun });
    const publishedPostId = (publishResult && typeof publishResult === 'object') ? publishResult.id : publishResult;
    const postPermalink = (publishResult && typeof publishResult === 'object') ? publishResult.permalink : null;

    if (isDryRun) {
      console.log(`[PASSO 4/5] [DRY-RUN] Simulação concluída com sucesso! Nenhuma chamada real foi enviada à Meta.`);
    } else {
      console.log(`[PASSO 4/5] Post publicado com sucesso no Instagram! ID: ${publishedPostId}`);
    }

    // 6. Persistência do registro no histórico SQLite
    const dbTitle = postContent.tag
      ? `[${postContent.tag}] ${postContent.titulo || postContent.card_title}`
      : (postContent.titulo || postContent.card_title);

    const dbRecordId = savePostRecord({
      topic_title: dbTitle,
      point_1: postContent.ponto_1 || postContent.point_1,
      point_2: postContent.ponto_2 || postContent.point_2,
      point_3: postContent.ponto_3 || postContent.point_3,
      caption: postContent.legenda || postContent.caption,
      image_url: imageUrl,
      render_id: renderId,
      meta_container_id: containerId,
      meta_post_id: publishedPostId,
      permalink: postPermalink,
      status: isDryRun ? 'SIMULATED' : 'PUBLISHED'
    });
    console.log(`[PASSO 5/5] Histórico salvo com sucesso! ID do registro local: ${dbRecordId} (Status: ${isDryRun ? 'SIMULATED' : 'PUBLISHED'})`);

    const duration = Date.now() - startTime;
    console.log('\n' + '='.repeat(70));
    console.log(`[PIPELINE CONCLUÍDO COM SUCESSO EM ${(duration / 1000).toFixed(2)}s - MODO: ${isDryRun ? 'SIMULADO (DRY-RUN)' : 'PRODUÇÃO'}]`);
    const finalTitle = postContent.titulo || postContent.card_title || 'Sem título';
    console.log(`Título: ${finalTitle}`);
    console.log(`Instagram Post ID: ${publishedPostId}`);
    if (postPermalink) console.log(`Instagram Link: ${postPermalink}`);
    console.log('='.repeat(70));

    return {
      success: true,
      postId: publishedPostId,
      cardTitle: finalTitle,
      executionTimeMs: duration,
      dryRun: isDryRun
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n' + '!'.repeat(70));
    console.error(`[PIPELINE FALHOU APÓS ${(duration / 1000).toFixed(2)}s]`);
    console.error(`Detalhes do erro: ${error.message}`);
    console.error(error.stack);
    console.error('!'.repeat(70));
    throw error;
  } finally {
    isPipelineActive = false;
  }
}
