"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    invoke: (channel, args) => electron_1.ipcRenderer.invoke(channel, args ?? {}),
};
// Auth
const auth = {
    login: (identifier, password) => api.invoke('auth:login', { identifier, password }),
    logout: (token) => api.invoke('auth:logout', { token }),
    me: (token) => api.invoke('auth:me', { token }),
    changePassword: (token, currentPassword, newPassword) => api.invoke('auth:changePassword', { token, currentPassword, newPassword }),
    updateProfile: (token, payload) => api.invoke('auth:updateProfile', { token, payload }),
    updateTheme: (token, theme) => api.invoke('auth:updateTheme', { token, theme }),
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
    assign: (token, id, assignedToId) => api.invoke('prospects:assign', { token, id, assignedToId }),
    listAssignableUsers: (token) => api.invoke('prospects:listAssignableUsers', { token }),
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
    assign: (token, id, assignedToId) => api.invoke('clients:assign', { token, id, assignedToId }),
    setReferrer: (token, id, referrerId) => api.invoke('clients:setReferrer', { token, id, referrerId }),
    listAssignableUsers: (token) => api.invoke('clients:listAssignableUsers', { token }),
    listReferrers: (token) => api.invoke('clients:listReferrers', { token }),
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
    statusStats: (token, filters) => api.invoke('properties:statusStats', { token, filters }),
};
// Conventions
const conventions = {
    list: (token, filters, page, limit) => api.invoke('conventions:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('conventions:getById', { token, id }),
    create: (token, payload) => api.invoke('conventions:create', { token, payload }),
    update: (token, id, payload) => api.invoke('conventions:update', { token, id, payload }),
    delete: (token, id) => api.invoke('conventions:delete', { token, id }),
    generateInstallments: (token, id) => api.invoke('conventions:generateInstallments', { token, id }),
    getInstallments: (token, conventionId) => api.invoke('conventions:getInstallments', { token, conventionId }),
    updateInstallments: (token, conventionId, installments) => api.invoke('conventions:updateInstallments', { token, conventionId, installments }),
    statusStats: (token, filters) => api.invoke('conventions:statusStats', { token, filters }),
};
// Modèles de convention
const conventionTemplates = {
    list: (token, filters, page, limit) => api.invoke('conventionTemplates:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('conventionTemplates:getById', { token, id }),
    create: (token, payload) => api.invoke('conventionTemplates:create', { token, payload }),
    update: (token, id, payload) => api.invoke('conventionTemplates:update', { token, id, payload }),
    delete: (token, id) => api.invoke('conventionTemplates:delete', { token, id }),
};
// Modèles d'attestation
const attestationTemplates = {
    list: (token, filters, page, limit) => api.invoke('attestationTemplates:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('attestationTemplates:getById', { token, id }),
    create: (token, payload) => api.invoke('attestationTemplates:create', { token, payload }),
    update: (token, id, payload) => api.invoke('attestationTemplates:update', { token, id, payload }),
    delete: (token, id) => api.invoke('attestationTemplates:delete', { token, id }),
};
// Attestations émises
const attestations = {
    list: (token, filters, page, limit) => api.invoke('attestations:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('attestations:getById', { token, id }),
    create: (token, payload) => api.invoke('attestations:create', { token, payload }),
    update: (token, id, payload) => api.invoke('attestations:update', { token, id, payload }),
    delete: (token, id) => api.invoke('attestations:delete', { token, id }),
    typeStats: (token, filters) => api.invoke('attestations:typeStats', { token, filters }),
};
// Accounting
const accounting = {
    getDashboard: (token) => api.invoke('accounting:getDashboard', { token }),
    getRevenue: (token, period) => api.invoke('accounting:getRevenue', { token, period }),
    getInvoices: (token, filters, page, limit) => api.invoke('accounting:getInvoices', { token, filters, page, limit }),
    getInvoiceTypeStats: (token, filters) => api.invoke('accounting:getInvoiceTypeStats', { token, filters }),
    getInvoiceById: (token, id) => api.invoke('accounting:getInvoiceById', { token, id }),
    createInvoice: (token, payload) => api.invoke('accounting:createInvoice', { token, payload }),
    updateInvoiceStatus: (token, id, status) => api.invoke('accounting:updateInvoiceStatus', { token, id, status }),
    reinstateInvoice: (token, id) => api.invoke('accounting:reinstateInvoice', { token, id }),
    addPayment: (token, invoiceId, payload) => api.invoke('accounting:addPayment', { token, invoiceId, payload }),
    getOverdueInstallments: (token) => api.invoke('accounting:getOverdueInstallments', { token }),
    getUnpaidInstallments: (token) => api.invoke('accounting:getUnpaidInstallments', { token }),
    getUpcomingInstallments: (token, days) => api.invoke('accounting:getUpcomingInstallments', { token, days }),
    getPaidInstallments: (token, year, semester) => api.invoke('accounting:getPaidInstallments', { token, year, semester }),
    getCancelledInstallments: (token) => api.invoke('accounting:getCancelledInstallments', { token }),
    listInstallments: (token) => api.invoke('accounting:listInstallments', { token }),
    payInstallment: (token, installmentId, payload) => api.invoke('accounting:payInstallment', { token, installmentId, payload }),
    printInvoice: (token, invoiceId) => api.invoke('accounting:printInvoice', { token, invoiceId }),
    cancelInstallment: (token, installmentId) => api.invoke('accounting:cancelInstallment', { token, installmentId }),
    reinstateInstallment: (token, installmentId) => api.invoke('accounting:reinstateInstallment', { token, installmentId }),
    getSaleConventions: (token) => api.invoke('accounting:getSaleConventions', { token }),
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
    statusStats: (token, filters) => api.invoke('lotissements:statusStats', { token, filters }),
};
// Terrains
const terrains = {
    list: (token, filters, page, limit) => api.invoke('terrains:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('terrains:getById', { token, id }),
    create: (token, payload) => api.invoke('terrains:create', { token, payload }),
    update: (token, id, payload) => api.invoke('terrains:update', { token, id, payload }),
    updateStatut: (token, id, statut) => api.invoke('terrains:updateStatut', { token, id, statut }),
    delete: (token, id) => api.invoke('terrains:delete', { token, id }),
    statusStats: (token, filters) => api.invoke('terrains:statusStats', { token, filters }),
    generateAcdInvoices: (token, id) => api.invoke('terrains:generateAcdInvoices', { token, id }),
    cancelAcdInvoices: (token, id) => api.invoke('terrains:cancelAcdInvoices', { token, id }),
    updateAcdInvoices: (token, terrainId, invoices) => api.invoke('terrains:updateAcdInvoices', { token, terrainId, invoices }),
};
// Programmes immobiliers
const programmes = {
    list: (token, filters, page, limit) => api.invoke('programmes:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('programmes:getById', { token, id }),
    create: (token, payload) => api.invoke('programmes:create', { token, payload }),
    update: (token, id, payload) => api.invoke('programmes:update', { token, id, payload }),
    delete: (token, id) => api.invoke('programmes:delete', { token, id }),
    statusStats: (token, filters) => api.invoke('programmes:statusStats', { token, filters }),
};
// Projets
const projects = {
    list: (token, filters, page, limit) => api.invoke('projects:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('projects:getById', { token, id }),
    create: (token, payload) => api.invoke('projects:create', { token, payload }),
    update: (token, id, payload) => api.invoke('projects:update', { token, id, payload }),
    delete: (token, id) => api.invoke('projects:delete', { token, id }),
    statusStats: (token, filters) => api.invoke('projects:statusStats', { token, filters }),
    // Catalogue des types de projets
    listTypes: (token, includeInactive = false) => api.invoke('projects:listTypes', { token, includeInactive }),
    createType: (token, payload) => api.invoke('projects:createType', { token, payload }),
    updateType: (token, id, payload) => api.invoke('projects:updateType', { token, id, payload }),
    deleteType: (token, id) => api.invoke('projects:deleteType', { token, id }),
};
// Géolocalisation
const geo = {
    resolveMapLink: (token, link) => api.invoke('geo:resolveMapLink', { token, link }),
};
// Pays (table de référence)
const countries = {
    list: (token) => api.invoke('countries:list', { token }),
};
// Export de listes (PDF / Excel)
const exporter = {
    generate: (token, payload) => api.invoke('export:generate', { token, ...payload }),
};
// Export PDF de document (convention / attestation) avec en-tête + pied de page
// rendus sur chaque page via le moteur natif Chromium.
const documentExport = {
    exportDocumentPdf: (token, payload) => api.invoke('documents:exportDocumentPdf', { token, ...payload }),
    exportDocumentDocx: (token, payload) => api.invoke('documents:exportDocumentDocx', { token, ...payload }),
};
// Modèles de facture
const invoiceTemplates = {
    list: (token) => api.invoke('invoiceTemplates:list', { token }),
    update: (token, id, payload) => api.invoke('invoiceTemplates:update', { token, id, payload }),
    setDefaults: (token, defaults) => api.invoke('invoiceTemplates:setDefaults', { token, defaults }),
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
    listEligibleConventions: (token) => api.invoke('commissions:listEligibleConventions', { token }),
    getSettings: (token) => api.invoke('commissions:getSettings', { token }),
    updateSettings: (token, payload) => api.invoke('commissions:updateSettings', { token, payload }),
};
// Budgets
const budget = {
    getDashboard: (token) => api.invoke('budget:getDashboard', { token }),
    list: (token, filters) => api.invoke('budget:list', { token, filters }),
    getById: (token, id) => api.invoke('budget:getById', { token, id }),
    create: (token, payload) => api.invoke('budget:create', { token, payload }),
    update: (token, id, payload) => api.invoke('budget:update', { token, id, payload }),
    close: (token, id) => api.invoke('budget:close', { token, id }),
    reopen: (token, id) => api.invoke('budget:reopen', { token, id }),
    delete: (token, id) => api.invoke('budget:delete', { token, id }),
    listLines: (token, filters) => api.invoke('budget:listLines', { token, filters }),
    getLineById: (token, id) => api.invoke('budget:getLineById', { token, id }),
    createLine: (token, payload) => api.invoke('budget:createLine', { token, payload }),
    updateLine: (token, id, payload) => api.invoke('budget:updateLine', { token, id, payload }),
    toggleLineActive: (token, id) => api.invoke('budget:toggleLineActive', { token, id }),
    deleteLine: (token, id) => api.invoke('budget:deleteLine', { token, id }),
    listEligibleManagers: (token) => api.invoke('budget:listEligibleManagers', { token }),
    listAccessibleLines: (token) => api.invoke('budget:listAccessibleLines', { token }),
};
// Trésorerie
const treasury = {
    getDashboard: (token) => api.invoke('treasury:getDashboard', { token }),
    listAccounts: (token, filters) => api.invoke('treasury:listAccounts', { token, filters }),
    getAccountById: (token, id) => api.invoke('treasury:getAccountById', { token, id }),
    createAccount: (token, payload) => api.invoke('treasury:createAccount', { token, payload }),
    updateAccount: (token, id, payload) => api.invoke('treasury:updateAccount', { token, id, payload }),
    deleteAccount: (token, id) => api.invoke('treasury:deleteAccount', { token, id }),
    listOperations: (token, filters, page, limit) => api.invoke('treasury:listOperations', { token, filters, page, limit }),
    createOperation: (token, payload) => api.invoke('treasury:createOperation', { token, payload }),
    updateOperation: (token, id, payload) => api.invoke('treasury:updateOperation', { token, id, payload }),
    deleteOperation: (token, id) => api.invoke('treasury:deleteOperation', { token, id }),
    getEntityCashflow: (token, entityType, entityId, limit) => api.invoke('treasury:getEntityCashflow', { token, entityType, entityId, limit }),
    listCategories: (token, filters) => api.invoke('treasury:listCategories', { token, filters }),
    createCategory: (token, payload) => api.invoke('treasury:createCategory', { token, payload }),
    updateCategory: (token, id, payload) => api.invoke('treasury:updateCategory', { token, id, payload }),
    deleteCategory: (token, id) => api.invoke('treasury:deleteCategory', { token, id }),
    listUsers: (token) => api.invoke('treasury:listUsers', { token }),
};
// Dashboard
const dashboard = {
    getStats: (token) => api.invoke('dashboard:getStats', { token }),
};
// Paramètres applicatifs (réservés aux administrateurs)
const settings = {
    getCompany: (token) => api.invoke('settings:getCompany', { token }),
    updateCompany: (token, payload) => api.invoke('settings:updateCompany', { token, payload }),
    uploadLogo: (token, payload) => api.invoke('settings:uploadLogo', { token, payload }),
    deleteLogo: (token) => api.invoke('settings:deleteLogo', { token }),
    getLogoData: (token) => api.invoke('settings:getLogoData', { token }),
    getStorage: (token) => api.invoke('settings:getStorage', { token }),
    updateStorage: (token, payload) => api.invoke('settings:updateStorage', { token, payload }),
    getEmail: (token) => api.invoke('settings:getEmail', { token }),
    updateEmail: (token, payload) => api.invoke('settings:updateEmail', { token, payload }),
    testEmail: (token, to) => api.invoke('settings:testEmail', { token, to }),
    getSms: (token) => api.invoke('settings:getSms', { token }),
    updateSms: (token, payload) => api.invoke('settings:updateSms', { token, payload }),
    testSms: (token, to) => api.invoke('settings:testSms', { token, to }),
    getSlideshow: (token) => api.invoke('settings:getSlideshow', { token }),
    updateSlideshow: (token, items) => api.invoke('settings:updateSlideshow', { token, items }),
    uploadSlideshowMedia: (token, payload) => api.invoke('settings:uploadSlideshowMedia', { token, payload }),
    getSlideshowMediaData: (token, relativePath) => api.invoke('settings:getSlideshowMediaData', { token, relativePath }),
    getSlideshowVisibility: (token) => api.invoke('settings:getSlideshowVisibility', { token }),
    updateSlideshowVisibility: (token, payload) => api.invoke('settings:updateSlideshowVisibility', { token, payload }),
    // Types de pièces d'identité (catalogue extensible)
    listIdTypes: (token, includeInactive = false) => api.invoke('settings:listIdTypes', { token, includeInactive }),
    createIdType: (token, payload) => api.invoke('settings:createIdType', { token, payload }),
    updateIdType: (token, id, payload) => api.invoke('settings:updateIdType', { token, id, payload }),
    deleteIdType: (token, id) => api.invoke('settings:deleteIdType', { token, id }),
    // Natures de titres de lotissement
    listTitleTypes: (token, includeInactive = false) => api.invoke('settings:listTitleTypes', { token, includeInactive }),
    createTitleType: (token, payload) => api.invoke('settings:createTitleType', { token, payload }),
    updateTitleType: (token, id, payload) => api.invoke('settings:updateTitleType', { token, id, payload }),
    deleteTitleType: (token, id) => api.invoke('settings:deleteTitleType', { token, id }),
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
    // GED — Gestion électronique de documents
    list: (token, filters, page, limit) => api.invoke('documents:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('documents:getById', { token, id }),
    import: (token, payload) => api.invoke('documents:import', { token, payload }),
    update: (token, id, payload) => api.invoke('documents:update', { token, id, payload }),
    remove: (token, id) => api.invoke('documents:remove', { token, id }),
    open: (token, id) => api.invoke('documents:open', { token, id }),
    getFileData: (token, id) => api.invoke('documents:getFileData', { token, id }),
    listCategories: (token) => api.invoke('documents:listCategories', { token }),
    createCategory: (token, payload) => api.invoke('documents:createCategory', { token, payload }),
    updateCategory: (token, id, payload) => api.invoke('documents:updateCategory', { token, id, payload }),
    deleteCategory: (token, id) => api.invoke('documents:deleteCategory', { token, id }),
    listFolders: (token) => api.invoke('documents:listFolders', { token }),
    createFolder: (token, payload) => api.invoke('documents:createFolder', { token, payload }),
    updateFolder: (token, id, payload) => api.invoke('documents:updateFolder', { token, id, payload }),
    deleteFolder: (token, id) => api.invoke('documents:deleteFolder', { token, id }),
    listTags: (token) => api.invoke('documents:listTags', { token }),
    createTag: (token, payload) => api.invoke('documents:createTag', { token, payload }),
    updateTag: (token, id, payload) => api.invoke('documents:updateTag', { token, id, payload }),
    deleteTag: (token, id) => api.invoke('documents:deleteTag', { token, id }),
    listAudit: (token, limit) => api.invoke('documents:listAudit', { token, limit }),
    gedDashboard: (token) => api.invoke('documents:gedDashboard', { token }),
    /** Résout le chemin disque d'un fichier sélectionné/déposé (Electron webUtils). */
    pathForFile: (file) => electron_1.webUtils.getPathForFile(file),
};
electron_1.contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, conventions, conventionTemplates, attestationTemplates, attestations, accounting, communication, crm, archiving, documents, documentExport, lotissements, terrains, programmes, projects, geo, countries, commissions, exporter, invoiceTemplates, treasury, budget, dashboard, settings });
