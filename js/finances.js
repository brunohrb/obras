// =============================================
// FINANCES MODULE - Bandeira Obras
// Controle financeiro (despesas e receitas)
// =============================================

const Finances = (() => {
  let cache = [];

  const KIND_LABELS = {
    despesa: '💸 Despesa',
    receita: '💰 Receita'
  };

  const CATEGORY_LABELS = {
    material:     '🧱 Material',
    mao_de_obra:  '👷 Mão de obra',
    servico:      '🔧 Serviço',
    equipamento:  '🛠️ Equipamento',
    taxas:        '📄 Taxas / impostos',
    transporte:   '🚚 Transporte',
    projeto:      '📐 Projeto',
    outros:       '📦 Outros'
  };

  const STATUS_LABELS = {
    pendente:  'Pendente',
    pago:      'Pago',
    atrasado:  'Atrasado',
    cancelado: 'Cancelado'
  };

  const STATUS_CLASSES = {
    pendente:  'fin-status-pendente',
    pago:      'fin-status-pago',
    atrasado:  'fin-status-atrasado',
    cancelado: 'fin-status-cancelado'
  };

  // ---- Formatadores ----
  function formatMoney(v) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(d) {
    if (!d) return '—';
    const [y, m, day] = String(d).slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }

  // Ajusta status 'pendente' para 'atrasado' quando due_date < hoje
  function normalizeStatus(item) {
    if (!item) return item;
    if (item.status === 'pendente' && item.due_date) {
      const today = new Date().toISOString().slice(0, 10);
      if (item.due_date < today) {
        return { ...item, status: 'atrasado' };
      }
    }
    return item;
  }

  // ---- CRUD ----

  async function list(filters = {}) {
    let q = supabase.from('finances').select('*').order('created_at', { ascending: false });
    if (filters.projectId)  q = q.eq('project_id',  filters.projectId);
    if (filters.propertyId) q = q.eq('property_id', filters.propertyId);
    if (filters.status)     q = q.eq('status',      filters.status);
    if (filters.kind)       q = q.eq('kind',        filters.kind);

    const { data, error } = await q;
    if (error) throw error;
    cache = (data || []).map(normalizeStatus);
    return cache;
  }

  async function getById(id) {
    const { data, error } = await supabase.from('finances').select('*').eq('id', id).single();
    if (error) throw error;
    return normalizeStatus(data);
  }

  async function create(fields) {
    const payload = {
      property_id: fields.propertyId || null,
      project_id:  fields.projectId  || null,
      request_id:  fields.requestId  || null,
      kind:        fields.kind       || 'despesa',
      category:    fields.category   || 'outros',
      description: fields.description,
      amount:      Number(fields.amount || 0),
      due_date:    fields.dueDate    || null,
      paid_date:   fields.paidDate   || null,
      status:      fields.status     || 'pendente',
      supplier:    fields.supplier   || null,
      invoice_url: fields.invoiceUrl || null,
      notes:       fields.notes      || null,
      created_by:  Auth.getUser()?.id
    };
    const { data, error } = await supabase.from('finances').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function update(id, fields) {
    const patch = {};
    if ('propertyId'  in fields) patch.property_id = fields.propertyId  || null;
    if ('projectId'   in fields) patch.project_id  = fields.projectId   || null;
    if ('requestId'   in fields) patch.request_id  = fields.requestId   || null;
    if ('kind'        in fields) patch.kind        = fields.kind;
    if ('category'    in fields) patch.category    = fields.category;
    if ('description' in fields) patch.description = fields.description;
    if ('amount'      in fields) patch.amount      = Number(fields.amount || 0);
    if ('dueDate'     in fields) patch.due_date    = fields.dueDate     || null;
    if ('paidDate'    in fields) patch.paid_date   = fields.paidDate    || null;
    if ('status'      in fields) patch.status      = fields.status;
    if ('supplier'    in fields) patch.supplier    = fields.supplier    || null;
    if ('invoiceUrl'  in fields) patch.invoice_url = fields.invoiceUrl  || null;
    if ('notes'       in fields) patch.notes       = fields.notes       || null;

    const { data, error } = await supabase.from('finances').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function markPaid(id, paidDate) {
    const { data, error } = await supabase
      .from('finances')
      .update({ status: 'pago', paid_date: paidDate || new Date().toISOString().slice(0, 10) })
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return data;
  }

  async function remove(id) {
    const { error } = await supabase.from('finances').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Agregações ----

  // Retorna totais gerais: despesa total, pago, em aberto, atrasado, receita
  function summarize(items) {
    const list = (items || cache).map(normalizeStatus);
    const sum = (pred) => list.filter(pred).reduce((s, x) => s + Number(x.amount || 0), 0);
    return {
      totalDespesa:  sum(f => f.kind === 'despesa' && f.status !== 'cancelado'),
      totalPago:     sum(f => f.kind === 'despesa' && f.status === 'pago'),
      totalPendente: sum(f => f.kind === 'despesa' && f.status === 'pendente'),
      totalAtrasado: sum(f => f.kind === 'despesa' && f.status === 'atrasado'),
      totalReceita:  sum(f => f.kind === 'receita' && f.status === 'pago'),
      count: list.length
    };
  }

  // Agrupa por categoria (despesas)
  function groupByCategory(items) {
    const list = (items || cache).filter(f => f.kind === 'despesa' && f.status !== 'cancelado');
    const map = {};
    list.forEach(f => {
      map[f.category] = (map[f.category] || 0) + Number(f.amount || 0);
    });
    return Object.entries(map)
      .map(([cat, total]) => ({ category: cat, label: CATEGORY_LABELS[cat] || cat, total }))
      .sort((a, b) => b.total - a.total);
  }

  // Agrupa por obra (despesas)
  function groupByProject(items, projects) {
    const list = (items || cache).filter(f => f.kind === 'despesa' && f.status !== 'cancelado' && f.project_id);
    const map = {};
    list.forEach(f => {
      map[f.project_id] = (map[f.project_id] || 0) + Number(f.amount || 0);
    });
    const projMap = {};
    (projects || []).forEach(p => { projMap[p.id] = p; });
    return Object.entries(map)
      .map(([pid, total]) => ({
        projectId: pid,
        name:      projMap[pid]?.name || 'Obra removida',
        budget:    Number(projMap[pid]?.budget || 0),
        total
      }))
      .sort((a, b) => b.total - a.total);
  }

  // Exporta CSV de lançamentos (faz download no browser)
  function exportCsv(items, filename = 'financeiro.csv') {
    const list = items || cache;
    const header = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Fornecedor', 'Valor', 'Vencimento', 'Pago em', 'Status'];
    const rows = list.map(f => [
      f.created_at ? f.created_at.slice(0, 10) : '',
      f.kind,
      CATEGORY_LABELS[f.category] || f.category,
      (f.description || '').replace(/"/g, '""'),
      (f.supplier || '').replace(/"/g, '""'),
      Number(f.amount || 0).toFixed(2).replace('.', ','),
      f.due_date || '',
      f.paid_date || '',
      STATUS_LABELS[f.status] || f.status
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${c}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Render ----

  function renderCard(item, context = {}) {
    const f = normalizeStatus(item);
    const div = document.createElement('div');
    div.className = 'fin-card ' + STATUS_CLASSES[f.status];
    div.dataset.id = f.id;

    const sign = f.kind === 'receita' ? '+' : '−';
    const valueClass = f.kind === 'receita' ? 'fin-value-receita' : 'fin-value-despesa';

    const scopeName = context.scopeName
      ? `<span class="fin-scope">${escapeHtml(context.scopeName)}</span>`
      : '';

    const due = f.due_date ? `<span class="fin-due">🗓️ Vence ${formatDate(f.due_date)}</span>` : '';
    const paid = f.paid_date ? `<span class="fin-paid">✅ Pago em ${formatDate(f.paid_date)}</span>` : '';

    div.innerHTML = `
      <div class="fin-card-main">
        <div class="fin-card-left">
          <div class="fin-category">${CATEGORY_LABELS[f.category] || f.category}</div>
          <div class="fin-desc">${escapeHtml(f.description)}</div>
          <div class="fin-meta">
            ${f.supplier ? `<span>🏷️ ${escapeHtml(f.supplier)}</span>` : ''}
            ${scopeName}
            ${due}
            ${paid}
          </div>
        </div>
        <div class="fin-card-right">
          <div class="fin-amount ${valueClass}">${sign} ${formatMoney(f.amount)}</div>
          <span class="fin-status-badge ${STATUS_CLASSES[f.status]}">${STATUS_LABELS[f.status]}</span>
        </div>
      </div>
    `;
    return div;
  }

  // Popula select de status para filtros
  function renderSummaryCards(summary) {
    return `
      <div class="fin-summary">
        <div class="fin-summary-card">
          <span class="fin-summary-label">Total despesas</span>
          <span class="fin-summary-value fin-value-despesa">${formatMoney(summary.totalDespesa)}</span>
        </div>
        <div class="fin-summary-card">
          <span class="fin-summary-label">Pago</span>
          <span class="fin-summary-value fin-ok">${formatMoney(summary.totalPago)}</span>
        </div>
        <div class="fin-summary-card">
          <span class="fin-summary-label">Em aberto</span>
          <span class="fin-summary-value fin-warn">${formatMoney(summary.totalPendente)}</span>
        </div>
        <div class="fin-summary-card">
          <span class="fin-summary-label">Atrasado</span>
          <span class="fin-summary-value fin-danger">${formatMoney(summary.totalAtrasado)}</span>
        </div>
      </div>
    `;
  }

  function renderBudgetBar(spent, budget) {
    const b = Number(budget || 0);
    const s = Number(spent  || 0);
    if (b <= 0) {
      return `<div class="fin-budget-bar empty">Sem orçamento definido — gasto: <strong>${formatMoney(s)}</strong></div>`;
    }
    const pct = Math.min(100, (s / b) * 100);
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return `
      <div class="fin-budget-bar">
        <div class="fin-budget-top">
          <span>${formatMoney(s)} de ${formatMoney(b)}</span>
          <strong>${pct.toFixed(0)}%</strong>
        </div>
        <div class="fin-budget-track">
          <div class="fin-budget-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }

  function getCache() { return cache; }

  return {
    list, getById, create, update, markPaid, remove,
    summarize, groupByCategory, groupByProject,
    exportCsv,
    renderCard, renderSummaryCards, renderBudgetBar,
    formatMoney, formatDate, normalizeStatus,
    KIND_LABELS, CATEGORY_LABELS, STATUS_LABELS, STATUS_CLASSES,
    getCache
  };
})();
