// public/js/state.js
window.MegaApp = window.MegaApp || {};

window.MegaApp.State = {
  localCatalogVersion: 1,
  currentWarningServiceId: null,
  currentRechargeData: null,
  apiaccesskey: '',
  currentCategory: null,
  g_rawServicesList: [],
  g_categorizedGroups: {},
  g_currentHistory: [],
  customTicketSettings: { nombre: '', whatsapp: '', facebook: '', logoExt: '' },
  currentTicketData: null,
  productsList: [],
  uniqueGroups: new Set(),
  globalApiCurrency: 'MXN',
  globalApiCreditRaw: 0,
  selectedProductForOrder: null,
  orderHistory: [],
  consoleLogList: [],
  
  // Auth
  authToken: null,
  authRole: null,
  authUsername: null,
  currentServerId: '3',

  init: function() {
    this.authToken = localStorage.getItem('mega_auth_token');
    this.authRole = localStorage.getItem('mega_auth_role');
    this.authUsername = localStorage.getItem('mega_auth_username');
    this.currentServerId = localStorage.getItem('mega_current_server_id') || '3';
    this.apiaccesskey = localStorage.getItem('mega_api_key') || '';
  },

  saveAuth: function(token, role, username) {
    this.authToken = token;
    this.authRole = role;
    this.authUsername = username;
    if (token) {
      localStorage.setItem('mega_auth_token', token);
      localStorage.setItem('mega_auth_role', role);
      localStorage.setItem('mega_auth_username', username);
    } else {
      localStorage.removeItem('mega_auth_token');
      localStorage.removeItem('mega_auth_role');
      localStorage.removeItem('mega_auth_username');
    }
  },

  setServerId: function(id) {
    this.currentServerId = id;
    localStorage.setItem('mega_current_server_id', id);
  }
};

window.MegaApp.State.init();
