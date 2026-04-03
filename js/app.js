// =============================================
// APP.JS - Controlador Principal
// Bandeira Obras PWA
// =============================================

// ---- Utilitários globais ----

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function setLoading(btn, loading, text = '') {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-sm"></span>${text || ''}`;
    btn.classList.add('btn-loading');
  } else {
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
    btn.classList.remove('btn-loading');
  }
}

// ---- Estado da app ----
let currentView = 'dashboard';
let currentRequestId = null;
let filterState = { status: 'todos', propertyId: '', urgency: '' };

// ---- Inicialização ----

document.addEventListener('DOMContentLoaded', async () => {
  // Registra service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  showScreen('loading');

  // Verifica sessão
  try {
    const session = await Auth.getSession();
    if (session) {
      await initApp();
    } else {
      showScreen('login');
    }
  } catch (e) {
    showScreen('login');
  }

  // Listener de auth
  Auth.onAuthChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      await initApp();
    } else if (event === 'SIGNED_OUT') {
      Notifications.unsubscribe();
      showScreen('login');
    }
  });

  setupLoginForm();
});

// ---- Telas ----

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add('active');
}

// ---- Init App ----

async function initApp() {
  const profile = Auth.getProfile();
  if (!profile) {
    showToast('Perfil não encontrado. Contate o administrador.', 'error');
    await Auth.logout();
    showScreen('login');
    return;
  }

  // Configura UI do usuário
  updateUserUI(profile);

  // Pede permissão de notificação
  await Notifications.requestPermission();

  // Carrega dados iniciais
  await Properties.list();
  await Properties.populateSelects(['filter-imovel', 'nova-imovel']);

  // Atualiza badge de notificações
  const count = await Notifications.getUnreadCount();
  Notifications.updateBadges(count);

  // Inscreve em notificações em tempo real
  Notifications.subscribe();

  // Setup eventos
  setupApp();

  // Mostra tela principal
  showScreen('app');
  navigateTo('dashboard');
}

function updateUserUI(profile) {
  const name = profile.name || profile.email || '?';
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('user-role-label').textContent =
    profile.role === 'responsavel' ? 'Responsável pelas Obras' : 'Sócio';

  // Mostra menu de usuários apenas para sócios
  if (Auth.isAdmin()) {
    document.getElementById('menu-usuarios').style.display = 'flex';
  }
}

// ---- Setup eventos ----

function setupApp() {
  // Header
  document.getElementById('btn-notif').addEventListener('click', () => navigateTo('notificacoes'));
  document.getElementById('btn-back').addEventListener('click', goBack);
  document.getElementById('btn-menu').addEventListener('click', toggleMenu);

  // Fecha menu ao clicar fora
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('dropdown-menu');
    if (!menu.classList.contains('hidden') &&
        !e.target.closest('#dropdown-menu') &&
        !e.target.closest('#btn-menu')) {
      menu.classList.add('hidden');
    }
  });

  // Menu itens
  document.getElementById('menu-imoveis').addEventListener('click', () => {
    document.getElementById('dropdown-menu').classList.add('hidden');
    navigateTo('imoveis');
  });
  document.getElementById('menu-usuarios').addEventListener('click', () => {
    document.getElementById('dropdown-menu').classList.add('hidden');
    navigateTo('usuarios');
  });
  document.getElementById('menu-logout').addEventListener('click', handleLogout);

  // Bottom nav
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });
  document.getElementById('nav-nova').addEventListener('click', () => navigateTo('nova'));

  // Filtros
  document.getElementById('filter-status').addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    filterState.status = tab.dataset.status;
    loadDashboard();
  });
  document.getElementById('filter-imovel').addEventListener('change', (e) => {
    filterState.propertyId = e.target.value;
    loadDashboard();
  });
  document.getElementById('filter-urgencia').addEventListener('change', (e) => {
    filterState.urgency = e.target.value;
    loadDashboard();
  });

  // Formulário nova pendência
  setupNovaForm();

  // Modais imóveis
  setupImoveisModal();

  // Modal usuários
  setupUsuariosModal();

  // Notificações - limpar
  document.getElementById('btn-limpar-notifs').addEventListener('click', async () => {
    await Notifications.markAllRead();
    loadNotificacoes();
    showToast('Todas as notificações marcadas como lidas');
  });

  // Toggle senha
  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

function toggleMenu() {
  document.getElementById('dropdown-menu').classList.toggle('hidden');
}

// ---- Navegação ----

let viewHistory = [];

