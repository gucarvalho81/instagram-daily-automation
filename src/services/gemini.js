import { config } from '../config.js';

/**
 * Utilitário para aguardar milissegundos (backoff)
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa uma função assíncrona com tentativas (retries) e backoff exponencial
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [maxRetries=3]
 * @param {number} [baseDelay=2000]
 * @returns {Promise<T>}
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[GEMINI] Tentativa ${attempt}/${maxRetries} falhou: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[GEMINI] Aguardando ${delay}ms antes da próxima tentativa...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/**
 * Formata e higieniza a legenda para o Instagram, garantindo leitura arejada com quebras de linha duplas e bullets
 * @param {string} rawCaption
 * @param {string[]} [points]
 * @returns {string}
 */
export function formatCaption(rawCaption, points = []) {
  if (!rawCaption || typeof rawCaption !== 'string') return '';

  let text = rawCaption.trim();

  // Normaliza quebras de linha Windows/Mac para \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Garante que marcadores e bullets (1️⃣, 2️⃣, 3️⃣, 🔹, ▫️, •, 1., 2., 3.) iniciem sempre em nova linha com espaçamento
  text = text.replace(/([^\n])\s*([1-3]️⃣|🔹|▫️|•|\b[1-3]\.)\s+/g, '$1\n\n$2 ');

  // Se os bullets estiverem em linhas consecutivas simples, adiciona linha em branco entre eles
  text = text.replace(/([1-3]️⃣[^\n]+)\n([1-3]️⃣)/g, '$1\n\n$2');
  text = text.replace(/(🔹[^\n]+)\n(🔹)/g, '$1\n\n$2');

  // Garante linha em branco antes da CTA ("Salve este post...")
  text = text.replace(/([^\n])\s*(Salve este post|Gostou\?|Curtiu\?|Compartilhe)/gi, '$1\n\n$2');

  // Garante linha em branco antes do bloco de hashtags e agrupa as hashtags sem quebras individuais
  const firstHashtagIndex = text.search(/#\w+/);
  if (firstHashtagIndex > 0) {
    const beforeHashtags = text.slice(0, firstHashtagIndex).trim();
    const hashtagsPart = text.slice(firstHashtagIndex).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    text = `${beforeHashtags}\n\n${hashtagsPart}`;
  }

  // Normaliza múltiplos espaços e quebras consecutivas excessivas
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Interface do card gerado pelo Gemini
 * @typedef {Object} GeneratedPostContent
 * @property {string} tag - Palavra-chave de categoria em caixa alta (ex: SYSTEM DESIGN, POSTGRESQL, RESILIÊNCIA, DISTRIBUÍDOS)
 * @property {string} titulo - Título curto, chamativo e direto ao ponto (máximo 6 palavras)
 * @property {string} ponto_1 - Regra prática acionável que um engenheiro sênior aplicaria em produção (máx 15 palavras)
 * @property {string} ponto_2 - Regra prática acionável que um engenheiro sênior aplicaria em produção (máx 15 palavras)
 * @property {string} ponto_3 - Regra prática acionável que um engenheiro sênior aplicaria em produção (máx 15 palavras)
 * @property {string} legenda - Explicação técnica contextualizada, com CTA e 5 hashtags
 * @property {string} card_title - Alias de titulo para compatibilidade
 * @property {string} point_1 - Alias de ponto_1
 * @property {string} point_2 - Alias de ponto_2
 * @property {string} point_3 - Alias de ponto_3
 * @property {string} caption - Alias de legenda
 */

/**
 * Gera conteúdo inédito para o Instagram usando a API Gemini 1.5 Flash com persona Staff Engineer
 * @param {Array<{topic_title: string}>} recentPosts - Lista dos últimos posts para proibir repetições
 * @param {string} [theme] - Tema ou prompt base configurado
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.useRealAi]
 * @returns {Promise<GeneratedPostContent>}
 */
export async function generateInstagramPost(recentPosts = [], theme = config.topicTheme, options = {}) {
  const isDryRun = Boolean(options.dryRun ?? config.dryRun);

  // Se estiver em modo DRY-RUN e não for forçada IA real, gera mock técnico simulado
  if (isDryRun && !options.useRealAi) {
    console.log('[GEMINI] [DRY-RUN] Gerando card e legenda técnicos simulados...');
    const nowStr = new Date().toLocaleTimeString('pt-BR');
    const mockTitulo = `Transactional Outbox no Postgres (${nowStr})`;
    const mockPonto1 = 'Grave eventos na mesma transação ACID do seu agregado.';
    const mockPonto2 = 'Use Debezium ou Change Data Capture para streaming Kafka.';
    const mockPonto3 = 'Garante entrega at-least-once sem 2-phase commit complexo.';
    const rawMockLegenda = `Dual-write em microsserviços é a receita perfeita para inconsistência de dados em produção. Se a escrita no banco passar mas a publicação no broker falhar, seu estado fica corrompido.\n\nA solução canônica para esse problema é o Transactional Outbox Pattern:\n\n1️⃣ Persistência Atômica: O evento de domínio é inserido na tabela 'outbox' dentro da exata mesma transação SQL da entidade de negócio.\n\n2️⃣ Desacoplamento do Broker: A aplicação nunca faz chamada de rede síncrona ao Kafka/RabbitMQ durante o ciclo de vida da requisição HTTP.\n\n3️⃣ CDC / Polling Publisher: Um processo em background (como Debezium via WAL do Postgres) lê a tabela e publica no broker com semântica at-least-once.\n\nVocê já enfrentou problemas de dual-write ou inconsistência entre banco e mensageria no seu time?\n\nSalve este post para consultar no seu próximo desenho de arquitetura 📌\n\n#backend #systemdesign #softwareengineering #microservices #cloud`;
    const mockLegenda = formatCaption(rawMockLegenda);

    return {
      tag: 'SYSTEM DESIGN',
      titulo: mockTitulo,
      ponto_1: mockPonto1,
      ponto_2: mockPonto2,
      ponto_3: mockPonto3,
      legenda: mockLegenda,
      card_title: mockTitulo,
      point_1: mockPonto1,
      point_2: mockPonto2,
      point_3: mockPonto3,
      caption: mockLegenda
    };
  }

  const bannedTopics = recentPosts.map((p) => `- ${p.topic_title}`).join('\n');
  const antiRepeatInstruction = bannedTopics
    ? `\n\nATENÇÃO - PROIBIDO REPETIR: Os tópicos a seguir já foram abordados recentemente. NÃO repita esses temas nem crie variações óbvias deles:\n${bannedTopics}`
    : '';

  const systemInstruction = `Atue como um Engenheiro de Software Principal / Staff Engineer e criador de conteúdo técnico de elite.
Seu objetivo é gerar um post diário denso, ultra-prático e sem jargões corporativos vazios para desenvolvedores de software backend.

Gere um conteúdo técnico inédito sobre um destes temas: arquitetura de microsserviços, mensageria (Kafka/RabbitMQ), banco de dados relacionais (Postgres/SQL), padrões de resiliência (Circuit Breaker, Outbox, Retry/Dead-Letter), ou boas práticas de APIs e observabilidade.

Diretrizes estritas de layout e tamanho (CRÍTICO: nunca ultrapasse os limites para não quebrar o layout):
1. "tag": Uma palavra-chave de categoria em caixa alta (ex: SYSTEM DESIGN, POSTGRESQL, RESILIÊNCIA, DISTRIBUÍDOS).
2. "titulo": Título curto e impactante. LIMITE RÍGIDO: MÁXIMO 40 CARACTERES (MÁXIMO 5 PALAVRAS).
3. "ponto_1", "ponto_2", "ponto_3": Dicas práticas e acionáveis de engenharia em produção. LIMITE RÍGIDO: MÁXIMO 75 CARACTERES CADA (1 a 2 linhas curtas). Seja conciso e direto.
4. "legenda": Formate a legenda para leitura rápida e agradável no Instagram, com blocos curtos e arejados SEPARADOS OBRIGATORIAMENTE POR LINHAS EM BRANCO (\\n\\n). NUNCA gere blocos maciços de texto.
Siga rigorosamente a seguinte estrutura:
- Gancho / Problema em 1 a 2 frases curtas.
- Dupla quebra de linha (\\n\\n).
- Contexto / Solução em 1 a 2 frases.
- Dupla quebra de linha (\\n\\n).
- Os 3 pontos práticos detalhados em bullets numerados, cada um com linha em branco entre si:
  1️⃣ Ponto 1: explicação...
  \\n\\n
  2️⃣ Ponto 2: explicação...
  \\n\\n
  3️⃣ Ponto 3: explicação...
- Dupla quebra de linha (\\n\\n).
- Pergunta de engajamento para a comunidade nos comentários.
- Dupla quebra de linha (\\n\\n).
- CTA: "Salve este post para consultar no seu próximo desenho de arquitetura 📌"
- Dupla quebra de linha (\\n\\n).
- 5 hashtags específicas (#backend #systemdesign #softwareengineering #microservices #cloud).`;

  const userPrompt = `Gere agora um post técnico inédito seguindo estritamente as diretrizes acima.${antiRepeatInstruction}
Contexto ou preferência adicional do tema: "${theme}"
LEMBRE-SE: Titulo curto (máx 40 chars, máx 5 palavras). Pontos do card com máx 75 caracteres cada.
LEGENDA: Use quebras de linha duplas (\\n\\n) entre parágrafos e bullets 1️⃣, 2️⃣, 3️⃣ para garantir leitura limpa e espaçada no feed.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          tag: {
            type: 'STRING',
            description: 'Palavra-chave de categoria em caixa alta (ex: SYSTEM DESIGN, POSTGRESQL, RESILIÊNCIA, DISTRIBUÍDOS)'
          },
          titulo: {
            type: 'STRING',
            description: 'Título curto e direto. LIMITE MÁXIMO: 40 caracteres, máx 5 palavras.'
          },
          ponto_1: {
            type: 'STRING',
            description: 'Regra prática acionável em produção. LIMITE MÁXIMO: 75 caracteres (1 a 2 linhas curtas).'
          },
          ponto_2: {
            type: 'STRING',
            description: 'Regra prática acionável em produção. LIMITE MÁXIMO: 75 caracteres (1 a 2 linhas curtas).'
          },
          ponto_3: {
            type: 'STRING',
            description: 'Regra prática acionável em produção. LIMITE MÁXIMO: 75 caracteres (1 a 2 linhas curtas).'
          },
          legenda: {
            type: 'STRING',
            description: 'Legenda formatada com quebras de linha duplas (\\n\\n), bullets 1️⃣ 2️⃣ 3️⃣ espaçados, CTA e 5 hashtags.'
          }
        },
        required: ['tag', 'titulo', 'ponto_1', 'ponto_2', 'ponto_3', 'legenda']
      },
      temperature: 0.7
    }
  };

  const candidateModels = Array.from(
    new Set([config.geminiModel, 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'].filter(Boolean))
  );

  let lastError;
  for (const modelName of candidateModels) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.geminiApiKey}`;

    try {
      return await withRetry(async () => {
        console.log(`[GEMINI] Solicitando geração de post ao modelo ${modelName}...`);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(35000)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status} ao chamar Gemini API (${modelName}): ${errorText}`);
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawContent) {
          throw new Error('A resposta da API do Gemini não continha texto válido.');
        }

        const parsed = JSON.parse(rawContent);

        // Suporta campos em formato português (primário) e mapeia para os aliases
        const tag = parsed.tag || 'SYSTEM DESIGN';
        const titulo = parsed.titulo || parsed.card_title;
        const ponto_1 = parsed.ponto_1 || parsed.point_1;
        const ponto_2 = parsed.ponto_2 || parsed.point_2;
        const ponto_3 = parsed.ponto_3 || parsed.point_3;
        const legenda = formatCaption(parsed.legenda || parsed.caption, [ponto_1, ponto_2, ponto_3]);

        console.log(`[GEMINI] Post gerado com sucesso via ${modelName}: [${tag}] "${titulo}"`);

        return {
          tag,
          titulo,
          ponto_1,
          ponto_2,
          ponto_3,
          legenda,
          card_title: titulo,
          point_1: ponto_1,
          point_2: ponto_2,
          point_3: ponto_3,
          caption: legenda
        };
      }, 2, 1500);
    } catch (err) {
      lastError = err;
      console.warn(`[GEMINI] Modelo ${modelName} indisponível (${err.message.slice(0, 80)}...). Tentando modelo de fallback...`);
    }
  }

  throw lastError;
}
