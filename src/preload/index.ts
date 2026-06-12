import { contextBridge, ipcRenderer, webUtils } from 'electron';

type IpcArgs = Record<string, unknown>;

const api = {
  invoke: (channel: string, args?: IpcArgs) => ipcRenderer.invoke(channel, args ?? {}),
};

// Auth
const auth = {
  login: (identifier: string, password: string) => api.invoke('auth:login', { identifier, password }),
  logout: (token: string) => api.invoke('auth:logout', { token }),
  me: (token: string) => api.invoke('auth:me', { token }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    api.invoke('auth:changePassword', { token, currentPassword, newPassword }),
  updateProfile: (token: string, payload: object) =>
    api.invoke('auth:updateProfile', { token, payload }),
  updateTheme: (token: string, theme: string) =>
    api.invoke('auth:updateTheme', { token, theme }),
};

// Users
const users = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('users:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('users:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('users:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('users:update', { token, id, payload }),
  resetPassword: (token: string, id: number, newPassword: string) =>
    api.invoke('users:resetPassword', { token, id, newPassword }),
  toggleActive: (token: string, id: number) => api.invoke('users:toggleActive', { token, id }),
  delete: (token: string, id: number) => api.invoke('users:delete', { token, id }),
};

// Prospects
const prospects = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('prospects:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('prospects:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('prospects:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('prospects:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('prospects:delete', { token, id }),
  updateStatus: (token: string, id: number, status: string) =>
    api.invoke('prospects:updateStatus', { token, id, status }),
  convertToClient: (token: string, id: number, clientData?: object) =>
    api.invoke('prospects:convertToClient', { token, id, clientData }),
  kanban: (token: string) => api.invoke('prospects:kanban', { token }),
  assign: (token: string, id: number, assignedToId: number | null) =>
    api.invoke('prospects:assign', { token, id, assignedToId }),
  listAssignableUsers: (token: string) =>
    api.invoke('prospects:listAssignableUsers', { token }),
};

// Clients
const clients = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('clients:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('clients:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('clients:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('clients:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('clients:delete', { token, id }),
  toggleActive: (token: string, id: number) => api.invoke('clients:toggleActive', { token, id }),
  updateStatus: (token: string, id: number, status: string) =>
    api.invoke('clients:updateStatus', { token, id, status }),
  assign: (token: string, id: number, assignedToId: number | null) =>
    api.invoke('clients:assign', { token, id, assignedToId }),
  setReferrer: (token: string, id: number, referrerId: number | null) =>
    api.invoke('clients:setReferrer', { token, id, referrerId }),
  listAssignableUsers: (token: string) => api.invoke('clients:listAssignableUsers', { token }),
  listReferrers: (token: string) => api.invoke('clients:listReferrers', { token }),
};

// Owners
const owners = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('owners:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('owners:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('owners:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('owners:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('owners:delete', { token, id }),
  portfolio: (token: string, id: number) => api.invoke('owners:portfolio', { token, id }),
};

// Properties
const properties = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('properties:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('properties:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('properties:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('properties:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('properties:delete', { token, id }),
  updateStatus: (token: string, id: number, status: string) =>
    api.invoke('properties:updateStatus', { token, id, status }),
  statusStats: (token: string, filters?: object) =>
    api.invoke('properties:statusStats', { token, filters }),
};

// Conventions
const conventions = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('conventions:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('conventions:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('conventions:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('conventions:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('conventions:delete', { token, id }),
  generateInstallments: (token: string, id: number) =>
    api.invoke('conventions:generateInstallments', { token, id }),
  getInstallments: (token: string, conventionId: number) =>
    api.invoke('conventions:getInstallments', { token, conventionId }),
  updateInstallments: (token: string, conventionId: number, installments: { id: number; dueDate: string; amount: number }[]) =>
    api.invoke('conventions:updateInstallments', { token, conventionId, installments }),
  statusStats: (token: string, filters?: object) =>
    api.invoke('conventions:statusStats', { token, filters }),
};

// Modèles de convention
const conventionTemplates = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('conventionTemplates:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('conventionTemplates:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('conventionTemplates:create', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('conventionTemplates:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('conventionTemplates:delete', { token, id }),
};

// Modèles d'attestation
const attestationTemplates = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('attestationTemplates:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('attestationTemplates:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('attestationTemplates:create', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('attestationTemplates:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('attestationTemplates:delete', { token, id }),
};

// Attestations émises
const attestations = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('attestations:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('attestations:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('attestations:create', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('attestations:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('attestations:delete', { token, id }),
  typeStats: (token: string, filters?: object) =>
    api.invoke('attestations:typeStats', { token, filters }),
  getLegacyBalance: (token: string, clientId: number, terrainId: number) =>
    api.invoke('attestations:getLegacyBalance', { token, clientId, terrainId }),
};

// Devis
const quotes = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('quotes:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('quotes:getById', { token, id }),
  stats: (token: string) => api.invoke('quotes:stats', { token }),
  create: (token: string, payload: object) => api.invoke('quotes:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('quotes:update', { token, id, payload }),
  send: (token: string, id: number) => api.invoke('quotes:send', { token, id }),
  accept: (token: string, id: number) => api.invoke('quotes:accept', { token, id }),
  refuse: (token: string, id: number, reason?: string) => api.invoke('quotes:refuse', { token, id, reason }),
  cancel: (token: string, id: number) => api.invoke('quotes:cancel', { token, id }),
  delete: (token: string, id: number) => api.invoke('quotes:delete', { token, id }),
  convert: (token: string, id: number, options: object) => api.invoke('quotes:convert', { token, id, options }),
};

const quoteTemplates = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('quoteTemplates:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('quoteTemplates:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('quoteTemplates:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('quoteTemplates:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('quoteTemplates:delete', { token, id }),
};

// Catalogue prestations / produits
const catalog = {
  list: (token: string, filters?: object) => api.invoke('catalog:list', { token, filters }),
  getById: (token: string, id: number) => api.invoke('catalog:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('catalog:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('catalog:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('catalog:delete', { token, id }),
};

// Accounting
const accounting = {
  getDashboard: (token: string) => api.invoke('accounting:getDashboard', { token }),
  getRevenue: (token: string, period: string) => api.invoke('accounting:getRevenue', { token, period }),
  getInvoices: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('accounting:getInvoices', { token, filters, page, limit }),
  getInvoiceTypeStats: (token: string, filters?: object) =>
    api.invoke('accounting:getInvoiceTypeStats', { token, filters }),
  getInvoiceById: (token: string, id: number) => api.invoke('accounting:getInvoiceById', { token, id }),
  createInvoice: (token: string, payload: object) => api.invoke('accounting:createInvoice', { token, payload }),
  updateInvoiceStatus: (token: string, id: number, status: string) =>
    api.invoke('accounting:updateInvoiceStatus', { token, id, status }),
  reinstateInvoice: (token: string, id: number) =>
    api.invoke('accounting:reinstateInvoice', { token, id }),
  addPayment: (token: string, invoiceId: number, payload: object) =>
    api.invoke('accounting:addPayment', { token, invoiceId, payload }),
  getOverdueInstallments: (token: string) => api.invoke('accounting:getOverdueInstallments', { token }),
  getUnpaidInstallments: (token: string) => api.invoke('accounting:getUnpaidInstallments', { token }),
  getUpcomingInstallments: (token: string, days?: number) =>
    api.invoke('accounting:getUpcomingInstallments', { token, days }),
  getPaidInstallments: (token: string, year?: number, semester?: number) =>
    api.invoke('accounting:getPaidInstallments', { token, year, semester }),
  getCancelledInstallments: (token: string) =>
    api.invoke('accounting:getCancelledInstallments', { token }),
  getLegacyInstallments: (token: string) =>
    api.invoke('accounting:getLegacyInstallments', { token }),
  updateLegacyInstallment: (token: string, payload: object) =>
    api.invoke('accounting:updateLegacyInstallment', { token, payload }),
  listInstallments: (token: string) => api.invoke('accounting:listInstallments', { token }),
  payInstallment: (token: string, installmentId: number, payload: object) =>
    api.invoke('accounting:payInstallment', { token, installmentId, payload }),
  printInvoice: (token: string, invoiceId: number) =>
    api.invoke('accounting:printInvoice', { token, invoiceId }),
  cancelInstallment: (token: string, installmentId: number) =>
    api.invoke('accounting:cancelInstallment', { token, installmentId }),
  reinstateInstallment: (token: string, installmentId: number) =>
    api.invoke('accounting:reinstateInstallment', { token, installmentId }),
  getSaleConventions: (token: string) => api.invoke('accounting:getSaleConventions', { token }),
};

// Bilan comptable (compte de résultat + actif/passif)
const bilan = {
  getResultat: (token: string, payload: {
    periodType: 'month' | 'last-month' | 'quarter' | 'semester' | 'year' | 'custom';
    periodStart?: string;
    periodEnd?: string;
    scope: 'global' | 'lotissement' | 'programme' | 'owner';
    scopeId?: number;
  }) => api.invoke('bilan:getResultat', { token, ...payload }),
  getActifPassif: (token: string, payload: {
    asOfDate?: string;
    scope: 'global' | 'lotissement' | 'programme' | 'owner';
    scopeId?: number;
  }) => api.invoke('bilan:getActifPassif', { token, ...payload }),
  export: (token: string, payload: {
    type: 'resultat' | 'actif-passif';
    format: 'pdf' | 'xlsx';
    data: unknown;
    meta: { title: string; subtitle?: string; scope?: string };
  }) => api.invoke('bilan:export', { token, ...payload }),
};

// Communication
const communication = {
  listTemplates: (token: string, channel?: string) =>
    api.invoke('communication:listTemplates', { token, channel }),
  getTemplate: (token: string, id: number) =>
    api.invoke('communication:getTemplate', { token, id }),
  createTemplate: (token: string, payload: object) =>
    api.invoke('communication:createTemplate', { token, payload }),
  updateTemplate: (token: string, id: number, payload: object) =>
    api.invoke('communication:updateTemplate', { token, id, payload }),
  deleteTemplate: (token: string, id: number) =>
    api.invoke('communication:deleteTemplate', { token, id }),
  getHistory: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('communication:getHistory', { token, filters, page, limit }),
  sendEmail: (token: string, payload: object) =>
    api.invoke('communication:sendEmail', { token, payload }),
  sendSms: (token: string, payload: object) =>
    api.invoke('communication:sendSms', { token, payload }),
  sendWhatsapp: (token: string, payload: object) =>
    api.invoke('communication:sendWhatsapp', { token, payload }),
  resend: (token: string, id: number) =>
    api.invoke('communication:resend', { token, id }),
  resolveTarget: (token: string, payload: object) =>
    api.invoke('communication:resolveTarget', { token, payload }),
  shareLocation: (token: string, payload: object) =>
    api.invoke('communication:shareLocation', { token, payload }),
  previewShareLocation: (token: string, payload: object) =>
    api.invoke('communication:previewShareLocation', { token, payload }),
};

// Reminders (politique de relance automatique)
const reminders = {
  getPolicy: (token: string) =>
    api.invoke('reminders:getPolicy', { token }),
  updatePolicy: (token: string, payload: object) =>
    api.invoke('reminders:updatePolicy', { token, payload }),
  listRules: (token: string) =>
    api.invoke('reminders:listRules', { token }),
  updateRule: (token: string, id: number, payload: object) =>
    api.invoke('reminders:updateRule', { token, id, payload }),
  runNow: (token: string) =>
    api.invoke('reminders:runNow', { token }),
  setClientOptOut: (token: string, payload: object) =>
    api.invoke('reminders:setClientOptOut', { token, payload }),
};

// CRM
const crm = {
  listActivities: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('crm:listActivities', { token, filters, page, limit }),
  getActivity: (token: string, id: number) =>
    api.invoke('crm:getActivity', { token, id }),
  createActivity: (token: string, payload: object) =>
    api.invoke('crm:createActivity', { token, payload }),
  updateActivity: (token: string, id: number, payload: object) =>
    api.invoke('crm:updateActivity', { token, id, payload }),
  deleteActivity: (token: string, id: number) =>
    api.invoke('crm:deleteActivity', { token, id }),
  completeActivity: (token: string, id: number) =>
    api.invoke('crm:completeActivity', { token, id }),
  getStats: (token: string, filters?: object) =>
    api.invoke('crm:getStats', { token, filters }),
  listAssignees: (token: string) =>
    api.invoke('crm:listAssignees', { token }),
};

// Archiving
const archiving = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('archiving:list', { token, filters, page, limit }),
  getById: (token: string, id: number) =>
    api.invoke('archiving:getById', { token, id }),
  archive: (token: string, payload: object) =>
    api.invoke('archiving:archive', { token, payload }),
  restore: (token: string, id: number) =>
    api.invoke('archiving:restore', { token, id }),
  permanentDelete: (token: string, id: number) =>
    api.invoke('archiving:permanentDelete', { token, id }),
  getStats: (token: string) =>
    api.invoke('archiving:getStats', { token }),
  listPolicies: (token: string) =>
    api.invoke('archiving:listPolicies', { token }),
  createPolicy: (token: string, payload: object) =>
    api.invoke('archiving:createPolicy', { token, payload }),
  updatePolicy: (token: string, id: number, payload: object) =>
    api.invoke('archiving:updatePolicy', { token, id, payload }),
  deletePolicy: (token: string, id: number) =>
    api.invoke('archiving:deletePolicy', { token, id }),
};

// Lotissements
const lotissements = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('lotissements:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('lotissements:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('lotissements:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('lotissements:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('lotissements:delete', { token, id }),
  statusStats: (token: string, filters?: object) =>
    api.invoke('lotissements:statusStats', { token, filters }),
};

// Terrains
const terrains = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('terrains:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('terrains:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('terrains:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('terrains:update', { token, id, payload }),
  updateStatut: (token: string, id: number, statut: string) => api.invoke('terrains:updateStatut', { token, id, statut }),
  delete: (token: string, id: number) => api.invoke('terrains:delete', { token, id }),
  statusStats: (token: string, filters?: object) =>
    api.invoke('terrains:statusStats', { token, filters }),
  generateAcdInvoices: (token: string, id: number) =>
    api.invoke('terrains:generateAcdInvoices', { token, id }),
  cancelAcdInvoices: (token: string, id: number) =>
    api.invoke('terrains:cancelAcdInvoices', { token, id }),
  updateAcdInvoices: (token: string, terrainId: number, invoices: { id: number; dueDate: string; amount: number }[]) =>
    api.invoke('terrains:updateAcdInvoices', { token, terrainId, invoices }),
};

// Programmes immobiliers
const programmes = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('programmes:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('programmes:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('programmes:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('programmes:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('programmes:delete', { token, id }),
  statusStats: (token: string, filters?: object) =>
    api.invoke('programmes:statusStats', { token, filters }),
};

// Projets
const projects = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('projects:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('projects:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('projects:create', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('projects:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('projects:delete', { token, id }),
  statusStats: (token: string, filters?: object) =>
    api.invoke('projects:statusStats', { token, filters }),
  // Catalogue des types de projets
  listTypes: (token: string, includeInactive = false) =>
    api.invoke('projects:listTypes', { token, includeInactive }),
  createType: (token: string, payload: object) =>
    api.invoke('projects:createType', { token, payload }),
  updateType: (token: string, id: number, payload: object) =>
    api.invoke('projects:updateType', { token, id, payload }),
  deleteType: (token: string, id: number) =>
    api.invoke('projects:deleteType', { token, id }),
};

// Géolocalisation
const geo = {
  resolveMapLink: (token: string, link: string) => api.invoke('geo:resolveMapLink', { token, link }),
};

// Pays (table de référence)
const countries = {
  list: (token: string) => api.invoke('countries:list', { token }),
};

// Export de listes (PDF / Excel)
const exporter = {
  generate: (token: string, payload: object) => api.invoke('export:generate', { token, ...payload }),
  // Aperçu avant impression d'une liste (impression directe avec choix d'imprimante).
  print: (token: string, payload: object) => api.invoke('export:print', { token, ...payload }),
};

// Export PDF de document (convention / attestation) avec en-tête + pied de page
// rendus sur chaque page via le moteur natif Chromium.
const documentExport = {
  exportDocumentPdf: (
    token: string,
    payload: {
      fileName: string;
      bodyHtml: string;
      headerTemplate: string;
      footerTemplate: string;
      headerMm: number;
      footerMm: number;
      marginsMm?: { top: number; bottom: number; left: number; right: number };
    },
  ) => api.invoke('documents:exportDocumentPdf', { token, ...payload }),
  // Aperçu avant impression du document (impression directe avec choix d'imprimante).
  printDocument: (
    token: string,
    payload: {
      fileName: string;
      bodyHtml: string;
      headerTemplate: string;
      footerTemplate: string;
      headerMm: number;
      footerMm: number;
      marginsMm?: { top: number; bottom: number; left: number; right: number };
    },
  ) => api.invoke('documents:printDocument', { token, ...payload }),
  exportDocumentDocx: (
    token: string,
    payload: {
      fileName: string;
      bodyHtml: string;
      headerTemplate: string;
      footerTemplate: string;
      headerMm: number;
      footerMm: number;
    },
  ) => api.invoke('documents:exportDocumentDocx', { token, ...payload }),
};

// Modèles de facture
const invoiceTemplates = {
  list: (token: string) => api.invoke('invoiceTemplates:list', { token }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('invoiceTemplates:update', { token, id, payload }),
  setDefaults: (token: string, defaults: object) =>
    api.invoke('invoiceTemplates:setDefaults', { token, defaults }),
};

// Modèle d'export de listes
const listExportTemplates = {
  list: (token: string) => api.invoke('listExportTemplates:list', { token }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('listExportTemplates:update', { token, id, payload }),
};

// Commissions
const commissions = {
  getDashboard: (token: string) => api.invoke('commissions:getDashboard', { token }),
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('commissions:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('commissions:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('commissions:create', { token, payload }),
  prepareInstallmentCommission: (token: string, installmentId: number) =>
    api.invoke('commissions:prepareInstallmentCommission', { token, installmentId }),
  createForInstallment: (token: string, payload: object) =>
    api.invoke('commissions:createForInstallment', { token, payload }),
  update: (token: string, payload: object) => api.invoke('commissions:update', { token, payload }),
  pay: (token: string, payload: object) => api.invoke('commissions:pay', { token, payload }),
  cancel: (token: string, payload: object) => api.invoke('commissions:cancel', { token, payload }),
  getBeneficiarySummary: (token: string, beneficiaryType: string, beneficiaryId: number) =>
    api.invoke('commissions:getBeneficiarySummary', { token, beneficiaryType, beneficiaryId }),
  listReferrers: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('commissions:listReferrers', { token, filters, page, limit }),
  getReferrerById: (token: string, id: number) => api.invoke('commissions:getReferrerById', { token, id }),
  createReferrer: (token: string, payload: object) => api.invoke('commissions:createReferrer', { token, payload }),
  updateReferrer: (token: string, id: number, payload: object) =>
    api.invoke('commissions:updateReferrer', { token, id, payload }),
  deleteReferrer: (token: string, id: number) => api.invoke('commissions:deleteReferrer', { token, id }),
  listUsers: (token: string) => api.invoke('commissions:listUsers', { token }),
  listEligibleConventions: (token: string, filters?: { userId?: number; referrerId?: number }) =>
    api.invoke('commissions:listEligibleConventions', { token, filters }),
  getSettings: (token: string) => api.invoke('commissions:getSettings', { token }),
  updateSettings: (token: string, payload: object) => api.invoke('commissions:updateSettings', { token, payload }),
};

// Budgets
const budget = {
  getDashboard: (token: string) => api.invoke('budget:getDashboard', { token }),
  list: (token: string, filters?: object) => api.invoke('budget:list', { token, filters }),
  getById: (token: string, id: number) => api.invoke('budget:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('budget:create', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('budget:update', { token, id, payload }),
  close: (token: string, id: number) => api.invoke('budget:close', { token, id }),
  reopen: (token: string, id: number) => api.invoke('budget:reopen', { token, id }),
  delete: (token: string, id: number) => api.invoke('budget:delete', { token, id }),
  listLines: (token: string, filters?: object) => api.invoke('budget:listLines', { token, filters }),
  getLineById: (token: string, id: number) => api.invoke('budget:getLineById', { token, id }),
  createLine: (token: string, payload: object) => api.invoke('budget:createLine', { token, payload }),
  updateLine: (token: string, id: number, payload: object) =>
    api.invoke('budget:updateLine', { token, id, payload }),
  toggleLineActive: (token: string, id: number) => api.invoke('budget:toggleLineActive', { token, id }),
  deleteLine: (token: string, id: number) => api.invoke('budget:deleteLine', { token, id }),
  listEligibleManagers: (token: string) => api.invoke('budget:listEligibleManagers', { token }),
  listAccessibleLines: (token: string) => api.invoke('budget:listAccessibleLines', { token }),
};

// Trésorerie
const treasury = {
  getDashboard: (token: string) => api.invoke('treasury:getDashboard', { token }),
  listAccounts: (token: string, filters?: object) =>
    api.invoke('treasury:listAccounts', { token, filters }),
  getAccountById: (token: string, id: number) => api.invoke('treasury:getAccountById', { token, id }),
  createAccount: (token: string, payload: object) => api.invoke('treasury:createAccount', { token, payload }),
  updateAccount: (token: string, id: number, payload: object) =>
    api.invoke('treasury:updateAccount', { token, id, payload }),
  deleteAccount: (token: string, id: number) => api.invoke('treasury:deleteAccount', { token, id }),
  setAccountViewers: (token: string, id: number, userIds: number[]) =>
    api.invoke('treasury:setAccountViewers', { token, id, userIds }),
  listOperations: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('treasury:listOperations', { token, filters, page, limit }),
  createOperation: (token: string, payload: object) => api.invoke('treasury:createOperation', { token, payload }),
  updateOperation: (token: string, id: number, payload: object) =>
    api.invoke('treasury:updateOperation', { token, id, payload }),
  deleteOperation: (token: string, id: number) => api.invoke('treasury:deleteOperation', { token, id }),
  getEntityCashflow: (
    token: string,
    entityType: 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME',
    entityId: number,
    limit?: number,
  ) => api.invoke('treasury:getEntityCashflow', { token, entityType, entityId, limit }),
  listCategories: (token: string, filters?: object) =>
    api.invoke('treasury:listCategories', { token, filters }),
  createCategory: (token: string, payload: object) => api.invoke('treasury:createCategory', { token, payload }),
  updateCategory: (token: string, id: number, payload: object) =>
    api.invoke('treasury:updateCategory', { token, id, payload }),
  deleteCategory: (token: string, id: number) => api.invoke('treasury:deleteCategory', { token, id }),
  listThirdParties: (token: string, filters?: object) =>
    api.invoke('treasury:listThirdParties', { token, filters }),
  createThirdParty: (token: string, payload: object) => api.invoke('treasury:createThirdParty', { token, payload }),
  updateThirdParty: (token: string, id: number, payload: object) =>
    api.invoke('treasury:updateThirdParty', { token, id, payload }),
  deleteThirdParty: (token: string, id: number) => api.invoke('treasury:deleteThirdParty', { token, id }),
  listUsers: (token: string) => api.invoke('treasury:listUsers', { token }),
};

// Dashboard
const dashboard = {
  getStats: (token: string) => api.invoke('dashboard:getStats', { token }),
};

// Configuration connexion BDD (accessible avant authentification)
const config = {
  getDb: () => api.invoke('config:getDb', {}),
  testDb: (dbConfig: object) => api.invoke('config:testDb', { config: dbConfig }),
  saveDb: (dbConfig: object) => api.invoke('config:saveDb', { config: dbConfig }),
};

// Paramètres applicatifs (réservés aux administrateurs)
const settings = {
  getCompany: (token: string) => api.invoke('settings:getCompany', { token }),
  updateCompany: (token: string, payload: object) =>
    api.invoke('settings:updateCompany', { token, payload }),
  uploadLogo: (token: string, payload: object) =>
    api.invoke('settings:uploadLogo', { token, payload }),
  deleteLogo: (token: string) => api.invoke('settings:deleteLogo', { token }),
  getLogoData: (token: string) => api.invoke('settings:getLogoData', { token }),
  /** Logo de connexion lu directement depuis le dossier logo/ (sans session ni accès DB). */
  getLoginLogoData: () => api.invoke('settings:getLoginLogoData', {}),

  getStorage: (token: string) => api.invoke('settings:getStorage', { token }),
  updateStorage: (token: string, payload: object) =>
    api.invoke('settings:updateStorage', { token, payload }),

  getEmail: (token: string) => api.invoke('settings:getEmail', { token }),
  updateEmail: (token: string, payload: object) =>
    api.invoke('settings:updateEmail', { token, payload }),
  testEmail: (token: string, to: string) =>
    api.invoke('settings:testEmail', { token, to }),

  getSms: (token: string) => api.invoke('settings:getSms', { token }),
  updateSms: (token: string, payload: object) =>
    api.invoke('settings:updateSms', { token, payload }),
  testSms: (token: string, to: string) =>
    api.invoke('settings:testSms', { token, to }),
  testWhatsapp: (token: string, to: string) =>
    api.invoke('settings:testWhatsapp', { token, to }),

  getConditionsParticulieres: (token: string) => api.invoke('settings:getConditionsParticulieres', { token }),
  updateConditionsParticulieres: (token: string, items: Array<{ title: string; text: string }>) =>
    api.invoke('settings:updateConditionsParticulieres', { token, items }),
  getSlideshow: (token: string) => api.invoke('settings:getSlideshow', { token }),
  updateSlideshow: (token: string, items: object[]) =>
    api.invoke('settings:updateSlideshow', { token, items }),
  uploadSlideshowMedia: (token: string, payload: object) =>
    api.invoke('settings:uploadSlideshowMedia', { token, payload }),
  getSlideshowMediaData: (token: string, relativePath: string) =>
    api.invoke('settings:getSlideshowMediaData', { token, relativePath }),
  getSlideshowVisibility: (token: string) =>
    api.invoke('settings:getSlideshowVisibility', { token }),
  updateSlideshowVisibility: (token: string, payload: { allowedRoles: string[] }) =>
    api.invoke('settings:updateSlideshowVisibility', { token, payload }),
  // Modèles de partage de localisation GPS
  getShareLocation: (token: string) => api.invoke('settings:getShareLocation', { token }),
  updateShareLocation: (token: string, payload: object) =>
    api.invoke('settings:updateShareLocation', { token, payload }),

  // Types de pièces d'identité (catalogue extensible)
  listIdTypes: (token: string, includeInactive = false) =>
    api.invoke('settings:listIdTypes', { token, includeInactive }),
  createIdType: (token: string, payload: object) =>
    api.invoke('settings:createIdType', { token, payload }),
  updateIdType: (token: string, id: number, payload: object) =>
    api.invoke('settings:updateIdType', { token, id, payload }),
  deleteIdType: (token: string, id: number) =>
    api.invoke('settings:deleteIdType', { token, id }),

  // Natures de titres de lotissement
  listTitleTypes: (token: string, includeInactive = false) =>
    api.invoke('settings:listTitleTypes', { token, includeInactive }),
  createTitleType: (token: string, payload: object) =>
    api.invoke('settings:createTitleType', { token, payload }),
  updateTitleType: (token: string, id: number, payload: object) =>
    api.invoke('settings:updateTitleType', { token, id, payload }),
  deleteTitleType: (token: string, id: number) =>
    api.invoke('settings:deleteTitleType', { token, id }),
};

// Documents
const documents = {
  uploadIdDocument: (token: string, clientId: number, payload: object) =>
    api.invoke('documents:uploadIdDocument', { token, clientId, ...payload }),
  uploadClientDoc: (token: string, clientId: number, category: string, payload: object) =>
    api.invoke('documents:uploadClientDoc', { token, clientId, category, ...payload }),
  getByClient: (token: string, clientId: number) =>
    api.invoke('documents:getByClient', { token, clientId }),
  uploadOwnerDoc: (token: string, ownerId: number, category: string, payload: object) =>
    api.invoke('documents:uploadOwnerDoc', { token, ownerId, category, ...payload }),
  getByOwner: (token: string, ownerId: number) =>
    api.invoke('documents:getByOwner', { token, ownerId }),
  uploadTerrainDoc: (token: string, terrainId: number, category: string, payload: object) =>
    api.invoke('documents:uploadTerrainDoc', { token, terrainId, category, ...payload }),
  getByTerrain: (token: string, terrainId: number) =>
    api.invoke('documents:getByTerrain', { token, terrainId }),
  openFile: (token: string, relativePath: string) =>
    api.invoke('documents:openFile', { token, relativePath }),
  // GED — Gestion électronique de documents
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('documents:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('documents:getById', { token, id }),
  import: (token: string, payload: object) => api.invoke('documents:import', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('documents:update', { token, id, payload }),
  remove: (token: string, id: number) => api.invoke('documents:remove', { token, id }),
  open: (token: string, id: number) => api.invoke('documents:open', { token, id }),
  getFileData: (token: string, id: number) => api.invoke('documents:getFileData', { token, id }),
  listCategories: (token: string) => api.invoke('documents:listCategories', { token }),
  createCategory: (token: string, payload: object) =>
    api.invoke('documents:createCategory', { token, payload }),
  updateCategory: (token: string, id: number, payload: object) =>
    api.invoke('documents:updateCategory', { token, id, payload }),
  deleteCategory: (token: string, id: number) =>
    api.invoke('documents:deleteCategory', { token, id }),
  listFolders: (token: string) => api.invoke('documents:listFolders', { token }),
  createFolder: (token: string, payload: object) =>
    api.invoke('documents:createFolder', { token, payload }),
  updateFolder: (token: string, id: number, payload: object) =>
    api.invoke('documents:updateFolder', { token, id, payload }),
  deleteFolder: (token: string, id: number) => api.invoke('documents:deleteFolder', { token, id }),
  listTags: (token: string) => api.invoke('documents:listTags', { token }),
  createTag: (token: string, payload: object) => api.invoke('documents:createTag', { token, payload }),
  updateTag: (token: string, id: number, payload: object) =>
    api.invoke('documents:updateTag', { token, id, payload }),
  deleteTag: (token: string, id: number) => api.invoke('documents:deleteTag', { token, id }),
  listAudit: (token: string, limit?: number) => api.invoke('documents:listAudit', { token, limit }),
  gedDashboard: (token: string) => api.invoke('documents:gedDashboard', { token }),
  /** Résout le chemin disque d'un fichier sélectionné/déposé (Electron webUtils). */
  pathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, conventions, conventionTemplates, attestationTemplates, attestations, quotes, quoteTemplates, catalog, accounting, bilan, communication, crm, archiving, documents, documentExport, lotissements, terrains, programmes, projects, geo, countries, commissions, exporter, invoiceTemplates, listExportTemplates, treasury, budget, dashboard, settings, reminders, config });