function navigateTo(viewName, pushHistory = true) {
  const views = ['dashboard', 'nova', 'detalhe', 'imoveis', 'notificacoes', 'usuarios'];
  if (!views.includes(viewName)) return;

  if (pushHistory && currentView !== viewName) {
    viewHistory.push(currentView);
  }
  currentView = viewName;

  // Atualiza views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`)?.classList.add('active');

  // Atualiza bottom nav
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Atualiza header
  const titles = {
    dashboard: 'Pendências',
    nova: 'Nova Pendência',
    detalhe: 'Detalhes',
    imoveis: 'Imóveis',
    notificacoes: 'Notificações',
    usuarios: 'Usuários'
  };
  document.getElementById('page-title').textContent = titles[viewName] || viewName;

  // Botão voltar
  const backBtn = document.getElementById('btn-back');
  const showBack = ['nova', 'detalhe', 'imoveis', 'notificacoes', 'usuarios'].includes(viewName);
  backBtn.classList.toggle('hidden', !showBack);
  document.querySelector('.header-logo').classList.toggle('hidden', showBack);

  // Carrega dados da view
  switch (viewName) {
    case 'dashboard': loadDashboard(); break;
    case 'imoveis': loadImoveis(); break;
    case 'notificacoes': loadNotificacoes(); break;
    case 'usuarios': loadUsuarios(); break;
    case 'nova':
      Requests.initPhotoPicker();
      Requests.clearPendingPhotos();
      document.getElementById('form-nova').reset();
      Properties.populateSelects(['nova-imovel']);
      document.getElementById('photo-preview').innerHTML = '';
      document.getElementById('nova-error').classList.add('hidden');
      break;
  }
}

function goBack() {
  if (viewHistory.length > 0) {
    const prev = viewHistory.pop();
    navigateTo(prev, false);
  } else {
    navigateTo('dashboard', false);
  }
}

// ---- Login ----

function setupLoginForm() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    errEl.classList.add('hidden');
    setLoading(btn, true, 'Entrando...');

    try {
      await Auth.login(email, password);
      // initApp será chamado pelo listener de auth
    } catch (err) {
      errEl.textContent = translateError(err.message);
      errEl.classList.remove('hidden');
      setLoading(btn, false);
    }
  });
}

async function handleLogout() {
  document.getElementById('dropdown-menu').classList.add('hidden');
  await Auth.logout();
  showScreen('login');
  document.getElementById('login-form').reset();
}

function translateError(msg) {
  if (msg.includes('Invalid login')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('Too many requests')) return 'Muitas tentativas. Aguarde um momento.';
  return 'Erro ao entrar. Tente novamente.';
}

// ---- Dashboard ----

async function loadDashboard() {
  const list = document.getElementById('list-pendencias');
  const empty = document.getElementById('empty-pendencias');
  list.querySelectorAll('.pendencia-card').forEach(c => c.remove());

  try {
    const reqs = await Requests.list({
      status: filterState.status !== 'todos' ? filterState.status : null,
      propertyId: filterState.propertyId || null,
      urgency: filterState.urgency || null
    });

    // Stats (sem filtro de status para os totais)
    const allReqs = await Requests.list({});
    document.getElementById('stat-pendente').textContent =
      allReqs.filter(r => r.status === 'pendente').length;
    document.getElementById('stat-critica').textContent =
      allReqs.filter(r => r.urgency === 'critica' && r.status !== 'concluido').length;
    document.getElementById('stat-concluido').textContent =
      allReqs.filter(r => r.status === 'concluido').length;

    if (reqs.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      reqs.forEach(req => {
        const card = Requests.renderCard(req);
        card.addEventListener('click', () => openDetalhe(req.id));
        list.appendChild(card);
      });
    }
  } catch (err) {
    showToast('Erro ao carregar pendências', 'error');
    console.error(err);
  }
}

// ---- Detalhe ----

async function openDetalhe(id) {
  currentRequestId = id;
  navigateTo('detalhe');

  const content = document.getElementById('detalhe-content');
  content.innerHTML = '<div style="text-align:center;padding:40px"><div class="loading-spinner" style="margin:0 auto;border-color:rgba(0,0,0,0.15);border-top-color:var(--primary)"></div></div>';

  try {
    const req = await Requests.getById(id);
    content.innerHTML = Requests.renderDetalhe(req, Auth.isResponsavel());

    // Bind botões de status (apenas responsável)
    if (Auth.isResponsavel()) {
      content.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => updateStatus(id, btn.dataset.action));
      });
    }

    // Bind fotos (lightbox)
    content.querySelectorAll('.foto-thumb').forEach(img => {
      img.addEventListener('click', () => openImageViewer(img.dataset.url));
    });

    // Bind excluir (sócios)
    const btnExcluir = content.querySelector('#btn-excluir-pendencia');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', () => confirmDelete(id));
    }
  } catch (err) {
    content.innerHTML = '<div class="empty-state"><p>Erro ao carregar pendência.</p></div>';
    console.error(err);
  }
}

