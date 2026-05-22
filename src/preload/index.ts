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

// Accounting
const accounting = {
  getDashboard: (token: string) => api.invoke('accounting:getDashboard', { token }),
  getRevenue: (token: string, period: string) => api.invoke('accounting:getRevenue', { token, period }),
  getInvoices: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('accounting:getInvoices', { token, filters, page, limit }),
  getInvoiceById: (token: string, id: number) => api.invoke('accounting:getInvoiceById', { token, id }),
  createInvoice: (token: string, payload: object) => api.invoke('accounting:createInvoice', { token, payload }),
  updateInvoiceStatus: (token: string, id: number, status: string) =>
    api.invoke('accounting:updateInvoiceStatus', { token, id, status }),
  addPayment: (token: string, invoiceId: number, payload: object) =>
    api.invoke('accounting:addPayment', { token, invoiceId, payload }),
  getOverdueInstallments: (token: string) => api.invoke('accounting:getOverdueInstallments', { token }),
  getUpcomingInstallments: (token: string, days?: number) =>
    api.invoke('accounting:getUpcomingInstallments', { token, days }),
  getPaidInstallments: (token: string, year?: number, semester?: number) =>
    api.invoke('accounting:getPaidInstallments', { token, year, semester }),
  getCancelledInstallments: (token: string) =>
    api.invoke('accounting:getCancelledInstallments', { token }),
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
  getStats: (token: string) =>
    api.invoke('crm:getStats', { token }),
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
};

// Programmes immobiliers
const programmes = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('programmes:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('programmes:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('programmes:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('programmes:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('programmes:delete', { token, id }),
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
};

// Modèles de facture
const invoiceTemplates = {
  list: (token: string) => api.invoke('invoiceTemplates:list', { token }),
  update: (token: string, id: number, payload: object) =>
    api.invoke('invoiceTemplates:update', { token, id, payload }),
  setDefaults: (token: string, defaults: object) =>
    api.invoke('invoiceTemplates:setDefaults', { token, defaults }),
};

// Commissions
const commissions = {
  getDashboard: (token: string) => api.invoke('commissions:getDashboard', { token }),
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('commissions:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('commissions:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('commissions:create', { token, payload }),
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
  listEligibleConventions: (token: string) => api.invoke('commissions:listEligibleConventions', { token }),
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
  listOperations: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('treasury:listOperations', { token, filters, page, limit }),
  createOperation: (token: string, payload: object) => api.invoke('treasury:createOperation', { token, payload }),
  updateOperation: (token: string, id: number, payload: object) =>
    api.invoke('treasury:updateOperation', { token, id, payload }),
  deleteOperation: (token: string, id: number) => api.invoke('treasury:deleteOperation', { token, id }),
  listCategories: (token: string, filters?: object) =>
    api.invoke('treasury:listCategories', { token, filters }),
  createCategory: (token: string, payload: object) => api.invoke('treasury:createCategory', { token, payload }),
  updateCategory: (token: string, id: number, payload: object) =>
    api.invoke('treasury:updateCategory', { token, id, payload }),
  deleteCategory: (token: string, id: number) => api.invoke('treasury:deleteCategory', { token, id }),
  listUsers: (token: string) => api.invoke('treasury:listUsers', { token }),
};

// Dashboard
const dashboard = {
  getStats: (token: string) => api.invoke('dashboard:getStats', { token }),
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

  getSlideshow: (token: string) => api.invoke('settings:getSlideshow', { token }),
  updateSlideshow: (token: string, items: object[]) =>
    api.invoke('settings:updateSlideshow', { token, items }),
  uploadSlideshowMedia: (token: string, payload: object) =>
    api.invoke('settings:uploadSlideshowMedia', { token, payload }),
  getSlideshowMediaData: (token: string, relativePath: string) =>
    api.invoke('settings:getSlideshowMediaData', { token, relativePath }),
};

// Documents
const documents = {
  uploadIdDocument: (token: string, clientId: number, payload: object) =>
    api.invoke('documents:uploadIdDocument', { token, clientId, ...payload }),
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

contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, conventions, conventionTemplates, accounting, communication, crm, archiving, documents, lotissements, terrains, programmes, geo, countries, commissions, exporter, invoiceTemplates, treasury, budget, dashboard, settings });
