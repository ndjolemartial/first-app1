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
  listSelectable: (token: string, options?: object) => api.invoke('users:listSelectable', { token, options }),
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
  getTimeline: (token: string, id: number) => api.invoke('prospects:getTimeline', { token, id }),
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
  getTimeline: (token: string, id: number) => api.invoke('clients:getTimeline', { token, id }),
  beneficialOwners: {
    create: (token: string, clientId: number, payload: object) =>
      api.invoke('clients:beneficialOwners:create', { token, clientId, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('clients:beneficialOwners:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('clients:beneficialOwners:delete', { token, id }),
  },
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
  beneficialOwners: {
    create: (token: string, ownerId: number, payload: object) =>
      api.invoke('owners:beneficialOwners:create', { token, ownerId, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('owners:beneficialOwners:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('owners:beneficialOwners:delete', { token, id }),
  },
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
  getLegacyBalance: (token: string, clientId: number, terrainIds: number[]) =>
    api.invoke('attestations:getLegacyBalance', { token, clientId, terrainIds }),
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
  listUnits: (token: string, includeInactive?: boolean) => api.invoke('quotes:listUnits', { token, includeInactive }),
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
  listUnits: (token: string, includeInactive?: boolean) => api.invoke('catalog:listUnits', { token, includeInactive }),
  createUnit: (token: string, payload: object) => api.invoke('catalog:createUnit', { token, payload }),
  updateUnit: (token: string, id: number, payload: object) => api.invoke('catalog:updateUnit', { token, id, payload }),
  deleteUnit: (token: string, id: number) => api.invoke('catalog:deleteUnit', { token, id }),
  listCategories: (token: string, includeInactive?: boolean) => api.invoke('catalog:listCategories', { token, includeInactive }),
  createCategory: (token: string, payload: object) => api.invoke('catalog:createCategory', { token, payload }),
  updateCategory: (token: string, id: number, payload: object) => api.invoke('catalog:updateCategory', { token, id, payload }),
  deleteCategory: (token: string, id: number) => api.invoke('catalog:deleteCategory', { token, id }),
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
  listInstallments: (token: string, crmReferentScope = false) =>
    api.invoke('accounting:listInstallments', { token, crmReferentScope }),
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
  myTemplatePermissions: (token: string) =>
    api.invoke('communication:myTemplatePermissions', { token }),
  getHistory: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('communication:getHistory', { token, filters, page, limit }),
  markRead: (token: string, id: number) =>
    api.invoke('communication:markRead', { token, id }),
  sendEmail: (token: string, payload: object) =>
    api.invoke('communication:sendEmail', { token, payload }),
  sendSms: (token: string, payload: object) =>
    api.invoke('communication:sendSms', { token, payload }),
  sendWhatsapp: (token: string, payload: object) =>
    api.invoke('communication:sendWhatsapp', { token, payload }),
  resend: (token: string, id: number) =>
    api.invoke('communication:resend', { token, id }),
  deleteMessage: (token: string, id: number) =>
    api.invoke('communication:delete', { token, id }),
  resolveTarget: (token: string, payload: object) =>
    api.invoke('communication:resolveTarget', { token, payload }),
  shareLocation: (token: string, payload: object) =>
    api.invoke('communication:shareLocation', { token, payload }),
  previewShareLocation: (token: string, payload: object) =>
    api.invoke('communication:previewShareLocation', { token, payload }),
  getTracking: (token: string) =>
    api.invoke('communication:getTracking', { token }),
  updateTracking: (token: string, baseUrl: string) =>
    api.invoke('communication:updateTracking', { token, baseUrl }),
  linkInbound: (token: string, id: number, payload: object) =>
    api.invoke('communication:linkInbound', { token, id, payload }),
};

// Boîte email personnelle (self-service, réception des réponses)
const mailAccount = {
  get: (token: string) => api.invoke('mailAccount:get', { token }),
  upsert: (token: string, payload: object) =>
    api.invoke('mailAccount:upsert', { token, payload }),
  test: (token: string, payload?: object) => api.invoke('mailAccount:test', { token, payload }),
  delete: (token: string) => api.invoke('mailAccount:delete', { token }),
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
  createRule: (token: string, payload: object) =>
    api.invoke('reminders:createRule', { token, payload }),
  deleteRule: (token: string, id: number) =>
    api.invoke('reminders:deleteRule', { token, id }),
  runNow: (token: string) =>
    api.invoke('reminders:runNow', { token }),
  setClientOptOut: (token: string, payload: object) =>
    api.invoke('reminders:setClientOptOut', { token, payload }),
  listOptedOutClients: (token: string) =>
    api.invoke('reminders:listOptedOutClients', { token }),
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

// Gestion des visiteurs
const visitors = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('visitors:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('visitors:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('visitors:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('visitors:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('visitors:delete', { token, id }),
  stats: (token: string) => api.invoke('visitors:stats', { token }),
  listObjects: (token: string, includeInactive?: boolean) =>
    api.invoke('visitors:listObjects', { token, includeInactive }),
  createObject: (token: string, label: string) => api.invoke('visitors:createObject', { token, label }),
  updateObject: (token: string, id: number, payload: object) =>
    api.invoke('visitors:updateObject', { token, id, payload }),
  deleteObject: (token: string, id: number) => api.invoke('visitors:deleteObject', { token, id }),
};

// Gestion des appels (entrants / sortants)
const calls = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('calls:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('calls:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('calls:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('calls:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('calls:delete', { token, id }),
  stats: (token: string) => api.invoke('calls:stats', { token }),
  searchClients: (token: string, search?: string) => api.invoke('calls:searchClients', { token, search }),
  searchProspects: (token: string, search?: string) => api.invoke('calls:searchProspects', { token, search }),
  phoneLines: {
    list: (token: string, includeInactive?: boolean) => api.invoke('calls:phoneLines:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('calls:phoneLines:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('calls:phoneLines:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('calls:phoneLines:delete', { token, id }),
  },
};

// Réseaux sociaux & plateformes web
const socialMedia = {
  platforms: {
    list: (token: string, includeInactive?: boolean) => api.invoke('socialMedia:listPlatforms', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('socialMedia:createPlatform', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('socialMedia:updatePlatform', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('socialMedia:deletePlatform', { token, id }),
  },
  publications: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('socialMedia:listPublications', { token, filters, page, limit }),
    create: (token: string, payload: object) => api.invoke('socialMedia:createPublication', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('socialMedia:updatePublication', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('socialMedia:deletePublication', { token, id }),
  },
  snapshots: {
    list: (token: string, platformId?: number, limit?: number) => api.invoke('socialMedia:listSnapshots', { token, platformId, limit }),
    upsert: (token: string, payload: object) => api.invoke('socialMedia:upsertSnapshot', { token, payload }),
    delete: (token: string, id: number) => api.invoke('socialMedia:deleteSnapshot', { token, id }),
  },
  dashboard: (token: string) => api.invoke('socialMedia:dashboard', { token }),
};

// Innovations IT (Module 16)
const innovations = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('innovations:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('innovations:getById', { token, id }),
  employees: (token: string) => api.invoke('innovations:employees', { token }),
  create: (token: string, payload: object) => api.invoke('innovations:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('innovations:update', { token, id, payload }),
  submitPhase2: (token: string, id: number, payload: object) => api.invoke('innovations:submitPhase2', { token, id, payload }),
  submitPhase3: (token: string, id: number, payload: object) => api.invoke('innovations:submitPhase3', { token, id, payload }),
  validatePhase: (token: string, id: number, payload: object) => api.invoke('innovations:validatePhase', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('innovations:delete', { token, id }),
  removeAttachment: (token: string, id: number, documentId: number) =>
    api.invoke('innovations:removeAttachment', { token, id, documentId }),
};

// Moteur de devis de construction (Module 17) — bibliothèque technique
const constructionLibrary = {
  lots: {
    list: (token: string, includeInactive?: boolean) => api.invoke('construction:lots:list', { token, includeInactive }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('construction:lots:upsert', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('construction:lots:delete', { token, id }),
  },
  resourceFamilies: {
    list: (token: string, includeInactive?: boolean) => api.invoke('construction:resourceFamilies:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('construction:resourceFamilies:create', { token, payload }),
    delete: (token: string, id: number) => api.invoke('construction:resourceFamilies:delete', { token, id }),
  },
  localities: {
    list: (token: string, includeInactive?: boolean) => api.invoke('construction:localities:list', { token, includeInactive }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('construction:localities:upsert', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('construction:localities:delete', { token, id }),
  },
  resources: {
    list: (token: string, filters?: object, page?: number, limit?: number) => api.invoke('construction:resources:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('construction:resources:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('construction:resources:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('construction:resources:update', { token, id, payload }),
    updatePrice: (token: string, id: number, payload: object) => api.invoke('construction:resources:updatePrice', { token, id, payload }),
    priceHistory: (token: string, id: number, limit?: number) => api.invoke('construction:resources:priceHistory', { token, id, limit }),
    whereUsed: (token: string, id: number) => api.invoke('construction:resources:whereUsed', { token, id }),
    delete: (token: string, id: number) => api.invoke('construction:resources:delete', { token, id }),
  },
  workItems: {
    list: (token: string, filters?: object) => api.invoke('construction:workItems:list', { token, filters }),
    getById: (token: string, id: number) => api.invoke('construction:workItems:getById', { token, id }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('construction:workItems:upsert', { token, id, payload }),
    duplicate: (token: string, id: number) => api.invoke('construction:workItems:duplicate', { token, id }),
    delete: (token: string, id: number) => api.invoke('construction:workItems:delete', { token, id }),
  },
  ratioDefs: {
    list: (token: string, includeInactive?: boolean) => api.invoke('construction:ratioDefs:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('construction:ratioDefs:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('construction:ratioDefs:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('construction:ratioDefs:delete', { token, id }),
  },
  ratioProfiles: {
    list: (token: string) => api.invoke('construction:ratioProfiles:list', { token }),
    getById: (token: string, id: number) => api.invoke('construction:ratioProfiles:getById', { token, id }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('construction:ratioProfiles:upsert', { token, id, payload }),
    duplicate: (token: string, id: number, target: object) => api.invoke('construction:ratioProfiles:duplicate', { token, id, target }),
    delete: (token: string, id: number) => api.invoke('construction:ratioProfiles:delete', { token, id }),
  },
  health: (token: string) => api.invoke('construction:library:health', { token }),
};

// Moteur de devis de construction (Module 17) — projets & estimations
const construction = {
  projects: {
    list: (token: string, filters?: object, page?: number, limit?: number) => api.invoke('construction:projects:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('construction:projects:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('construction:projects:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('construction:projects:update', { token, id, payload }),
    duplicate: (token: string, id: number) => api.invoke('construction:projects:duplicate', { token, id }),
    delete: (token: string, id: number) => api.invoke('construction:projects:delete', { token, id }),
  },
  quickEstimate: (token: string, args: { projectId?: number; characteristics?: object }) =>
    api.invoke('construction:quickEstimate', { token, ...args }),
  generateEstimate: (token: string, payload: object) => api.invoke('construction:generateEstimate', { token, ...payload }),
  estimates: {
    list: (token: string, projectId: number) => api.invoke('construction:estimates:list', { token, projectId }),
    getById: (token: string, id: number) => api.invoke('construction:estimates:getById', { token, id }),
    summary: (token: string, id: number) => api.invoke('construction:estimates:summary', { token, id }),
    materials: (token: string, id: number) => api.invoke('construction:estimates:materials', { token, id }),
    labor: (token: string, id: number) => api.invoke('construction:estimates:labor', { token, id }),
    toQuote: (token: string, estimateId: number, payload: object) => api.invoke('construction:estimates:toQuote', { token, estimateId, payload }),
    setStatus: (token: string, id: number, status: string) => api.invoke('construction:estimates:setStatus', { token, id, status }),
    delete: (token: string, id: number) => api.invoke('construction:estimates:delete', { token, id }),
  },
};

// Moteur de devis de permis de construire (Module 18) — bibliothèque technique
const permitLibrary = {
  communes: {
    list: (token: string, includeInactive?: boolean) => api.invoke('permits:communes:list', { token, includeInactive }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('permits:communes:upsert', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('permits:communes:delete', { token, id }),
  },
  feeItems: {
    list: (token: string, filters?: object) => api.invoke('permits:feeItems:list', { token, filters }),
    getById: (token: string, id: number) => api.invoke('permits:feeItems:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('permits:feeItems:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('permits:feeItems:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('permits:feeItems:delete', { token, id }),
  },
  rateOverrides: {
    list: (token: string, feeItemId: number) => api.invoke('permits:rateOverrides:list', { token, feeItemId }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('permits:rateOverrides:upsert', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('permits:rateOverrides:delete', { token, id }),
  },
  surfaceBrackets: {
    list: (token: string, feeItemId: number) => api.invoke('permits:surfaceBrackets:list', { token, feeItemId }),
    upsert: (token: string, id: number | undefined, payload: object) => api.invoke('permits:surfaceBrackets:upsert', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('permits:surfaceBrackets:delete', { token, id }),
  },
};

// Moteur de devis de permis de construire (Module 18) — projets & estimations
const permits = {
  projects: {
    list: (token: string, filters?: object, page?: number, limit?: number) => api.invoke('permits:projects:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('permits:projects:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('permits:projects:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('permits:projects:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('permits:projects:delete', { token, id }),
  },
  quickEstimate: (token: string, args: { projectId?: number; characteristics?: object }) =>
    api.invoke('permits:quickEstimate', { token, ...args }),
  generateEstimate: (token: string, projectId: number) => api.invoke('permits:generateEstimate', { token, projectId }),
  estimates: {
    list: (token: string, projectId: number) => api.invoke('permits:estimates:list', { token, projectId }),
    getById: (token: string, id: number) => api.invoke('permits:estimates:getById', { token, id }),
    toQuote: (token: string, estimateId: number, payload: object) => api.invoke('permits:estimates:toQuote', { token, estimateId, payload }),
    setStatus: (token: string, id: number, status: string) => api.invoke('permits:estimates:setStatus', { token, id, status }),
    delete: (token: string, id: number) => api.invoke('permits:estimates:delete', { token, id }),
  },
};

// Conformité LBC/FT (Module 19)
const aml = {
  profiles: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('aml:profiles:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('aml:profiles:getById', { token, id }),
    getBySubject: (token: string, subjectType: string, subjectId: number) =>
      api.invoke('aml:profiles:getBySubject', { token, subjectType, subjectId }),
    subjectsWithoutProfile: (token: string, subjectType: string, search?: string) =>
      api.invoke('aml:profiles:subjectsWithoutProfile', { token, subjectType, search }),
    create: (token: string, payload: object) => api.invoke('aml:profiles:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('aml:profiles:update', { token, id, payload }),
    setRiskFactors: (token: string, id: number, payload: object) => api.invoke('aml:profiles:setRiskFactors', { token, id, payload }),
    computeRisk: (token: string, id: number) => api.invoke('aml:profiles:computeRisk', { token, id }),
    validate: (token: string, id: number) => api.invoke('aml:profiles:validate', { token, id }),
    markToReview: (token: string, id: number) => api.invoke('aml:profiles:markToReview', { token, id }),
    markRefused: (token: string, id: number) => api.invoke('aml:profiles:markRefused', { token, id }),
    delete: (token: string, id: number) => api.invoke('aml:profiles:delete', { token, id }),
  },
  beneficialOwners: {
    list: (token: string, profileId: number) => api.invoke('aml:beneficialOwners:list', { token, profileId }),
    create: (token: string, profileId: number, payload: object) => api.invoke('aml:beneficialOwners:create', { token, profileId, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('aml:beneficialOwners:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('aml:beneficialOwners:delete', { token, id }),
  },
  riskFactors: {
    list: (token: string, includeInactive?: boolean) => api.invoke('aml:riskFactors:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('aml:riskFactors:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('aml:riskFactors:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('aml:riskFactors:delete', { token, id }),
  },
  watchlist: {
    list: (token: string, filters?: object) => api.invoke('aml:watchlist:list', { token, filters }),
    getById: (token: string, id: number) => api.invoke('aml:watchlist:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('aml:watchlist:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('aml:watchlist:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('aml:watchlist:delete', { token, id }),
    screen: (token: string, profileId: number) => api.invoke('aml:watchlist:screen', { token, profileId }),
  },
  watchlistMatches: {
    list: (token: string, profileId: number) => api.invoke('aml:watchlistMatches:list', { token, profileId }),
    review: (token: string, id: number, payload: object) => api.invoke('aml:watchlistMatches:review', { token, id, payload }),
  },
  reviews: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('aml:reviews:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('aml:reviews:getById', { token, id }),
    getByConvention: (token: string, conventionId: number) => api.invoke('aml:reviews:getByConvention', { token, conventionId }),
    pendingCandidates: (token: string) => api.invoke('aml:reviews:pendingCandidates', { token }),
    create: (token: string, payload: object) => api.invoke('aml:reviews:create', { token, payload }),
    close: (token: string, id: number, payload: object) => api.invoke('aml:reviews:close', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('aml:reviews:delete', { token, id }),
  },
  suspiciousReports: {
    create: (token: string, payload: object) => api.invoke('aml:suspiciousReports:create', { token, payload }),
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('aml:suspiciousReports:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('aml:suspiciousReports:getById', { token, id }),
    update: (token: string, id: number, payload: object) => api.invoke('aml:suspiciousReports:update', { token, id, payload }),
    transmit: (token: string, id: number, payload: object) => api.invoke('aml:suspiciousReports:transmit', { token, id, payload }),
    classify: (token: string, id: number, payload: object) => api.invoke('aml:suspiciousReports:classify', { token, id, payload }),
  },
  training: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('aml:training:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('aml:training:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('aml:training:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('aml:training:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('aml:training:delete', { token, id }),
  },
  dashboard: (token: string) => api.invoke('aml:dashboard:overview', { token }),
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

// RH / Paie — personnel et contrats de travail
const hr = {
  employees: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('hr:employees:list', { token, filters, page, limit }),
    stats: (token: string) => api.invoke('hr:employees:stats', { token }),
    getById: (token: string, id: number) => api.invoke('hr:employees:getById', { token, id }),
    linkableUsers: (token: string, excludeEmployeeId?: number) =>
      api.invoke('hr:employees:linkableUsers', { token, excludeEmployeeId }),
    careerProfiles: (token: string) => api.invoke('hr:employees:careerProfiles', { token }),
    create: (token: string, payload: object) => api.invoke('hr:employees:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:employees:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:employees:delete', { token, id }),
  },
  contracts: {
    create: (token: string, payload: object) => api.invoke('hr:contracts:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:contracts:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:contracts:delete', { token, id }),
    getRenderData: (token: string, id: number) => api.invoke('hr:contracts:getRenderData', { token, id }),
  },
  signedContracts: {
    list: (token: string, employeeId: number) => api.invoke('hr:signedContracts:list', { token, employeeId }),
    upload: (token: string, payload: object) => api.invoke('hr:signedContracts:upload', { token, payload }),
    delete: (token: string, id: number) => api.invoke('hr:signedContracts:delete', { token, id }),
    fileData: (token: string, id: number) => api.invoke('hr:signedContracts:fileData', { token, id }),
    open: (token: string, id: number) => api.invoke('hr:signedContracts:open', { token, id }),
  },
  payslips: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('hr:payslips:list', { token, filters, page, limit }),
    getById: (token: string, id: number) => api.invoke('hr:payslips:getById', { token, id }),
    generate: (token: string, payload: object) => api.invoke('hr:payslips:generate', { token, payload }),
    duplicate: (token: string, payload: object) => api.invoke('hr:payslips:duplicate', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('hr:payslips:update', { token, id, payload }),
    updateStatus: (token: string, id: number, status: string, paymentMethod?: string, paidAt?: string, bankAccountId?: number) =>
      api.invoke('hr:payslips:updateStatus', { token, id, status, paymentMethod, paidAt, bankAccountId }),
    updatePayment: (token: string, id: number, paidAt?: string, paymentMethod?: string, bankAccountId?: number) =>
      api.invoke('hr:payslips:updatePayment', { token, id, paidAt, paymentMethod, bankAccountId }),
    payAccounts: (token: string) => api.invoke('hr:payslips:payAccounts', { token }),
    delete: (token: string, id: number) => api.invoke('hr:payslips:delete', { token, id }),
    print: (token: string, id: number) => api.invoke('hr:payslips:print', { token, id }),
  },
  payroll: {
    getRates: (token: string) => api.invoke('hr:payroll:getRates', { token }),
    setRates: (token: string, rates: object) => api.invoke('hr:payroll:setRates', { token, rates }),
    preview: (token: string, payload: { baseSalary: number; sursalaire?: number; primeAnciennete?: number; transportAllowance?: number }) =>
      api.invoke('hr:payroll:preview', { token, ...payload }),
  },
  contractTemplates: {
    list: (token: string) => api.invoke('hr:contractTemplates:list', { token }),
    create: (token: string, payload: object) => api.invoke('hr:contractTemplates:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:contractTemplates:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:contractTemplates:delete', { token, id }),
  },
  essaiCategories: {
    list: (token: string, includeInactive?: boolean) => api.invoke('hr:essaiCategories:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('hr:essaiCategories:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:essaiCategories:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:essaiCategories:delete', { token, id }),
  },
  contractFunctions: {
    list: (token: string, includeInactive?: boolean) => api.invoke('hr:contractFunctions:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('hr:contractFunctions:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:contractFunctions:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:contractFunctions:delete', { token, id }),
  },
  contractObjectives: {
    list: (token: string, includeInactive?: boolean) => api.invoke('hr:contractObjectives:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('hr:contractObjectives:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:contractObjectives:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:contractObjectives:delete', { token, id }),
  },
  jobPositions: {
    list: (token: string, includeInactive?: boolean) => api.invoke('hr:jobPositions:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('hr:jobPositions:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:jobPositions:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:jobPositions:delete', { token, id }),
  },
  departments: {
    list: (token: string, includeInactive?: boolean) => api.invoke('hr:departments:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('hr:departments:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:departments:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:departments:delete', { token, id }),
  },
  commissionActivities: {
    list: (token: string) => api.invoke('hr:commissionActivities:list', { token }),
  },
  jobDescriptionTemplates: {
    list: (token: string) => api.invoke('hr:jobDescriptionTemplates:list', { token }),
    create: (token: string, payload: object) => api.invoke('hr:jobDescriptionTemplates:create', { token, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:jobDescriptionTemplates:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('hr:jobDescriptionTemplates:delete', { token, id }),
  },
  // Espace self-service : mon propre contenu RH & Paie (lecture seule).
  me: {
    overview: (token: string) => api.invoke('hr:me:overview', { token }),
    careerProfile: (token: string) => api.invoke('hr:me:careerProfile', { token }),
    payslips: (token: string) => api.invoke('hr:me:payslips', { token }),
    payslip: (token: string, id: number) => api.invoke('hr:me:payslip', { token, id }),
    payslipPrint: (token: string, id: number) => api.invoke('hr:me:payslipPrint', { token, id }),
    attendance: (token: string, year: number, month: number) => api.invoke('hr:me:attendance', { token, year, month }),
    leaveRequests: (token: string) => api.invoke('hr:me:leaveRequests', { token }),
    contractRenderData: (token: string, id: number) => api.invoke('hr:me:contractRenderData', { token, id }),
    reglementInterieur: (token: string) => api.invoke('hr:me:reglementInterieur', { token }),
    reglementInterieurPrint: (token: string) => api.invoke('hr:me:reglementInterieurPrint', { token }),
    signedContracts: (token: string) => api.invoke('hr:me:signedContracts', { token }),
    signedContractFile: (token: string, id: number) => api.invoke('hr:me:signedContractFile', { token, id }),
    signedContractOpen: (token: string, id: number) => api.invoke('hr:me:signedContractOpen', { token, id }),
    signedContractPrint: (token: string, id: number) => api.invoke('hr:me:signedContractPrint', { token, id }),
  },
  payslipTemplates: {
    list: (token: string) => api.invoke('hr:payslipTemplates:list', { token }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('hr:payslipTemplates:update', { token, id, payload }),
  },
  leaveTypes: {
    list: (token: string) => api.invoke('hr:leaveTypes:list', { token }),
  },
  leave: {
    balance: (token: string, employeeId: number) => api.invoke('hr:leave:balance', { token, employeeId }),
  },
  leaveRequests: {
    list: (token: string, filters?: object, page?: number, limit?: number) =>
      api.invoke('hr:leaveRequests:list', { token, filters, page, limit }),
    create: (token: string, payload: object) => api.invoke('hr:leaveRequests:create', { token, payload }),
    decide: (token: string, id: number, status: string, note?: string) =>
      api.invoke('hr:leaveRequests:decide', { token, id, status, note }),
    print: (token: string, id: number) => api.invoke('hr:leaveRequests:print', { token, id }),
    delete: (token: string, id: number) => api.invoke('hr:leaveRequests:delete', { token, id }),
    uploadSigned: (token: string, payload: object) => api.invoke('hr:leaveRequests:uploadSigned', { token, payload }),
    openSigned: (token: string, id: number) => api.invoke('hr:leaveRequests:openSigned', { token, id }),
    removeSigned: (token: string, id: number) => api.invoke('hr:leaveRequests:removeSigned', { token, id }),
  },
  attendance: {
    list: (token: string, employeeId: number, year: number, month: number) =>
      api.invoke('hr:attendance:list', { token, employeeId, year, month }),
    summary: (token: string, employeeId: number, year: number, month: number) =>
      api.invoke('hr:attendance:summary', { token, employeeId, year, month }),
    bulkUpsert: (token: string, records: object[]) => api.invoke('hr:attendance:bulkUpsert', { token, records }),
  },
  lateness: {
    list: (token: string, filters?: { year?: number; month?: number; employeeId?: number; onlyUnjustified?: boolean }) =>
      api.invoke('hr:lateness:list', { token, ...filters }),
    linkableLeaveRequests: (token: string, employeeId: number, date: string) =>
      api.invoke('hr:lateness:linkableLeaveRequests', { token, employeeId, date }),
    linkableActivities: (token: string, employeeId: number, date: string) =>
      api.invoke('hr:lateness:linkableActivities', { token, employeeId, date }),
    justify: (token: string, payload: object) => api.invoke('hr:lateness:justify', { token, payload }),
    unjustify: (token: string, employeeId: number, date: string) =>
      api.invoke('hr:lateness:unjustify', { token, employeeId, date }),
    tolerate: (token: string, payload: object) => api.invoke('hr:lateness:tolerate', { token, payload }),
    untolerate: (token: string, employeeId: number, date: string) =>
      api.invoke('hr:lateness:untolerate', { token, employeeId, date }),
  },
};

// Performance — évaluation & gestion des performances du personnel
const performance = {
  kpis: {
    list: (token: string, includeInactive?: boolean) => api.invoke('performance:kpis:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('performance:kpis:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('performance:kpis:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('performance:kpis:delete', { token, id }),
  },
  weights: {
    list: (token: string) => api.invoke('performance:weights:list', { token }),
    upsert: (token: string, id: number | null, payload: object) => api.invoke('performance:weights:upsert', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('performance:weights:delete', { token, id }),
  },
  units: {
    list: (token: string, includeInactive?: boolean) => api.invoke('performance:units:list', { token, includeInactive }),
    create: (token: string, payload: object) => api.invoke('performance:units:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('performance:units:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('performance:units:delete', { token, id }),
  },
  employees: {
    list: (token: string, scope?: 'evaluations') => api.invoke('performance:employees:list', { token, scope }),
  },
  objectives: {
    list: (token: string, filters?: object) => api.invoke('performance:objectives:list', { token, filters }),
    getById: (token: string, id: number) => api.invoke('performance:objectives:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('performance:objectives:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('performance:objectives:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('performance:objectives:delete', { token, id }),
    duplicate: (token: string, sourceObj: object, targetObj: object) => api.invoke('performance:objectives:duplicate', { token, source: sourceObj, target: targetObj }),
  },
  evaluations: {
    list: (token: string, filters?: object) => api.invoke('performance:evaluations:list', { token, filters }),
    getById: (token: string, id: number) => api.invoke('performance:evaluations:getById', { token, id }),
    create: (token: string, payload: object) => api.invoke('performance:evaluations:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('performance:evaluations:update', { token, id, payload }),
    computeKpis: (token: string, id: number) => api.invoke('performance:evaluations:computeKpis', { token, id }),
    submit: (token: string, id: number) => api.invoke('performance:evaluations:submit', { token, id }),
    sign: (token: string, id: number, level: 'MANAGER' | 'EMPLOYEE' | 'DIRECTION') => api.invoke('performance:evaluations:sign', { token, id, level }),
    refuse: (token: string, id: number, reason?: string) => api.invoke('performance:evaluations:refuse', { token, id, reason }),
    delete: (token: string, id: number) => api.invoke('performance:evaluations:delete', { token, id }),
  },
  plans: {
    list: (token: string, filters?: object) => api.invoke('performance:plans:list', { token, filters }),
    create: (token: string, payload: object) => api.invoke('performance:plans:create', { token, payload }),
    update: (token: string, id: number, payload: object) => api.invoke('performance:plans:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('performance:plans:delete', { token, id }),
  },
  rankings: {
    get: (token: string, periodType: string, refDate?: string, basis?: string) => api.invoke('performance:rankings:get', { token, periodType, refDate, basis }),
    snapshot: (token: string, periodType: string, refDate?: string, basis?: string) => api.invoke('performance:rankings:snapshot', { token, periodType, refDate, basis }),
    history: (token: string, periodType?: string) => api.invoke('performance:rankings:history', { token, periodType }),
    getSnapshot: (token: string, id: number) => api.invoke('performance:rankings:getSnapshot', { token, id }),
    deleteSnapshot: (token: string, id: number) => api.invoke('performance:rankings:deleteSnapshot', { token, id }),
    getRoster: (token: string) => api.invoke('performance:ranking:getRoster', { token }),
    setRoster: (token: string, ids: number[]) => api.invoke('performance:ranking:setRoster', { token, ids }),
  },
  dashboard: (token: string) => api.invoke('performance:dashboard', { token }),
  me: {
    overview: (token: string, year?: number) => api.invoke('performance:me:overview', { token, year }),
    evaluation: (token: string, id: number) => api.invoke('performance:me:evaluation', { token, id }),
    sign: (token: string, id: number) => api.invoke('performance:me:sign', { token, id }),
    ranking: (token: string, periodType: string, refDate?: string) => api.invoke('performance:me:ranking', { token, periodType, refDate }),
    objectives: (token: string) => api.invoke('performance:me:objectives', { token }),
  },
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
  // Rendu PDF en mémoire (base64), sans dialogue ni fenêtre — pour réutiliser
  // le PDF comme pièce jointe (ex. convention jointe à un email).
  renderDocumentPdf: (
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
  ) => api.invoke('documents:renderDocumentPdf', { token, ...payload }),
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

// Ordre de virement (bulletins de paie) — modèle éditable + aperçu/export
const wireTransfer = {
  getTemplate: (token: string) => api.invoke('wireTransfer:getTemplate', { token }),
  updateTemplate: (token: string, id: number, payload: object) =>
    api.invoke('wireTransfer:updateTemplate', { token, id, payload }),
  print: (token: string, periodYear: number, periodMonth: number) =>
    api.invoke('wireTransfer:print', { token, periodYear, periodMonth }),
  exportPdf: (token: string, periodYear: number, periodMonth: number) =>
    api.invoke('wireTransfer:exportPdf', { token, periodYear, periodMonth }),
  exportExcel: (token: string, periodYear: number, periodMonth: number) =>
    api.invoke('wireTransfer:exportExcel', { token, periodYear, periodMonth }),
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
  getReferrerTimeline: (token: string, id: number) => api.invoke('commissions:getReferrerTimeline', { token, id }),
  createReferrer: (token: string, payload: object) => api.invoke('commissions:createReferrer', { token, payload }),
  updateReferrer: (token: string, id: number, payload: object) =>
    api.invoke('commissions:updateReferrer', { token, id, payload }),
  deleteReferrer: (token: string, id: number) => api.invoke('commissions:deleteReferrer', { token, id }),
  referrerBeneficialOwners: {
    create: (token: string, referrerId: number, payload: object) =>
      api.invoke('commissions:referrerBeneficialOwners:create', { token, referrerId, payload }),
    update: (token: string, id: number, payload: object) =>
      api.invoke('commissions:referrerBeneficialOwners:update', { token, id, payload }),
    delete: (token: string, id: number) => api.invoke('commissions:referrerBeneficialOwners:delete', { token, id }),
  },
  listUsers: (token: string) => api.invoke('commissions:listUsers', { token }),
  listEligibleConventions: (token: string, filters?: { userId?: number; referrerId?: number }) =>
    api.invoke('commissions:listEligibleConventions', { token, filters }),
  getSettings: (token: string) => api.invoke('commissions:getSettings', { token }),
  updateSettings: (token: string, payload: object) => api.invoke('commissions:updateSettings', { token, payload }),
};

// Charges / dépenses prévisionnelles
const expenses = {
  listCategories: (token: string) => api.invoke('expenses:listCategories', { token }),
  listAccounts: (token: string) => api.invoke('expenses:listAccounts', { token }),
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('expenses:list', { token, filters, page, limit }),
  stats: (token: string) => api.invoke('expenses:stats', { token }),
  getById: (token: string, id: number) => api.invoke('expenses:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('expenses:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('expenses:update', { token, id, payload }),
  settle: (token: string, payload: object) => api.invoke('expenses:settle', { token, payload }),
  fundAccount: (token: string, payload: object) => api.invoke('expenses:fundAccount', { token, payload }),
  cancel: (token: string, id: number) => api.invoke('expenses:cancel', { token, id }),
  remove: (token: string, id: number) => api.invoke('expenses:remove', { token, id }),
};

// Analyses décisionnelles (BI) — admin uniquement
const analytics = {
  executive: (token: string) => api.invoke('analytics:executive', { token }),
  financial: (token: string) => api.invoke('analytics:financial', { token }),
  portfolio: (token: string) => api.invoke('analytics:portfolio', { token }),
  crm: (token: string) => api.invoke('analytics:crm', { token }),
  crmDetail: (token: string, metric: string, extra?: object, page?: number, limit?: number) =>
    api.invoke('analytics:crmDetail', { token, metric, ...extra, page, limit }),
  charges: (token: string) => api.invoke('analytics:charges', { token }),
  contracts: (token: string) => api.invoke('analytics:contracts', { token }),
  risk: (token: string) => api.invoke('analytics:risk', { token }),
  recommendations: (token: string) => api.invoke('analytics:recommendations', { token }),
  followUp: (token: string) => api.invoke('analytics:followUp', { token }),
  visitors: (token: string) => api.invoke('analytics:visitors', { token }),
  calls: (token: string) => api.invoke('analytics:calls', { token }),
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
  getReglementInterieur: (token: string) => api.invoke('settings:getReglementInterieur', { token }),
  setReglementInterieur: (token: string, documentId: number | null) =>
    api.invoke('settings:setReglementInterieur', { token, documentId }),
  uploadLogo: (token: string, payload: object) =>
    api.invoke('settings:uploadLogo', { token, payload }),
  deleteLogo: (token: string) => api.invoke('settings:deleteLogo', { token }),
  getLogoData: (token: string) => api.invoke('settings:getLogoData', { token }),
  /** Logo de connexion lu directement depuis le dossier logo/ (sans session ni accès DB). */
  getLoginLogoData: () => api.invoke('settings:getLoginLogoData', {}),

  getStorage: (token: string) => api.invoke('settings:getStorage', { token }),
  updateStorage: (token: string, payload: object) =>
    api.invoke('settings:updateStorage', { token, payload }),

  getPayrollAccount: (token: string) => api.invoke('settings:getPayrollAccount', { token }),
  updatePayrollAccount: (token: string, payload: { accountId: number | null }) =>
    api.invoke('settings:updatePayrollAccount', { token, payload }),

  getAttendanceQr: (token: string) => api.invoke('settings:getAttendanceQr', { token }),
  updateAttendanceQr: (token: string, payload: object) =>
    api.invoke('settings:updateAttendanceQr', { token, payload }),

  getManualTemplateEditors: (token: string) =>
    api.invoke('settings:getManualTemplateEditors', { token }),
  updateManualTemplateEditors: (token: string, userIds: number[]) =>
    api.invoke('settings:updateManualTemplateEditors', { token, userIds }),

  getKycAuthorizedUsers: (token: string) =>
    api.invoke('settings:getKycAuthorizedUsers', { token }),
  updateKycAuthorizedUsers: (token: string, userIds: number[]) =>
    api.invoke('settings:updateKycAuthorizedUsers', { token, userIds }),
  myKycAccess: (token: string) => api.invoke('settings:myKycAccess', { token }),

  getLatenessSettings: (token: string) => api.invoke('settings:getLatenessSettings', { token }),
  updateLatenessSettings: (token: string, payload: object) =>
    api.invoke('settings:updateLatenessSettings', { token, payload }),

  getVisitorQr: (token: string) => api.invoke('settings:getVisitorQr', { token }),
  updateVisitorQr: (token: string, payload: object) =>
    api.invoke('settings:updateVisitorQr', { token, payload }),

  getAmlRiskThresholds: (token: string) => api.invoke('settings:getAmlRiskThresholds', { token }),
  updateAmlRiskThresholds: (token: string, payload: object) =>
    api.invoke('settings:updateAmlRiskThresholds', { token, payload }),

  getEmail: (token: string) => api.invoke('settings:getEmail', { token }),
  updateEmail: (token: string, payload: object) =>
    api.invoke('settings:updateEmail', { token, payload }),
  testEmail: (token: string, to: string) =>
    api.invoke('settings:testEmail', { token, to }),

  getImap: (token: string) => api.invoke('settings:getImap', { token }),
  updateImap: (token: string, payload: object) =>
    api.invoke('settings:updateImap', { token, payload }),
  testImap: (token: string) => api.invoke('settings:testImap', { token }),

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
  uploadClientDocs: (token: string, clientId: number, category: string, files: object[]) =>
    api.invoke('documents:uploadClientDocs', { token, clientId, category, files }),
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

// Profils de carrière (filières métier par poste) — paramétrage SUPER_ADMIN/ADMIN.
const careerProfiles = {
  list: (token: string) => api.invoke('careerProfiles:list', { token }),
  getById: (token: string, id: number) => api.invoke('careerProfiles:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('careerProfiles:create', { token, payload }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('careerProfiles:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('careerProfiles:delete', { token, id }),
  duplicate: (token: string, id: number) => api.invoke('careerProfiles:duplicate', { token, id }),
};

contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, conventions, conventionTemplates, attestationTemplates, attestations, quotes, quoteTemplates, catalog, accounting, bilan, communication, crm, archiving, documents, documentExport, lotissements, terrains, programmes, projects, hr, careerProfiles, performance, visitors, calls, socialMedia, innovations, constructionLibrary, construction, permitLibrary, permits, aml, geo, countries, commissions, expenses, analytics, exporter, invoiceTemplates, listExportTemplates, wireTransfer, treasury, budget, dashboard, settings, reminders, mailAccount, config });
