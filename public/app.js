/**
 * InstaAuto AI - Controlador do Frontend SPA
 */

document.addEventListener('DOMContentLoaded', () => {
  // Estado da aplicação
  let currentTab = 'overview';
  let isRunning = false;
  let activeInstagramUsername = 'thebackenddrop';

  function getPostInstagramUrl(post) {
    if (post && post.permalink && typeof post.permalink === 'string' && post.permalink.startsWith('http')) {
      return post.permalink;
    }
    const username = activeInstagramUsername || 'thebackenddrop';
    return `https://www.instagram.com/${username}/`;
  }

  function updateSidebarInstagramLinks(username) {
    activeInstagramUsername = (username || 'thebackenddrop').replace(/^@/, '');
    const sidebarLink = document.getElementById('sidebar-instagram-link');
    const sidebarHandle = document.getElementById('sidebar-ig-handle');
    const latestIgHandle = document.getElementById('latest-ig-handle');
    const previewInstaHandle = document.getElementById('preview-insta-handle');
    if (sidebarLink) {
      sidebarLink.href = `https://www.instagram.com/${activeInstagramUsername}/`;
    }
    if (sidebarHandle) {
      sidebarHandle.textContent = activeInstagramUsername;
    }
    if (latestIgHandle) {
      latestIgHandle.textContent = activeInstagramUsername;
    }
    if (previewInstaHandle) {
      previewInstaHandle.textContent = `@${activeInstagramUsername}`;
    }
  }

  /**
   * Converte a data salva em UTC (SQLite ou ISO-8601) para o fuso horário local do usuário formatado
   * @param {string|Date} dateStr
   * @returns {string}
   */
  function formatPostDate(dateStr) {
    if (!dateStr) return 'Data não informada';
    let cleanStr = String(dateStr).trim();
    // Se for formato padrão do SQLite "YYYY-MM-DD HH:MM:SS" (em UTC), adiciona Z para parsing correto
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cleanStr)) {
      cleanStr = cleanStr.replace(' ', 'T') + 'Z';
    }
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Elementos do DOM
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const pulseIndicator = document.getElementById('pulse-indicator');
  const statusText = document.getElementById('status-text');
  const sidebarCron = document.getElementById('sidebar-cron');

  // Banners de Onboarding & Feedback de Execução
  const onboardingBanner = document.getElementById('onboarding-banner');
  const btnOnboardingKeys = document.getElementById('btn-onboarding-keys');
  const btnOnboardingDryrun = document.getElementById('btn-onboarding-dryrun');
  const executionFeedbackBanner = document.getElementById('execution-feedback-banner');
  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackTitle = document.getElementById('feedback-title');
  const feedbackMessage = document.getElementById('feedback-message');
  const btnCloseFeedback = document.getElementById('btn-close-feedback');
  let lastSeenExecutionTimestamp = 0;

  // Métricas
  const metricScheduleTime = document.getElementById('metric-schedule-time');
  const metricScheduleTz = document.getElementById('metric-schedule-tz');
  const metricGeminiModel = document.getElementById('metric-gemini-model');
  const metricTotalPosts = document.getElementById('metric-total-posts');
  const badgeTotalPosts = document.getElementById('badge-total-posts');

  // Último Post
  const latestPostImg = document.getElementById('latest-post-img');
  const latestPostTag = document.getElementById('latest-post-tag');
  const latestPostTitle = document.getElementById('latest-post-title');
  const latestPostPoints = document.getElementById('latest-post-points');
  const latestPostCaption = document.getElementById('latest-post-caption');
  const latestPostDate = document.getElementById('latest-post-date');
  const latestInstagramLink = document.getElementById('latest-instagram-link');

  // Botões de Ação Topbar
  const btnQuickDryrun = document.getElementById('btn-quick-dryrun');
  const btnQuickPublish = document.getElementById('btn-quick-publish');

  // Prévia & Laboratório
  const previewCustomTheme = document.getElementById('preview-custom-theme');
  const btnGeneratePreview = document.getElementById('btn-generate-preview');
  const previewLoader = document.getElementById('preview-loader');
  const previewRenderedImg = document.getElementById('preview-rendered-img');
  const previewTextBox = document.getElementById('preview-text-box');
  const previewTag = document.getElementById('preview-tag');
  const previewTitle = document.getElementById('preview-title');
  const previewPointsList = document.getElementById('preview-points-list');
  const previewCaptionOutput = document.getElementById('preview-caption-output');
  const previewCaptionSnippet = document.getElementById('preview-caption-snippet');
  const btnCopyLatestCaption = document.getElementById('btn-copy-latest-caption');
  const btnCopyPreviewCaption = document.getElementById('btn-copy-preview-caption');
  const pills = document.querySelectorAll('.pill');

  // Histórico
  const historyGridContainer = document.getElementById('history-grid-container');
  const btnRefreshHistory = document.getElementById('btn-refresh-history');

  // Configurações
  const formGeminiSettings = document.getElementById('form-gemini-settings');
  const formMetaSettings = document.getElementById('form-meta-settings');
  const formThemeSettings = document.getElementById('form-theme-settings');
  const cfgGeminiKey = document.getElementById('cfg-gemini-key');
  const cfgGeminiModel = document.getElementById('cfg-gemini-model');
  const geminiKeyStatus = document.getElementById('gemini-key-status');
  const btnTestGemini = document.getElementById('btn-test-gemini');
  const cfgMetaUsername = document.getElementById('cfg-meta-username');
  const cfgMetaId = document.getElementById('cfg-meta-id');
  const cfgMetaToken = document.getElementById('cfg-meta-token');
  const metaTokenStatus = document.getElementById('meta-token-status');
  const btnTestMeta = document.getElementById('btn-test-meta');
  const cfgTopicTheme = document.getElementById('cfg-topic-theme');
  const cfgScheduleTime = document.getElementById('cfg-schedule-time');
  const cfgTimezone = document.getElementById('cfg-timezone');

  // Novos Formulários: Nicho & Segurança
  const formNicheSettings = document.getElementById('form-niche-settings');
  const formSecuritySettings = document.getElementById('form-security-settings');
  const cfgNicheLabel = document.getElementById('cfg-niche-label');
  const cfgCardCta = document.getElementById('cfg-card-cta');
  const cfgHashtags = document.getElementById('cfg-hashtags');
  const cfgDashboardPassword = document.getElementById('cfg-dashboard-password');
  const securityPwdStatus = document.getElementById('security-pwd-status');

  // Modal de Autenticação & Sidebar Lock
  const authModal = document.getElementById('auth-modal');
  const modalPasswordInput = document.getElementById('modal-password-input');
  const modalAuthError = document.getElementById('modal-auth-error');
  const formLoginModal = document.getElementById('form-login-modal');
  const btnModalUnlock = document.getElementById('btn-modal-unlock');
  const sidebarAuthBox = document.getElementById('sidebar-auth-box');
  const btnSidebarLogout = document.getElementById('btn-sidebar-logout');

  // Token de sessão em memória e sessionStorage
  let authToken = sessionStorage.getItem('instaauto_token') || '';

  function showAuthModal() {
    if (authModal) {
      authModal.style.display = 'flex';
      modalPasswordInput.value = '';
      if (modalAuthError) modalAuthError.style.display = 'none';
      setTimeout(() => modalPasswordInput.focus(), 150);
    }
  }

  function hideAuthModal() {
    if (authModal) {
      authModal.style.display = 'none';
      if (modalAuthError) modalAuthError.style.display = 'none';
    }
  }

  // Wrapper para chamadas HTTP com injeção automática de Bearer Token
  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken && !options.headers['Authorization']) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
      showAuthModal();
    }
    return res;
  }

  // Notificações Toast
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✔' : '✖'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // Navegação entre Abas
  const tabTitles = {
    overview: {
      title: 'Visão Geral da Automação',
      subtitle: 'Monitore as publicações, métricas e o status do motor autônomo'
    },
    preview: {
      title: 'Laboratório & Prévia Instantânea',
      subtitle: 'Gere e visualize o card e o texto em alta definição antes de publicar no Instagram'
    },
    history: {
      title: 'Histórico de Publicações',
      subtitle: 'Navegue pelos posts gerados pelo Gemini e persistidos no banco local SQLite'
    },
    settings: {
      title: 'Configurações de Chaves & Agendamento',
      subtitle: 'Gerencie credenciais da Google, Meta Graph API e rotinas diárias com segurança'
    }
  };

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  function switchTab(tabName) {
    currentTab = tabName;
    navItems.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
    tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === `tab-${tabName}`));

    if (tabTitles[tabName]) {
      pageTitle.textContent = tabTitles[tabName].title;
      pageSubtitle.textContent = tabTitles[tabName].subtitle;
    }

    if (tabName === 'history') {
      loadHistory();
    } else if (tabName === 'settings') {
      loadConfig();
    }
  }

  // 1. Carregar Status do Sistema
  async function loadStatus() {
    try {
      const res = await apiFetch('/api/status');
      if (!res.ok) return;
      const data = await res.json();

      // Controle de exibição do Lock Screen e botão de logout
      if (data.authRequired) {
        if (!data.authenticated && !authToken) {
          showAuthModal();
        } else {
          hideAuthModal();
        }
        if (sidebarAuthBox) sidebarAuthBox.style.display = 'block';
      } else {
        hideAuthModal();
        if (sidebarAuthBox) sidebarAuthBox.style.display = 'none';
      }

      const wasRunning = isRunning;
      isRunning = data.isPipelineRunning;
      if (isRunning) {
        pulseIndicator.className = 'pulse-dot running';
        statusText.textContent = 'Processando Post...';
      } else {
        pulseIndicator.className = 'pulse-dot active';
        statusText.textContent = 'Sistema Ativo';
      }

      // Banner Amigável de Onboarding
      if (onboardingBanner) {
        if (data.hasGeminiKey === false || data.hasMetaCredentials === false) {
          onboardingBanner.style.display = 'flex';
        } else {
          onboardingBanner.style.display = 'none';
        }
      }

      // Banner e Feedback da Execução
      if (data.lastExecution && executionFeedbackBanner) {
        const isNewExecution = data.lastExecution.timestamp !== lastSeenExecutionTimestamp;
        if (isNewExecution) {
          lastSeenExecutionTimestamp = data.lastExecution.timestamp;
          executionFeedbackBanner.style.display = 'flex';
          executionFeedbackBanner.className = `execution-feedback-banner ${data.lastExecution.success ? 'success' : 'error'}`;
          if (feedbackIcon) feedbackIcon.textContent = data.lastExecution.success ? '🎉' : '⚠️';
          if (feedbackTitle) {
            feedbackTitle.textContent = data.lastExecution.success
              ? `Execução Concluída com Sucesso (${data.lastExecution.mode})`
              : `Falha na Execução (${data.lastExecution.mode})`;
          }
          if (feedbackMessage) {
            feedbackMessage.textContent = data.lastExecution.message || data.lastExecution.error;
          }

          // Se acabou de finalizar uma execução em background acompanhada pelo usuário
          if (wasRunning && !isRunning) {
            showToast(data.lastExecution.message || 'Ciclo de automação concluído!', data.lastExecution.success ? 'success' : 'error');
            if (data.lastExecution.success) {
              loadHistory();
            }
          }
        }
      }

      sidebarCron.textContent = `Agendado: ${data.scheduleTime || '--:--'}`;
      metricScheduleTime.textContent = data.scheduleTime || '--:--';
      metricScheduleTz.textContent = `Fuso: ${data.timezone || 'America/Sao_Paulo'}`;
      metricTotalPosts.textContent = data.totalPosts || 0;
      badgeTotalPosts.textContent = data.totalPosts || 0;

      if (data.instagramUsername) {
        updateSidebarInstagramLinks(data.instagramUsername);
      }

      // Renderizar o último post
      if (data.lastPost) {
        renderLatestPost(data.lastPost);
      }
    } catch (err) {
      console.warn('Erro ao carregar status:', err.message);
    }
  }

  function renderLatestPost(post) {
    // Extrai tag se estiver no padrão [TAG]
    let tag = 'TECNOLOGIA';
    let title = post.topic_title || 'Post Publicado';
    if (title.startsWith('[') && title.includes(']')) {
      const closing = title.indexOf(']');
      tag = title.slice(1, closing);
      title = title.slice(closing + 1).trim();
    }

    const isSimulated = post.status === 'SIMULATED';
    latestPostTag.innerHTML = isSimulated 
      ? `<span style="color: #f59e0b;">🧪 ${tag} (SIMULADO)</span>`
      : tag;
    latestPostTitle.textContent = title;
    latestPostCaption.textContent = post.caption || 'Sem legenda cadastrada.';
    latestPostDate.textContent = formatPostDate(post.created_at) + (isSimulated ? ' • Teste Dry-Run' : ' • Publicado no Feed');

    // Pontos
    latestPostPoints.innerHTML = '';
    [post.point_1, post.point_2, post.point_3].filter(Boolean).forEach((pt, idx) => {
      const div = document.createElement('div');
      div.className = 'point-item';
      div.innerHTML = `<span class="point-num">0${idx + 1}</span> <span>${pt}</span>`;
      latestPostPoints.appendChild(div);
    });

    // Link para o Instagram
    const postUrl = getPostInstagramUrl(post);
    const igUser = activeInstagramUsername || 'thebackenddrop';
    latestInstagramLink.href = postUrl;
    latestInstagramLink.style.display = 'inline-flex';
    if (isSimulated) {
      latestInstagramLink.innerHTML = `<span>🧪</span> Modo Simulação (Não publicado no Feed)`;
      latestInstagramLink.style.opacity = '0.75';
    } else if (post.permalink && post.permalink.startsWith('http')) {
      latestInstagramLink.innerHTML = `<span>🔗</span> Ver Post no @${igUser} ↗`;
      latestInstagramLink.style.opacity = '1';
    } else {
      latestInstagramLink.innerHTML = `<span>🔗</span> Ver no Instagram (@${igUser}) ↗`;
      latestInstagramLink.style.opacity = '1';
    }

    // Imagem do Card
    if (post.image_url) {
      latestPostImg.src = post.image_url;
    } else {
      latestPostImg.src = '/api/media/latest-card-1080x1350.png';
    }
  }

  // 2. Carregar Configurações
  async function loadConfig() {
    try {
      const res = await apiFetch('/api/config');
      if (!res.ok) return;
      const data = await res.json();

      metricGeminiModel.textContent = data.geminiModel || 'Gemini Flash';
      if (cfgGeminiModel) cfgGeminiModel.value = data.geminiModel || 'gemini-3.5-flash';

      if (cfgTopicTheme) cfgTopicTheme.value = data.topicTheme || '';
      if (cfgScheduleTime) cfgScheduleTime.value = data.scheduleTime || '09:00';
      if (cfgTimezone) cfgTimezone.value = data.timezone || 'America/Sao_Paulo';

      if (data.instagramUsername) {
        updateSidebarInstagramLinks(data.instagramUsername);
      }
      if (cfgMetaUsername) cfgMetaUsername.value = data.instagramUsername || 'thebackenddrop';
      if (cfgMetaId) cfgMetaId.value = data.metaIgAccountId || '';

      // Campos de Nicho & Rodapé
      if (cfgNicheLabel) cfgNicheLabel.value = data.nicheLabel || '';
      if (cfgCardCta) cfgCardCta.value = data.cardCta || '';
      if (cfgHashtags) cfgHashtags.value = data.defaultHashtags || '';

      // Status da Proteção do Dashboard
      if (securityPwdStatus) {
        if (data.hasDashboardPassword) {
          securityPwdStatus.textContent = 'Status atual: Painel protegido por senha ativa 🔒';
          securityPwdStatus.style.color = 'var(--accent-emerald)';
        } else {
          securityPwdStatus.textContent = 'Status atual: Acesso livre sem senha 🔓 (localhost)';
          securityPwdStatus.style.color = 'var(--text-muted)';
        }
      }

      geminiKeyStatus.textContent = data.hasGeminiKey
        ? `Chave configurada: ${data.geminiApiKeyMasked} (Ativa)`
        : '⚠️ Nenhuma chave do Gemini configurada!';
      geminiKeyStatus.style.color = data.hasGeminiKey ? 'var(--accent-emerald)' : 'var(--accent-rose)';

      metaTokenStatus.textContent = data.hasMetaToken
        ? `Token configurado: ${data.metaAccessTokenMasked}`
        : '⚠️ Nenhum token da Meta configurado!';
      metaTokenStatus.style.color = data.hasMetaToken ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    } catch (err) {
      console.warn('Erro ao carregar configs:', err.message);
    }
  }

  // 3. Carregar Galeria do Histórico
  async function loadHistory() {
    try {
      historyGridContainer.innerHTML = '<p style="color: var(--text-dim); padding: 20px;">Carregando histórico...</p>';
      const res = await apiFetch('/api/posts?limit=30');
      if (!res.ok) return;
      const data = await res.json();

      if (data.instagramUsername) {
        updateSidebarInstagramLinks(data.instagramUsername);
      }

      if (!data.posts || data.posts.length === 0) {
        historyGridContainer.innerHTML = '<p style="color: var(--text-dim); padding: 20px;">Nenhum post registrado ainda.</p>';
        return;
      }

      historyGridContainer.innerHTML = '';
      data.posts.forEach((post) => {
        let tag = 'TECNOLOGIA';
        let title = post.topic_title || 'Post';
        if (title.startsWith('[') && title.includes(']')) {
          const closing = title.indexOf(']');
          tag = title.slice(1, closing);
          title = title.slice(closing + 1).trim();
        }

        const igUser = activeInstagramUsername || data.instagramUsername || 'thebackenddrop';
        const postLink = getPostInstagramUrl(post);

        const isSimulated = post.status === 'SIMULATED';
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
          <img class="history-card-img" src="${post.image_url || '/api/media/latest-card-1080x1350.png'}" alt="${title}" onerror="this.src='https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&h=1350&fit=crop'" />
          <div class="history-card-content">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 8px;">
              <span class="post-tag-badge">${tag}</span>
              ${isSimulated ? '<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">SIMULAÇÃO</span>' : '<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">PUBLICADO</span>'}
            </div>
            <h4 class="history-card-title">${title}</h4>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
              • ${post.point_1 || ''}<br/>
              • ${post.point_2 || ''}
            </div>
            ${isSimulated 
              ? `<span class="btn btn-outline btn-sm" style="margin-top: 6px; opacity: 0.6; cursor: default;">🧪 Teste Local</span>` 
              : `<a href="${postLink}" target="_blank" class="btn btn-outline btn-sm" style="margin-top: 6px;">Ver no @${igUser} ↗</a>`}
            <span class="history-card-date">${formatPostDate(post.created_at)}</span>
          </div>
        `;
        historyGridContainer.appendChild(card);
      });
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err.message);
    }
  }

  // 4. Ações de Disparo (Produção e Dry-Run)
  btnQuickPublish?.addEventListener('click', async () => {
    if (!confirm('Deseja realmente disparar a esteira oficial AGORA para publicar no Feed do seu Instagram?')) {
      return;
    }
    await triggerExecution(false);
  });

  btnQuickDryrun?.addEventListener('click', async () => {
    await triggerExecution(true);
  });

  async function triggerExecution(isDryRun) {
    try {
      showToast(`Iniciando esteira em modo ${isDryRun ? 'DRY-RUN' : 'PRODUÇÃO'}...`, 'success');
      const res = await apiFetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: isDryRun })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        loadStatus();
      } else {
        showToast(data.message || 'Falha ao iniciar esteira.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // 5. Laboratório & Prévia Instantânea
  pills.forEach((p) => {
    p.addEventListener('click', () => {
      previewCustomTheme.value = p.getAttribute('data-theme');
    });
  });

  btnGeneratePreview?.addEventListener('click', async () => {
    const theme = previewCustomTheme.value.trim();
    previewLoader.style.display = 'flex';
    btnGeneratePreview.disabled = true;

    try {
      const res = await apiFetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar prévia');

      // Atualiza mockup
      previewRenderedImg.src = data.imageUrl;
      previewCaptionSnippet.textContent = data.content.legenda || '';

      // Atualiza detalhes
      previewTextBox.style.display = 'block';
      previewTag.textContent = data.content.tag || 'SYSTEM DESIGN';
      previewTitle.textContent = data.content.titulo || data.content.card_title || '';
      previewPointsList.innerHTML = `
        <li>${data.content.ponto_1 || data.content.point_1}</li>
        <li>${data.content.ponto_2 || data.content.point_2}</li>
        <li>${data.content.ponto_3 || data.content.point_3}</li>
      `;
      previewCaptionOutput.textContent = data.content.legenda || data.content.caption;

      showToast('Prévia e Card 1080x1350 gerados com sucesso!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      previewLoader.style.display = 'none';
      btnGeneratePreview.disabled = false;
    }
  });

  // Copiar Legenda do Último Post
  btnCopyLatestCaption?.addEventListener('click', () => {
    const text = latestPostCaption.textContent || '';
    if (!text || text === 'Carregando legenda...' || text === 'Sem legenda cadastrada.') {
      showToast('Nenhuma legenda disponível para cópia.', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast('Legenda copiada com sucesso!', 'success');
    }).catch(() => {
      showToast('Erro ao copiar legenda.', 'error');
    });
  });

  // Copiar Legenda da Prévia
  btnCopyPreviewCaption?.addEventListener('click', () => {
    const text = previewCaptionOutput.textContent || '';
    if (!text) {
      showToast('Gere uma prévia antes de copiar a legenda.', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast('Legenda da prévia copiada com sucesso!', 'success');
    }).catch(() => {
      showToast('Erro ao copiar legenda.', 'error');
    });
  });

  // 6. Teste de Conexão do Gemini
  btnTestGemini?.addEventListener('click', async () => {
    const key = cfgGeminiKey.value.trim();
    btnTestGemini.disabled = true;
    btnTestGemini.textContent = 'Testando...';

    try {
      const res = await apiFetch('/api/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Conexão com Gemini validada com sucesso!', 'success');
        geminiKeyStatus.textContent = `Conexão bem sucedida! ${data.models?.length || 0} modelos compatíveis.`;
        geminiKeyStatus.style.color = 'var(--accent-emerald)';
      } else {
        showToast(data.message || 'Falha ao validar chave do Gemini.', 'error');
        geminiKeyStatus.textContent = data.message;
        geminiKeyStatus.style.color = 'var(--accent-rose)';
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnTestGemini.disabled = false;
      btnTestGemini.textContent = '⚡ Testar Conexão';
    }
  });

  // Teste de Conexão da Meta Graph API
  btnTestMeta?.addEventListener('click', async () => {
    const token = cfgMetaToken.value.trim();
    const accountId = cfgMetaId.value.trim();
    btnTestMeta.disabled = true;
    btnTestMeta.textContent = 'Testando...';

    try {
      const res = await apiFetch('/api/test-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token || undefined,
          accountId: accountId || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        metaTokenStatus.textContent = data.message;
        metaTokenStatus.style.color = 'var(--accent-emerald)';
      } else {
        showToast(data.message || 'Falha ao validar credenciais da Meta.', 'error');
        metaTokenStatus.textContent = data.message;
        metaTokenStatus.style.color = 'var(--accent-rose)';
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnTestMeta.disabled = false;
      btnTestMeta.textContent = '⚡ Testar Conexão';
    }
  });

  // Listeners dos Banners de Onboarding e Feedback
  btnOnboardingKeys?.addEventListener('click', () => switchTab('settings'));
  btnOnboardingDryrun?.addEventListener('click', () => triggerExecution(true));
  btnCloseFeedback?.addEventListener('click', () => {
    if (executionFeedbackBanner) executionFeedbackBanner.style.display = 'none';
  });

  // 7. Formulários de Configurações
  formGeminiSettings?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      geminiModel: cfgGeminiModel.value
    };
    if (cfgGeminiKey.value.trim()) {
      payload.geminiApiKey = cfgGeminiKey.value.trim();
    }
    await saveSettings(payload, 'Configurações do Gemini atualizadas!');
    cfgGeminiKey.value = '';
  });

  formMetaSettings?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      metaIgAccountId: cfgMetaId.value.trim(),
      instagramUsername: cfgMetaUsername ? cfgMetaUsername.value.trim().replace(/^@/, '') : 'thebackenddrop'
    };
    if (cfgMetaToken.value.trim()) {
      payload.metaAccessToken = cfgMetaToken.value.trim();
    }
    await saveSettings(payload, 'Credenciais da Meta salvas!');
    cfgMetaToken.value = '';
  });

  formThemeSettings?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      topicTheme: cfgTopicTheme.value.trim(),
      scheduleTime: cfgScheduleTime.value,
      timezone: cfgTimezone.value
    };
    await saveSettings(payload, 'Tema e agendamento atualizados!');
  });

  async function saveSettings(payload, successMsg) {
    try {
      const res = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(successMsg || 'Salvo com sucesso!', 'success');
        loadConfig();
        loadStatus();
      } else {
        showToast(data.error || 'Erro ao salvar.', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Formulário de Nicho & Rodapé
  formNicheSettings?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nicheLabel: cfgNicheLabel.value.trim(),
      cardCta: cfgCardCta.value.trim(),
      defaultHashtags: cfgHashtags.value.trim()
    };
    await saveSettings(payload, 'Configurações de nicho e rodapé salvas!');
  });

  // Formulário de Segurança (Dashboard Guard)
  formSecuritySettings?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPwd = cfgDashboardPassword.value.trim();
    const payload = {
      dashboardPassword: newPwd
    };
    await saveSettings(payload, newPwd ? 'Senha de proteção do painel ativada!' : 'Proteção por senha desativada (acesso livre).');
    cfgDashboardPassword.value = '';
  });

  // Submissão do Modal de Login
  formLoginModal?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = modalPasswordInput.value.trim();
    if (!password) return;

    btnModalUnlock.disabled = true;
    modalAuthError.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token) {
          authToken = data.token;
          sessionStorage.setItem('instaauto_token', data.token);
        }
        hideAuthModal();
        showToast('Painel desbloqueado com sucesso!', 'success');
        loadStatus();
        loadConfig();
      } else {
        modalAuthError.textContent = data.message || 'Senha incorreta.';
        modalAuthError.style.display = 'block';
      }
    } catch (err) {
      modalAuthError.textContent = 'Falha ao autenticar: ' + err.message;
      modalAuthError.style.display = 'block';
    } finally {
      btnModalUnlock.disabled = false;
    }
  });

  // Botão de Logout no Sidebar
  btnSidebarLogout?.addEventListener('click', async () => {
    if (confirm('Deseja bloquear o painel agora?')) {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      authToken = '';
      sessionStorage.removeItem('instaauto_token');
      showAuthModal();
      showToast('Painel bloqueado com sucesso.', 'success');
    }
  });

  btnRefreshHistory?.addEventListener('click', loadHistory);

  // Inicialização e Polling
  loadStatus();
  loadConfig();
  setInterval(loadStatus, 8000);
});
