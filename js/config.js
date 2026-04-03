// =============================================
// CONFIGURAÇÃO SUPABASE - Bandeira Obras
// =============================================
// ⚠️  PREENCHA COM SUAS CREDENCIAIS SUPABASE
// Acesse: https://supabase.com → Seu projeto → Settings → API
// =============================================

const SUPABASE_URL = 'https://daozgmiytfrwomxznjln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb3pnbWl5dGZyd29teHpuamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDY4NzMsImV4cCI6MjA5MDU4Mjg3M30.evEDpNDP5nFaxCDPqyhyWg2uxM9TvjsVKP0ujNqfQWs';

// Bucket de storage para fotos
const STORAGE_BUCKET = 'obras-fotos';

// Versão do app
const APP_VERSION = '1.0.0';

// =============================================
// MODO DEMO — para testar sem Supabase
// Login: demo@bandeira.com / 123456
// Para desativar: mude DEMO_MODE para false
// =============================================
const DEMO_MODE = false;

// Dados fictícios do modo demo
const DEMO_DATA = {
  user: { id: 'demo-user-1', email: 'demo@bandeira.com' },
  profile: { id: 'demo-user-1', name: 'Bruno (Demo)', role: 'socio', email: 'demo@bandeira.com' },
  properties: [
    { id: 'prop-1', name: 'Cond. Pedra Branca', unit: 'Apto 101', address: 'Rua das Flores, 100' },
    { id: 'prop-2', name: 'Cond. Pedra Branca', unit: 'Apto 202', address: 'Rua das Flores, 100' },
    { id: 'prop-3', name: 'Edifício Central', unit: 'Sala 05', address: 'Av. Principal, 500' },
    { id: 'prop-4', name: 'Casa Praia', unit: null, address: 'Rua do Mar, 22' }
  ],
  requests: [
    { id: 'req-1', property_id: 'prop-1', title: 'Trocar pia da cozinha', description: 'A pia está com vazamento embaixo. Precisa trocar a cuba e o sifão.', urgency: 'alta', deadline: '2025-04-15', status: 'pendente', photos: [], notes: null, created_at: new Date(Date.now() - 2*86400000).toISOString(), updated_at: null, created_by: 'demo-user-1', properties: { id: 'prop-1', name: 'Cond. Pedra Branca', unit: 'Apto 101' }, creator: { id: 'demo-user-1', name: 'Bruno (Demo)', role: 'socio' } },
    { id: 'req-2', property_id: 'prop-1', title: 'Pintura da sala', description: 'Pintura descascando na parede da sala, próximo à janela.', urgency: 'baixa', deadline: '2025-05-30', status: 'pendente', photos: [], notes: null, created_at: new Date(Date.now() - 5*86400000).toISOString(), updated_at: null, created_by: 'demo-user-1', properties: { id: 'prop-1', name: 'Cond. Pedra Branca', unit: 'Apto 101' }, creator: { id: 'demo-user-1', name: 'Bruno (Demo)', role: 'socio' } },
    { id: 'req-3', property_id: 'prop-2', title: 'Ar condicionado não resfria', description: 'O ar do quarto está soprando quente. Precisa de manutenção.', urgency: 'critica', deadline: '2025-04-05', status: 'em_andamento', photos: [], notes: 'Técnico agendado para quinta-feira.', created_at: new Date(Date.now() - 1*86400000).toISOString(), updated_at: new Date().toISOString(), created_by: 'demo-user-1', properties: { id: 'prop-2', name: 'Cond. Pedra Branca', unit: 'Apto 202' }, creator: { id: 'demo-user-1', name: 'Bruno (Demo)', role: 'socio' } },
    { id: 'req-4', property_id: 'prop-3', title: 'Tomada queimada no banheiro', description: null, urgency: 'media', deadline: null, status: 'concluido', photos: [], notes: 'Substituída por eletricista.', created_at: new Date(Date.now() - 10*86400000).toISOString(), updated_at: new Date(Date.now() - 2*86400000).toISOString(), created_by: 'demo-user-1', properties: { id: 'prop-3', name: 'Edifício Central', unit: 'Sala 05' }, creator: { id: 'demo-user-1', name: 'Bruno (Demo)', role: 'socio' } },
    { id: 'req-5', property_id: 'prop-4', title: 'Portão da garagem com defeito', description: 'O portão eletrônico está travando na abertura.', urgency: 'alta', deadline: '2025-04-10', status: 'pendente', photos: [], notes: null, created_at: new Date(Date.now() - 3*86400000).toISOString(), updated_at: null, created_by: 'demo-user-1', properties: { id: 'prop-4', name: 'Casa Praia', unit: null }, creator: { id: 'demo-user-1', name: 'Bruno (Demo)', role: 'socio' } }
  ],
  notifications: [
    { id: 'notif-1', user_id: 'demo-user-1', request_id: 'req-3', type: 'atualizado', message: '🔨 Pendência em andamento em Apto 202 · Cond. Pedra Branca: "Ar condicionado não resfria"', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'notif-2', user_id: 'demo-user-1', request_id: 'req-4', type: 'concluido', message: '✅ Pendência concluída em Sala 05 · Edifício Central: "Tomada queimada no banheiro"', read: true, created_at: new Date(Date.now() - 2*86400000).toISOString() }
  ]
};

// Mock do cliente Supabase para modo demo
let _demoRequestsStore = [...DEMO_DATA.requests];

