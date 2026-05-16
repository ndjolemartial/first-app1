import { contextBridge, ipcRenderer } from 'electron';

type IpcArgs = Record<string, unknown>;

const api = {
  invoke: (channel: string, args?: IpcArgs) => ipcRenderer.invoke(channel, args ?? {}),
};

// Auth
const auth = {
  login: (email: string, password: string) => api.invoke('auth:login', { email, password }),
  logout: (token: string) => api.invoke('auth:logout', { token }),
  me: (token: string) => api.invoke('auth:me', { token }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    api.invoke('auth:changePassword', { token, currentPassword, newPassword }),
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

// Contracts
const contracts = {
  list: (token: string, filters?: object, page?: number, limit?: number) =>
    api.invoke('contracts:list', { token, filters, page, limit }),
  getById: (token: string, id: number) => api.invoke('contracts:getById', { token, id }),
  create: (token: string, payload: object) => api.invoke('contracts:create', { token, payload }),
  update: (token: string, id: number, payload: object) => api.invoke('contracts:update', { token, id, payload }),
  delete: (token: string, id: number) => api.invoke('contracts:delete', { token, id }),
  generateInstallments: (token: string, id: number) =>
    api.invoke('contracts:generateInstallments', { token, id }),
  getInstallments: (token: string, contractId: number) =>
    api.invoke('contracts:getInstallments', { token, contractId }),
};

// Accounting
const accounting = {
  getDashboard: (token: string) => api.invoke('accounting:getDashboard', { token }),
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
  payInstallment: (token: string, installmentId: number, payload: object) =>
    api.invoke('accounting:payInstallment', { token, installmentId, payload }),
  getSaleContracts: (token: string) => api.invoke('accounting:getSaleContracts', { token }),
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

// Géolocalisation
const geo = {
  resolveMapLink: (token: string, link: string) => api.invoke('geo:resolveMapLink', { token, link }),
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
  listEligibleContracts: (token: string) => api.invoke('commissions:listEligibleContracts', { token }),
  getSettings: (token: string) => api.invoke('commissions:getSettings', { token }),
  updateSettings: (token: string, payload: object) => api.invoke('commissions:updateSettings', { token, payload }),
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
};

contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, contracts, accounting, communication, crm, archiving, documents, lotissements, terrains, geo, commissions });