async function updateStatus(id, status) {
  const notes = document.getElementById('status-notes')?.value || '';
  const btn = document.querySelector(`[data-action="${status}"]`);
  setLoading(btn, true, '...');

  try {
    await Requests.updateStatus(id, status, notes);
    showToast('Status atualizado! ✓', 'success');
    await openDetalhe(id); // Recarrega
  } catch (err) {
    showToast('Erro ao atualizar status', 'error');
    setLoading(btn, false);
    console.error(err);
  }
}

async function confirmDelete(id) {
  if (!confirm('Tem certeza que deseja excluir esta pendência? Esta ação não pode ser desfeita.')) return;
  try {
    await Requests.remove(id);
    showToast('Pendência excluída', 'success');
    goBack();
    loadDashboard();
  } catch (err) {
    showToast('Erro ao excluir', 'error');
    console.error(err);
  }
}

// ---- Nova pendência ----

function setupNovaForm() {
  const form = document.getElementById('form-nova');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-nova');
    const errEl = document.getElementById('nova-error');
    errEl.classList.add('hidden');

    const propertyId = document.getElementById('nova-imovel').value;
    const title = document.getElementById('nova-titulo').value.trim();
    const description = document.getElementById('nova-descricao').value.trim();
    const urgency = document.getElementById('nova-urgencia').value;
    const deadline = document.getElementById('nova-prazo').value;

    if (!propertyId || !title || !urgency) {
      errEl.textContent = 'Preencha os campos obrigatórios (*)';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true, 'Salvando...');

    try {
      const photos = Requests.getPendingPhotos();
      await Requests.create({ propertyId, title, description, urgency, deadline, photos });

      showToast('Pendência criada! Responsável notificado. ✓', 'success');
      Requests.clearPendingPhotos();
      form.reset();
      document.getElementById('photo-preview').innerHTML = '';
      navigateTo('dashboard');
    } catch (err) {
      errEl.textContent = 'Erro ao salvar: ' + err.message;
      errEl.classList.remove('hidden');
      setLoading(btn, false);
      console.error(err);
    }
  });
}

// ---- Imóveis ----

async function loadImoveis() {
  const list = document.getElementById('list-imoveis');
  list.innerHTML = '<div style="text-align:center;padding:32px"><div class="loading-spinner" style="margin:0 auto;border-color:rgba(0,0,0,0.15);border-top-color:var(--primary)"></div></div>';

  try {
    const props = await Properties.list();
    const reqs = await Requests.list({});
    list.innerHTML = '';

    if (props.length === 0) {
      list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg><p>Nenhum imóvel cadastrado</p></div>';
      return;
    }

    props.forEach(p => {
      const pending = reqs.filter(r => r.property_id === p.id && r.status !== 'concluido').length;
      const card = Properties.renderCard(p, pending);
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit-imovel')) {
          openEditImovel(p);
        } else {
          // Filtra por imóvel no dashboard
          filterState.propertyId = p.id;
          document.getElementById('filter-imovel').value = p.id;
          navigateTo('dashboard');
        }
      });
      list.appendChild(card);
    });
  } catch (err) {
    showToast('Erro ao carregar imóveis', 'error');
    console.error(err);
  }
}

function setupImoveisModal() {
  const modal = document.getElementById('modal-imovel');
  const form = document.getElementById('form-imovel');

  document.getElementById('btn-novo-imovel').addEventListener('click', () => {
    document.getElementById('modal-imovel-title').textContent = 'Novo Imóvel';
    document.getElementById('imovel-edit-id').value = '';
    form.reset();
    modal.classList.remove('hidden');
  });

  document.getElementById('close-modal-imovel').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('cancel-modal-imovel').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('imovel-edit-id').value;
    const nome = document.getElementById('imovel-nome').value.trim();
    const unidade = document.getElementById('imovel-unidade').value.trim();
    const endereco = document.getElementById('imovel-endereco').value.trim();

    try {
      if (id) {
        await Properties.update(id, nome, unidade, endereco);
        showToast('Imóvel atualizado ✓', 'success');
      } else {
        await Properties.create(nome, unidade, endereco);
        showToast('Imóvel criado ✓', 'success');
      }
      modal.classList.add('hidden');
      await Properties.list();
      await Properties.populateSelects(['filter-imovel', 'nova-imovel']);
      loadImoveis();
    } catch (err) {
      showToast('Erro ao salvar imóvel', 'error');
      console.error(err);
    }
  });
}