const supabase = DEMO_MODE ? {
  auth: {
    signInWithPassword: async ({ email, password }) => {
      if (email === 'demo@bandeira.com' && password === '123456') {
        return { data: { user: DEMO_DATA.user, session: { user: DEMO_DATA.user } }, error: null };
      }
      return { data: null, error: { message: 'Invalid login credentials' } };
    },
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: { user: DEMO_DATA.user } } }),
    onAuthStateChange: (cb) => { return { data: { subscription: { unsubscribe: () => {} } } }; },
    signUp: async () => ({ data: { user: { id: 'new-user' } }, error: null })
  },
  from: (table) => new DemoQueryBuilder(table),
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: (path) => ({ data: { publicUrl: 'https://via.placeholder.com/400x300?text=Foto+Demo' } }),
      remove: async () => ({})
    })
  },
  channel: (name) => ({
    on: function() { return this; },
    subscribe: function() { return this; }
  }),
  removeChannel: () => {}
} : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
});

// Query builder demo
class DemoQueryBuilder {
  constructor(table) {
    this._table = table;
    this._filters = {};
    this._order = null;
    this._limit = null;
    this._single = false;
    this._select = '*';
    this._countOnly = false;
  }
  select(cols, opts) {
    this._select = cols;
    if (opts?.count) this._countOnly = true;
    return this;
  }
  insert(data) { this._insert = data; return this; }
  update(data) { this._update = data; return this; }
  delete() { this._delete = true; return this; }
  upsert(data) { this._insert = data; return this; }
  eq(col, val) { this._filters[col] = val; return this; }
  order(col, opts) { this._order = { col, ...opts }; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = true; return this; }

  async then(resolve) {
    const result = await this._execute();
    resolve(result);
  }

  async _execute() {
    const t = this._table;

    // INSERT
    if (this._insert) {
      if (t === 'profiles') return { data: this._insert, error: null };
      if (t === 'notifications') {
        const items = Array.isArray(this._insert) ? this._insert : [this._insert];
        items.forEach(n => { n.id = 'notif-' + Date.now(); n.read = false; n.created_at = new Date().toISOString(); DEMO_DATA.notifications.unshift(n); });
        return { data: items, error: null };
      }
      if (t === 'maintenance_requests') {
        const d = { ...this._insert, id: 'req-' + Date.now(), created_at: new Date().toISOString(), updated_at: null, photos: this._insert.photos || [] };
        const prop = DEMO_DATA.properties.find(p => p.id === d.property_id);
        d.properties = prop || null;
        d.creator = DEMO_DATA.profile;
        _demoRequestsStore.unshift(d);
        return { data: d, error: null };
      }
      if (t === 'properties') {
        const d = { ...this._insert, id: 'prop-' + Date.now(), created_at: new Date().toISOString() };
        DEMO_DATA.properties.push(d);
        return { data: d, error: null };
      }
      return { data: this._insert, error: null };
    }

    // UPDATE
    if (this._update) {
      if (t === 'maintenance_requests') {
        const idx = _demoRequestsStore.findIndex(r => r.id === this._filters.id);
        if (idx >= 0) {
          _demoRequestsStore[idx] = { ..._demoRequestsStore[idx], ...this._update };
          const r = _demoRequestsStore[idx];
          const prop = DEMO_DATA.properties.find(p => p.id === r.property_id);
          r.properties = prop || r.properties;
          r.creator = DEMO_DATA.profile;
          return { data: r, error: null };
        }
      }
      if (t === 'notifications') {
        DEMO_DATA.notifications.forEach(n => {
          if (!this._filters.id || n.id === this._filters.id) n.read = true;
        });
        return { data: null, error: null };
      }
      if (t === 'profiles') {
        return { data: DEMO_DATA.profile, error: null };
      }
      return { data: this._update, error: null };
    }

    // DELETE
    if (this._delete) {
      if (t === 'maintenance_requests') {
        _demoRequestsStore = _demoRequestsStore.filter(r => r.id !== this._filters.id);
      }
      return { data: null, error: null };
    }

    // SELECT
    let data = [];
    if (t === 'profiles') {
      data = [DEMO_DATA.profile, { id: 'resp-1', name: 'João (Responsável)', email: 'joao@bandeira.com', role: 'responsavel' }];
    } else if (t === 'properties') {
      data = [...DEMO_DATA.properties];
    } else if (t === 'maintenance_requests') {
      data = [..._demoRequestsStore];
      if (this._filters.status) data = data.filter(r => r.status === this._filters.status);
      if (this._filters.property_id) data = data.filter(r => r.property_id === this._filters.property_id);
      if (this._filters.urgency) data = data.filter(r => r.urgency === this._filters.urgency);
      if (this._filters.id) data = data.filter(r => r.id === this._filters.id);
    } else if (t === 'notifications') {
      data = DEMO_DATA.notifications.filter(n => n.user_id === 'demo-user-1');
    }

    if (this._order) {
      data.sort((a, b) => {
        const av = a[this._order.col], bv = b[this._order.col];
        return this._order.ascending ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    if (this._limit) data = data.slice(0, this._limit);

    if (this._countOnly) return { count: data.length, error: null };
    if (this._single) {
      const item = data[0] || null;
      return item ? { data: item, error: null } : { data: null, error: { message: 'Not found' } };
    }
    return { data, error: null };
  }
}
