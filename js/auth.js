// =============================================
// AUTH MODULE - Bandeira Obras
// =============================================

const Auth = (() => {
  let currentUser = null;
  let currentProfile = null;

  // Converte nome de usuário simples para email interno
  function toEmail(username) {
    if (username.includes('@')) return username; // já é email
    return `${username.toLowerCase().trim()}@bandeira.app`;
  }

  // Login com usuário simples ou email
  async function login(username, password) {
    const email = toEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // Logout
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentUser = null;
    currentProfile = null;
  }

  // Busca sessão atual
  async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      await loadProfile(session.user.id);
    }
    return session;
  }

  // Carrega perfil do usuário
  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      currentProfile = data;
    }
    return currentProfile;
  }

  // Cria novo usuário (apenas admin/sócio)
  async function createUser(username, password, name, role) {
    const email = toEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role }
      }
    });
    if (error) throw error;

    // Cria perfil manualmente
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        role
      });
      if (profileError) throw profileError;
    }
    return data;
  }

  // Getters
  function getUser() { return currentUser; }
  function getProfile() { return currentProfile; }
  function isLoggedIn() { return !!currentUser; }
  function isResponsavel() { return currentProfile?.role === 'responsavel'; }
  function isSocio() { return currentProfile?.role === 'socio'; }
  function isAdmin() { return currentProfile?.role === 'socio'; } // sócios podem gerenciar

  // Listener de mudança de estado
  function onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        currentUser = session.user;
        await loadProfile(session.user.id);
      } else {
        currentUser = null;
        currentProfile = null;
      }
      callback(event, session);
    });
  }

  return {
    login,
    logout,
    getSession,
    loadProfile,
    createUser,
    getUser,
    getProfile,
    isLoggedIn,
    isResponsavel,
    isSocio,
    isAdmin,
    onAuthChange
  };
})();
