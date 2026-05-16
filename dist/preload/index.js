"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    invoke: (channel, args) => electron_1.ipcRenderer.invoke(channel, args ?? {}),
};
// Auth
const auth = {
    login: (email, password) => api.invoke('auth:login', { email, password }),
    logout: (token) => api.invoke('auth:logout', { token }),
    me: (token) => api.invoke('auth:me', { token }),
    changePassword: (token, currentPassword, newPassword) => api.invoke('auth:changePassword', { token, currentPassword, newPassword }),
};
// Users
const users = {
    list: (token, filters, page, limit) => api.invoke('users:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('users:getById', { token, id }),
    create: (token, payload) => api.invoke('users:create', { token, payload }),
    update: (token, id, payload) => api.invoke('users:update', { token, id, payload }),
    resetPassword: (token, id, newPassword) => api.invoke('users:resetPassword', { token, id, newPassword }),
    toggleActive: (token, id) => api.invoke('users:toggleActive', { token, id }),
};
// Prospects
const prospects = {
    list: (token, filters, page, limit) => api.invoke('prospects:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('prospects:getById', { token, id }),
    create: (token, payload) => api.invoke('prospects:create', { token, payload }),
    update: (token, id, payload) => api.invoke('prospects:update', { token, id, payload }),
    delete: (token, id) => api.invoke('prospects:delete', { token, id }),
    updateStatus: (token, id, status) => api.invoke('prospects:updateStatus', { token, id, status }),
    convertToClient: (token, id, clientData) => api.invoke('prospects:convertToClient', { token, id, clientData }),
    kanban: (token) => api.invoke('prospects:kanban', { token }),
};
// Clients
const clients = {
    list: (token, filters, page, limit) => api.invoke('clients:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('clients:getById', { token, id }),
    create: (token, payload) => api.invoke('clients:create', { token, payload }),
    update: (token, id, payload) => api.invoke('clients:update', { token, id, payload }),
    delete: (token, id) => api.invoke('clients:delete', { token, id }),
    toggleActive: (token, id) => api.invoke('clients:toggleActive', { token, id }),
    updateStatus: (token, id, status) => api.invoke('clients:updateStatus', { token, id, status }),
};
// Owners
const owners = {
    list: (token, filters, page, limit) => api.invoke('owners:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('owners:getById', { token, id }),
    create: (token, payload) => api.invoke('owners:create', { token, payload }),
    update: (token, id, payload) => api.invoke('owners:update', { token, id, payload }),
    delete: (token, id) => api.invoke('owners:delete', { token, id }),
    portfolio: (token, id) => api.invoke('owners:portfolio', { token, id }),
};
// Properties
const properties = {
    list: (token, filters, page, limit) => api.invoke('properties:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('properties:getById', { token, id }),
    create: (token, payload) => api.invoke('properties:create', { token, payload }),
    update: (token, id, payload) => api.invoke('properties:update', { token, id, payload }),
    delete: (token, id) => api.invoke('properties:delete', { token, id }),
    updateStatus: (token, id, status) => api.invoke('properties:updateStatus', { token, id, status }),
};
// Contracts
const contracts = {
    list: (token, filters, page, limit) => api.invoke('contracts:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('contracts:getById', { token, id }),
    create: (token, payload) => api.invoke('contracts:create', { token, payload }),
    update: (token, id, payload) => api.invoke('contracts:update', { token, id, payload }),
    delete: (token, id) => api.invoke('contracts:delete', { token, id }),
    generateInstallments: (token, id) => api.invoke('contracts:generateInstallments', { token, id }),
    getInstallments: (token, contractId) => api.invoke('contracts:getInstallments', { token, contractId }),
};
// Accounting
const accounting = {
    getDashboard: (token) => api.invoke('accounting:getDashboard', { token }),
    getInvoices: (token, filters, page, limit) => api.invoke('accounting:getInvoices', { token, filters, page, limit }),
    getInvoiceById: (token, id) => api.invoke('accounting:getInvoiceById', { token, id }),
    createInvoice: (token, payload) => api.invoke('accounting:createInvoice', { token, payload }),
    updateInvoiceStatus: (token, id, status) => api.invoke('accounting:updateInvoiceStatus', { token, id, status }),
    addPayment: (token, invoiceId, payload) => api.invoke('accounting:addPayment', { token, invoiceId, payload }),
    getOverdueInstallments: (token) => api.invoke('accounting:getOverdueInstallments', { token }),
    getUpcomingInstallments: (token, days) => api.invoke('accounting:getUpcomingInstallments', { token, days }),
    payInstallment: (token, installmentId, payload) => api.invoke('accounting:payInstallment', { token, installmentId, payload }),
    getSaleContracts: (token) => api.invoke('accounting:getSaleContracts', { token }),
};
// Communication
const communication = {
    listTemplates: (token, channel) => api.invoke('communication:listTemplates', { token, channel }),
    getTemplate: (token, id) => api.invoke('communication:getTemplate', { token, id }),
    createTemplate: (token, payload) => api.invoke('communication:createTemplate', { token, payload }),
    updateTemplate: (token, id, payload) => api.invoke('communication:updateTemplate', { token, id, payload }),
    deleteTemplate: (token, id) => api.invoke('communication:deleteTemplate', { token, id }),
    getHistory: (token, filters, page, limit) => api.invoke('communication:getHistory', { token, filters, page, limit }),
    sendEmail: (token, payload) => api.invoke('communication:sendEmail', { token, payload }),
    sendSms: (token, payload) => api.invoke('communication:sendSms', { token, payload }),
};
// CRM
const crm = {
    listActivities: (token, filters, page, limit) => api.invoke('crm:listActivities', { token, filters, page, limit }),
    getActivity: (token, id) => api.invoke('crm:getActivity', { token, id }),
    createActivity: (token, payload) => api.invoke('crm:createActivity', { token, payload }),
    updateActivity: (token, id, payload) => api.invoke('crm:updateActivity', { token, id, payload }),
    deleteActivity: (token, id) => api.invoke('crm:deleteActivity', { token, id }),
    completeActivity: (token, id) => api.invoke('crm:completeActivity', { token, id }),
    getStats: (token) => api.invoke('crm:getStats', { token }),
};
// Archiving
const archiving = {
    list: (token, filters, page, limit) => api.invoke('archiving:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('archiving:getById', { token, id }),
    archive: (token, payload) => api.invoke('archiving:archive', { token, payload }),
    restore: (token, id) => api.invoke('archiving:restore', { token, id }),
    permanentDelete: (token, id) => api.invoke('archiving:permanentDelete', { token, id }),
    getStats: (token) => api.invoke('archiving:getStats', { token }),
    listPolicies: (token) => api.invoke('archiving:listPolicies', { token }),
    createPolicy: (token, payload) => api.invoke('archiving:createPolicy', { token, payload }),
    updatePolicy: (token, id, payload) => api.invoke('archiving:updatePolicy', { token, id, payload }),
    deletePolicy: (token, id) => api.invoke('archiving:deletePolicy', { token, id }),
};
// Lotissements
const lotissements = {
    list: (token, filters, page, limit) => api.invoke('lotissements:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('lotissements:getById', { token, id }),
    create: (token, payload) => api.invoke('lotissements:create', { token, payload }),
    update: (token, id, payload) => api.invoke('lotissements:update', { token, id, payload }),
    delete: (token, id) => api.invoke('lotissements:delete', { token, id }),
};
// Terrains
const terrains = {
    list: (token, filters, page, limit) => api.invoke('terrains:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('terrains:getById', { token, id }),
    create: (token, payload) => api.invoke('terrains:create', { token, payload }),
    update: (token, id, payload) => api.invoke('terrains:update', { token, id, payload }),
    updateStatut: (token, id, statut) => api.invoke('terrains:updateStatut', { token, id, statut }),
    delete: (token, id) => api.invoke('terrains:delete', { token, id }),
};
// Géolocalisation
const geo = {
    resolveMapLink: (token, link) => api.invoke('geo:resolveMapLink', { token, link }),
};
// Commissions
const commissions = {
    getDashboard: (token) => api.invoke('commissions:getDashboard', { token }),
    list: (token, filters, page, limit) => api.invoke('commissions:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('commissions:getById', { token, id }),
    create: (token, payload) => api.invoke('commissions:create', { token, payload }),
    pay: (token, payload) => api.invoke('commissions:pay', { token, payload }),
    cancel: (token, payload) => api.invoke('commissions:cancel', { token, payload }),
    getBeneficiarySummary: (token, beneficiaryType, beneficiaryId) => api.invoke('commissions:getBeneficiarySummary', { token, beneficiaryType, beneficiaryId }),
    listReferrers: (token, filters, page, limit) => api.invoke('commissions:listReferrers', { token, filters, page, limit }),
    getReferrerById: (token, id) => api.invoke('commissions:getReferrerById', { token, id }),
    createReferrer: (token, payload) => api.invoke('commissions:createReferrer', { token, payload }),
    updateReferrer: (token, id, payload) => api.invoke('commissions:updateReferrer', { token, id, payload }),
    deleteReferrer: (token, id) => api.invoke('commissions:deleteReferrer', { token, id }),
    listUsers: (token) => api.invoke('commissions:listUsers', { token }),
    listEligibleContracts: (token) => api.invoke('commissions:listEligibleContracts', { token }),
    getSettings: (token) => api.invoke('commissions:getSettings', { token }),
    updateSettings: (token, payload) => api.invoke('commissions:updateSettings', { token, payload }),
};
// Documents
const documents = {
    uploadIdDocument: (token, clientId, payload) => api.invoke('documents:uploadIdDocument', { token, clientId, ...payload }),
    getByClient: (token, clientId) => api.invoke('documents:getByClient', { token, clientId }),
    uploadOwnerDoc: (token, ownerId, category, payload) => api.invoke('documents:uploadOwnerDoc', { token, ownerId, category, ...payload }),
    getByOwner: (token, ownerId) => api.invoke('documents:getByOwner', { token, ownerId }),
    uploadTerrainDoc: (token, terrainId, category, payload) => api.invoke('documents:uploadTerrainDoc', { token, terrainId, category, ...payload }),
    getByTerrain: (token, terrainId) => api.invoke('documents:getByTerrain', { token, terrainId }),
    openFile: (token, relativePath) => api.invoke('documents:openFile', { token, relativePath }),
};
electron_1.contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, contracts, accounting, communication, crm, archiving, documents, lotissements, terrains, geo, commissions });
