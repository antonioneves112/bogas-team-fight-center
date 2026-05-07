/* JS/state.js - GESTÃO DE ESTADO CENTRALIZADA E BLINDADA (Store) */

export const state = {
  // 🥊 VARIÁVEIS PRIVADAS (O "_" indica que são dados intocáveis)
  _treinadorAtual: null,
  _todosOsGuerreiros: [],
  _guerreirosAtuais: [],
  _inativosAtuais: [],
  _mensalidadesAtuais: [],
  _aulasParticulares: [],
  _idsPagosGlobal: [],
  _idSocioEmEdicao: null,
  _idMensalidadeEmEdicao: null,

  // ==========================================
  // 🥊 GETTERS E SETTERS (Os Guardas do Cofre)
  // ==========================================

  // --- TREINADOR ---
  get treinadorAtual() {
    return this._treinadorAtual;
  },
  set treinadorAtual(val) {
    this._treinadorAtual = val;
  },

  // --- SÓCIOS E INATIVOS (Com Imutabilidade) ---
  get todosOsGuerreiros() {
    return this._todosOsGuerreiros;
  },
  set todosOsGuerreiros(val) {
    // O [...val] cria um clone. Ninguém altera o array original por acidente!
    this._todosOsGuerreiros = Array.isArray(val) ? [...val] : [];
  },

  get guerreirosAtuais() {
    return this._guerreirosAtuais;
  },
  set guerreirosAtuais(val) {
    this._guerreirosAtuais = Array.isArray(val) ? [...val] : [];
  },

  get inativosAtuais() {
    return this._inativosAtuais;
  },
  set inativosAtuais(val) {
    this._inativosAtuais = Array.isArray(val) ? [...val] : [];
  },

  // --- MENSALIDADES E DESPESAS ---
  get mensalidadesAtuais() {
    return this._mensalidadesAtuais;
  },
  set mensalidadesAtuais(val) {
    this._mensalidadesAtuais = Array.isArray(val) ? [...val] : [];
  },

  get idsPagosGlobal() {
    return this._idsPagosGlobal;
  },
  set idsPagosGlobal(val) {
    this._idsPagosGlobal = Array.isArray(val) ? [...val] : [];
  },

  // --- AULAS PARTICULARES ---
  get aulasParticulares() {
    return this._aulasParticulares;
  },
  set aulasParticulares(val) {
    this._aulasParticulares = Array.isArray(val) ? [...val] : [];
  },

  // --- CONTROLO DE EDIÇÃO (IDs Temporários) ---
  get idSocioEmEdicao() {
    return this._idSocioEmEdicao;
  },
  set idSocioEmEdicao(val) {
    this._idSocioEmEdicao = val;
  },

  get idMensalidadeEmEdicao() {
    return this._idMensalidadeEmEdicao;
  },
  set idMensalidadeEmEdicao(val) {
    this._idMensalidadeEmEdicao = val;
  },
};