function openEditImovel(property) {
  document.getElementById('modal-imovel-title').textContent = 'Editar Imóvel';
  document.getElementById('imovel-edit-id').value = property.id;
  document.getElementById('imovel-nome').value = property.name;
  document.getElementById('imovel-unidade').value = property.unit || '';
  document.getElementById('imovel-endereco').value = property.address || '';
  document.getElementById('modal-imovel').classList.remove('hidden');
}

// ---- Notificações ----

async function loadNotificacoes() {
  const list = document.getElementById('list-notificacoes');
  list.innerHTML = '';

  try {
    const notifs = await Notifications.list();
    if (notifs.length === 0) {
      list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg><p>Nenhuma notificação</p></div>';
      return;
    }

    notifs.forEach(notif => {
      const item = Notifications.renderItem(notif);
      item.addEventListener('click', async () => {
        if (!notif.read) {
          await Notifications.markRead(notif.id);
          notif.read = true;
          item.classList.add('lida');
          item.querySelector('.notif-dot')?.classList.add('hidden');
          const count = await Notifications.getUnreadCount();
          Notifications.updateBadges(count);
        }
        if (notif.request_id) {
          openDetalhe(notif.request_id);
        }
      });
      list.appendChild(item);
    });

    // Atualiza badge
    const count = await Notifications.getUnreadCount();
    Notifications.updateBadges(count);
  } catch (err) {
    console.error(err);
  }
}

// ---- Usuários ----

async function loadUsuarios() {
  if (!Auth.isAdmin()) return;
  const list = document.getElementById('list-usuarios');
  list.innerHTML = '';

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    if (error) throw error;

    if (!users?.length) {
      list.innerHTML = '<div class="empty-state"><p>Nenhum usuário cadastrado</p></div>';
      return;
    }

    users.forEach(u => {
      const card = document.createElement('div');
      card.className = 'usuario-card';
      const initial = (u.name || u.email || '?').charAt(0).toUpperCase();
      card.innerHTML = `
        <div class="usuario-avatar">${initial}</div>
        <div class="usuario-info">
          <div class="usuario-nome">${escapeHtml(u.name || '—')}</div>
          <div class="usuario-email">${escapeHtml(u.email)}</div>
          <span class="usuario-role role-${u.role}">${u.role === 'responsavel' ? 'Responsável pelas Obras' : 'Sócio'}</span>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    showToast('Erro ao carregar usuários', 'error');
    console.error(err);
  }
}

function setupUsuariosModal() {
  const modal = document.getElementById('modal-usuario');
  const form = document.getElementById('form-usuario');

  document.getElementById('btn-novo-usuario').addEventListener('click', () => {
    form.reset();
    document.getElementById('usuario-error').classList.add('hidden');
    modal.classList.remove('hidden');
  });

  document.getElementById('close-modal-usuario').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('cancel-modal-usuario').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('usuario-error');
    errEl.classList.add('hidden');

    const nome = document.getElementById('usuario-nome').value.trim();
    const email = document.getElementById('usuario-email').value.trim();
    const senha = document.getElementById('usuario-senha').value;
    const perfil = document.getElementById('usuario-perfil').value;

    try {
      await Auth.createUser(email, senha, nome, perfil);
      showToast(`Usuário criado! Um e-mail de confirmação foi enviado para ${email}`, 'success');
      modal.classList.add('hidden');
      loadUsuarios();
    } catch (err) {
      errEl.textContent = translateError(err.message) || err.message;
      errEl.classList.remove('hidden');
      console.error(err);
    }
  });
}

// ---- Image Viewer ----

function openImageViewer(url) {
  const viewer = document.createElement('div');
  viewer.className = 'img-viewer';
  viewer.innerHTML = `
    <img src="${url}" alt="Foto">
    <button class="img-viewer-close">×</button>
  `;
  viewer.querySelector('.img-viewer-close').addEventListener('click', () => viewer.remove());
  viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.remove(); });
  document.body.appendChild(viewer);
}
