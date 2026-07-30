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
    listSelectable: (token, options) => api.invoke('users:listSelectable', { token, options }),
    getById: (token, id) => api.invoke('users:getById', { token, id }),
    create: (token, payload) => api.invoke('users:create', { token, payload }),
    update: (token, id, payload) => api.invoke('users:update', { token, id, payload }),
    resetPassword: (token, id, newPassword) => api.invoke('users:resetPassword', { token, id, newPassword }),
    toggleActive: (token, id) => api.invoke('users:toggleActive', { token, id }),
    delete: (token, id) => api.invoke('users:delete', { token, id }),
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
    getTimeline: (token, id) => api.invoke('prospects:getTimeline', { token, id }),
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
    getTimeline: (token, id) => api.invoke('clients:getTimeline', { token, id }),
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
    getLegacyBalance: (token, clientId, terrainIds) => api.invoke('attestations:getLegacyBalance', { token, clientId, terrainIds }),
};
// Devis
const quotes = {
    list: (token, filters, page, limit) => api.invoke('quotes:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('quotes:getById', { token, id }),
    stats: (token) => api.invoke('quotes:stats', { token }),
    create: (token, payload) => api.invoke('quotes:create', { token, payload }),
    update: (token, id, payload) => api.invoke('quotes:update', { token, id, payload }),
    send: (token, id) => api.invoke('quotes:send', { token, id }),
    accept: (token, id) => api.invoke('quotes:accept', { token, id }),
    refuse: (token, id, reason) => api.invoke('quotes:refuse', { token, id, reason }),
    cancel: (token, id) => api.invoke('quotes:cancel', { token, id }),
    delete: (token, id) => api.invoke('quotes:delete', { token, id }),
    convert: (token, id, options) => api.invoke('quotes:convert', { token, id, options }),
    listUnits: (token, includeInactive) => api.invoke('quotes:listUnits', { token, includeInactive }),
};
const quoteTemplates = {
    list: (token, filters, page, limit) => api.invoke('quoteTemplates:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('quoteTemplates:getById', { token, id }),
    create: (token, payload) => api.invoke('quoteTemplates:create', { token, payload }),
    update: (token, id, payload) => api.invoke('quoteTemplates:update', { token, id, payload }),
    delete: (token, id) => api.invoke('quoteTemplates:delete', { token, id }),
};
// Catalogue prestations / produits
const catalog = {
    list: (token, filters) => api.invoke('catalog:list', { token, filters }),
    getById: (token, id) => api.invoke('catalog:getById', { token, id }),
    create: (token, payload) => api.invoke('catalog:create', { token, payload }),
    update: (token, id, payload) => api.invoke('catalog:update', { token, id, payload }),
    delete: (token, id) => api.invoke('catalog:delete', { token, id }),
    listUnits: (token, includeInactive) => api.invoke('catalog:listUnits', { token, includeInactive }),
    createUnit: (token, payload) => api.invoke('catalog:createUnit', { token, payload }),
    updateUnit: (token, id, payload) => api.invoke('catalog:updateUnit', { token, id, payload }),
    deleteUnit: (token, id) => api.invoke('catalog:deleteUnit', { token, id }),
    listCategories: (token, includeInactive) => api.invoke('catalog:listCategories', { token, includeInactive }),
    createCategory: (token, payload) => api.invoke('catalog:createCategory', { token, payload }),
    updateCategory: (token, id, payload) => api.invoke('catalog:updateCategory', { token, id, payload }),
    deleteCategory: (token, id) => api.invoke('catalog:deleteCategory', { token, id }),
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
    getLegacyInstallments: (token) => api.invoke('accounting:getLegacyInstallments', { token }),
    updateLegacyInstallment: (token, payload) => api.invoke('accounting:updateLegacyInstallment', { token, payload }),
    listInstallments: (token, crmReferentScope = false) => api.invoke('accounting:listInstallments', { token, crmReferentScope }),
    payInstallment: (token, installmentId, payload) => api.invoke('accounting:payInstallment', { token, installmentId, payload }),
    printInvoice: (token, invoiceId) => api.invoke('accounting:printInvoice', { token, invoiceId }),
    cancelInstallment: (token, installmentId) => api.invoke('accounting:cancelInstallment', { token, installmentId }),
    reinstateInstallment: (token, installmentId) => api.invoke('accounting:reinstateInstallment', { token, installmentId }),
    getSaleConventions: (token) => api.invoke('accounting:getSaleConventions', { token }),
};
// Bilan comptable (compte de résultat + actif/passif)
const bilan = {
    getResultat: (token, payload) => api.invoke('bilan:getResultat', { token, ...payload }),
    getActifPassif: (token, payload) => api.invoke('bilan:getActifPassif', { token, ...payload }),
    export: (token, payload) => api.invoke('bilan:export', { token, ...payload }),
};
// Communication
const communication = {
    listTemplates: (token, channel) => api.invoke('communication:listTemplates', { token, channel }),
    getTemplate: (token, id) => api.invoke('communication:getTemplate', { token, id }),
    createTemplate: (token, payload) => api.invoke('communication:createTemplate', { token, payload }),
    updateTemplate: (token, id, payload) => api.invoke('communication:updateTemplate', { token, id, payload }),
    deleteTemplate: (token, id) => api.invoke('communication:deleteTemplate', { token, id }),
    myTemplatePermissions: (token) => api.invoke('communication:myTemplatePermissions', { token }),
    getHistory: (token, filters, page, limit) => api.invoke('communication:getHistory', { token, filters, page, limit }),
    sendEmail: (token, payload) => api.invoke('communication:sendEmail', { token, payload }),
    sendSms: (token, payload) => api.invoke('communication:sendSms', { token, payload }),
    sendWhatsapp: (token, payload) => api.invoke('communication:sendWhatsapp', { token, payload }),
    resend: (token, id) => api.invoke('communication:resend', { token, id }),
    deleteMessage: (token, id) => api.invoke('communication:delete', { token, id }),
    resolveTarget: (token, payload) => api.invoke('communication:resolveTarget', { token, payload }),
    shareLocation: (token, payload) => api.invoke('communication:shareLocation', { token, payload }),
    previewShareLocation: (token, payload) => api.invoke('communication:previewShareLocation', { token, payload }),
    getTracking: (token) => api.invoke('communication:getTracking', { token }),
    updateTracking: (token, baseUrl) => api.invoke('communication:updateTracking', { token, baseUrl }),
};
// Reminders (politique de relance automatique)
const reminders = {
    getPolicy: (token) => api.invoke('reminders:getPolicy', { token }),
    updatePolicy: (token, payload) => api.invoke('reminders:updatePolicy', { token, payload }),
    listRules: (token) => api.invoke('reminders:listRules', { token }),
    updateRule: (token, id, payload) => api.invoke('reminders:updateRule', { token, id, payload }),
    runNow: (token) => api.invoke('reminders:runNow', { token }),
    setClientOptOut: (token, payload) => api.invoke('reminders:setClientOptOut', { token, payload }),
};
// CRM
const crm = {
    listActivities: (token, filters, page, limit) => api.invoke('crm:listActivities', { token, filters, page, limit }),
    getActivity: (token, id) => api.invoke('crm:getActivity', { token, id }),
    createActivity: (token, payload) => api.invoke('crm:createActivity', { token, payload }),
    updateActivity: (token, id, payload) => api.invoke('crm:updateActivity', { token, id, payload }),
    deleteActivity: (token, id) => api.invoke('crm:deleteActivity', { token, id }),
    completeActivity: (token, id) => api.invoke('crm:completeActivity', { token, id }),
    getStats: (token, filters) => api.invoke('crm:getStats', { token, filters }),
    listAssignees: (token) => api.invoke('crm:listAssignees', { token }),
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
// Gestion des visiteurs
const visitors = {
    list: (token, filters, page, limit) => api.invoke('visitors:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('visitors:getById', { token, id }),
    create: (token, payload) => api.invoke('visitors:create', { token, payload }),
    update: (token, id, payload) => api.invoke('visitors:update', { token, id, payload }),
    delete: (token, id) => api.invoke('visitors:delete', { token, id }),
    stats: (token) => api.invoke('visitors:stats', { token }),
    listObjects: (token, includeInactive) => api.invoke('visitors:listObjects', { token, includeInactive }),
    createObject: (token, label) => api.invoke('visitors:createObject', { token, label }),
    updateObject: (token, id, payload) => api.invoke('visitors:updateObject', { token, id, payload }),
    deleteObject: (token, id) => api.invoke('visitors:deleteObject', { token, id }),
};
// Gestion des appels (entrants / sortants)
const calls = {
    list: (token, filters, page, limit) => api.invoke('calls:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('calls:getById', { token, id }),
    create: (token, payload) => api.invoke('calls:create', { token, payload }),
    update: (token, id, payload) => api.invoke('calls:update', { token, id, payload }),
    delete: (token, id) => api.invoke('calls:delete', { token, id }),
    stats: (token) => api.invoke('calls:stats', { token }),
    searchClients: (token, search) => api.invoke('calls:searchClients', { token, search }),
    searchProspects: (token, search) => api.invoke('calls:searchProspects', { token, search }),
    phoneLines: {
        list: (token, includeInactive) => api.invoke('calls:phoneLines:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('calls:phoneLines:create', { token, payload }),
        update: (token, id, payload) => api.invoke('calls:phoneLines:update', { token, id, payload }),
        delete: (token, id) => api.invoke('calls:phoneLines:delete', { token, id }),
    },
};
// Réseaux sociaux & plateformes web
const socialMedia = {
    platforms: {
        list: (token, includeInactive) => api.invoke('socialMedia:listPlatforms', { token, includeInactive }),
        create: (token, payload) => api.invoke('socialMedia:createPlatform', { token, payload }),
        update: (token, id, payload) => api.invoke('socialMedia:updatePlatform', { token, id, payload }),
        delete: (token, id) => api.invoke('socialMedia:deletePlatform', { token, id }),
    },
    publications: {
        list: (token, filters, page, limit) => api.invoke('socialMedia:listPublications', { token, filters, page, limit }),
        create: (token, payload) => api.invoke('socialMedia:createPublication', { token, payload }),
        update: (token, id, payload) => api.invoke('socialMedia:updatePublication', { token, id, payload }),
        delete: (token, id) => api.invoke('socialMedia:deletePublication', { token, id }),
    },
    snapshots: {
        list: (token, platformId, limit) => api.invoke('socialMedia:listSnapshots', { token, platformId, limit }),
        upsert: (token, payload) => api.invoke('socialMedia:upsertSnapshot', { token, payload }),
        delete: (token, id) => api.invoke('socialMedia:deleteSnapshot', { token, id }),
    },
    dashboard: (token) => api.invoke('socialMedia:dashboard', { token }),
};
// Innovations IT (Module 16)
const innovations = {
    list: (token, filters, page, limit) => api.invoke('innovations:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('innovations:getById', { token, id }),
    employees: (token) => api.invoke('innovations:employees', { token }),
    create: (token, payload) => api.invoke('innovations:create', { token, payload }),
    update: (token, id, payload) => api.invoke('innovations:update', { token, id, payload }),
    submitPhase2: (token, id, payload) => api.invoke('innovations:submitPhase2', { token, id, payload }),
    submitPhase3: (token, id, payload) => api.invoke('innovations:submitPhase3', { token, id, payload }),
    validatePhase: (token, id, payload) => api.invoke('innovations:validatePhase', { token, id, payload }),
    delete: (token, id) => api.invoke('innovations:delete', { token, id }),
    removeAttachment: (token, id, documentId) => api.invoke('innovations:removeAttachment', { token, id, documentId }),
};
// Moteur de devis de construction (Module 17) — bibliothèque technique
const constructionLibrary = {
    lots: {
        list: (token, includeInactive) => api.invoke('construction:lots:list', { token, includeInactive }),
        upsert: (token, id, payload) => api.invoke('construction:lots:upsert', { token, id, payload }),
        delete: (token, id) => api.invoke('construction:lots:delete', { token, id }),
    },
    resourceFamilies: {
        list: (token, includeInactive) => api.invoke('construction:resourceFamilies:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('construction:resourceFamilies:create', { token, payload }),
        delete: (token, id) => api.invoke('construction:resourceFamilies:delete', { token, id }),
    },
    localities: {
        list: (token, includeInactive) => api.invoke('construction:localities:list', { token, includeInactive }),
        upsert: (token, id, payload) => api.invoke('construction:localities:upsert', { token, id, payload }),
        delete: (token, id) => api.invoke('construction:localities:delete', { token, id }),
    },
    resources: {
        list: (token, filters, page, limit) => api.invoke('construction:resources:list', { token, filters, page, limit }),
        getById: (token, id) => api.invoke('construction:resources:getById', { token, id }),
        create: (token, payload) => api.invoke('construction:resources:create', { token, payload }),
        update: (token, id, payload) => api.invoke('construction:resources:update', { token, id, payload }),
        updatePrice: (token, id, payload) => api.invoke('construction:resources:updatePrice', { token, id, payload }),
        priceHistory: (token, id, limit) => api.invoke('construction:resources:priceHistory', { token, id, limit }),
        whereUsed: (token, id) => api.invoke('construction:resources:whereUsed', { token, id }),
        delete: (token, id) => api.invoke('construction:resources:delete', { token, id }),
    },
    workItems: {
        list: (token, filters) => api.invoke('construction:workItems:list', { token, filters }),
        getById: (token, id) => api.invoke('construction:workItems:getById', { token, id }),
        upsert: (token, id, payload) => api.invoke('construction:workItems:upsert', { token, id, payload }),
        duplicate: (token, id) => api.invoke('construction:workItems:duplicate', { token, id }),
        delete: (token, id) => api.invoke('construction:workItems:delete', { token, id }),
    },
    ratioDefs: {
        list: (token, includeInactive) => api.invoke('construction:ratioDefs:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('construction:ratioDefs:create', { token, payload }),
        update: (token, id, payload) => api.invoke('construction:ratioDefs:update', { token, id, payload }),
        delete: (token, id) => api.invoke('construction:ratioDefs:delete', { token, id }),
    },
    ratioProfiles: {
        list: (token) => api.invoke('construction:ratioProfiles:list', { token }),
        getById: (token, id) => api.invoke('construction:ratioProfiles:getById', { token, id }),
        upsert: (token, id, payload) => api.invoke('construction:ratioProfiles:upsert', { token, id, payload }),
        duplicate: (token, id, target) => api.invoke('construction:ratioProfiles:duplicate', { token, id, target }),
        delete: (token, id) => api.invoke('construction:ratioProfiles:delete', { token, id }),
    },
    health: (token) => api.invoke('construction:library:health', { token }),
};
// Moteur de devis de construction (Module 17) — projets & estimations
const construction = {
    projects: {
        list: (token, filters, page, limit) => api.invoke('construction:projects:list', { token, filters, page, limit }),
        getById: (token, id) => api.invoke('construction:projects:getById', { token, id }),
        create: (token, payload) => api.invoke('construction:projects:create', { token, payload }),
        update: (token, id, payload) => api.invoke('construction:projects:update', { token, id, payload }),
        duplicate: (token, id) => api.invoke('construction:projects:duplicate', { token, id }),
        delete: (token, id) => api.invoke('construction:projects:delete', { token, id }),
    },
    quickEstimate: (token, args) => api.invoke('construction:quickEstimate', { token, ...args }),
    generateEstimate: (token, payload) => api.invoke('construction:generateEstimate', { token, ...payload }),
    estimates: {
        list: (token, projectId) => api.invoke('construction:estimates:list', { token, projectId }),
        getById: (token, id) => api.invoke('construction:estimates:getById', { token, id }),
        summary: (token, id) => api.invoke('construction:estimates:summary', { token, id }),
        materials: (token, id) => api.invoke('construction:estimates:materials', { token, id }),
        labor: (token, id) => api.invoke('construction:estimates:labor', { token, id }),
        toQuote: (token, estimateId, payload) => api.invoke('construction:estimates:toQuote', { token, estimateId, payload }),
        setStatus: (token, id, status) => api.invoke('construction:estimates:setStatus', { token, id, status }),
        delete: (token, id) => api.invoke('construction:estimates:delete', { token, id }),
    },
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
// RH / Paie — personnel et contrats de travail
const hr = {
    employees: {
        list: (token, filters, page, limit) => api.invoke('hr:employees:list', { token, filters, page, limit }),
        stats: (token) => api.invoke('hr:employees:stats', { token }),
        getById: (token, id) => api.invoke('hr:employees:getById', { token, id }),
        linkableUsers: (token, excludeEmployeeId) => api.invoke('hr:employees:linkableUsers', { token, excludeEmployeeId }),
        careerProfiles: (token) => api.invoke('hr:employees:careerProfiles', { token }),
        create: (token, payload) => api.invoke('hr:employees:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:employees:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:employees:delete', { token, id }),
    },
    contracts: {
        create: (token, payload) => api.invoke('hr:contracts:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:contracts:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:contracts:delete', { token, id }),
        getRenderData: (token, id) => api.invoke('hr:contracts:getRenderData', { token, id }),
    },
    signedContracts: {
        list: (token, employeeId) => api.invoke('hr:signedContracts:list', { token, employeeId }),
        upload: (token, payload) => api.invoke('hr:signedContracts:upload', { token, payload }),
        delete: (token, id) => api.invoke('hr:signedContracts:delete', { token, id }),
        fileData: (token, id) => api.invoke('hr:signedContracts:fileData', { token, id }),
        open: (token, id) => api.invoke('hr:signedContracts:open', { token, id }),
    },
    payslips: {
        list: (token, filters, page, limit) => api.invoke('hr:payslips:list', { token, filters, page, limit }),
        getById: (token, id) => api.invoke('hr:payslips:getById', { token, id }),
        generate: (token, payload) => api.invoke('hr:payslips:generate', { token, payload }),
        duplicate: (token, payload) => api.invoke('hr:payslips:duplicate', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:payslips:update', { token, id, payload }),
        updateStatus: (token, id, status, paymentMethod, paidAt, bankAccountId) => api.invoke('hr:payslips:updateStatus', { token, id, status, paymentMethod, paidAt, bankAccountId }),
        updatePayment: (token, id, paidAt, paymentMethod, bankAccountId) => api.invoke('hr:payslips:updatePayment', { token, id, paidAt, paymentMethod, bankAccountId }),
        payAccounts: (token) => api.invoke('hr:payslips:payAccounts', { token }),
        delete: (token, id) => api.invoke('hr:payslips:delete', { token, id }),
        print: (token, id) => api.invoke('hr:payslips:print', { token, id }),
    },
    payroll: {
        getRates: (token) => api.invoke('hr:payroll:getRates', { token }),
        setRates: (token, rates) => api.invoke('hr:payroll:setRates', { token, rates }),
    },
    contractTemplates: {
        list: (token) => api.invoke('hr:contractTemplates:list', { token }),
        create: (token, payload) => api.invoke('hr:contractTemplates:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:contractTemplates:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:contractTemplates:delete', { token, id }),
    },
    essaiCategories: {
        list: (token, includeInactive) => api.invoke('hr:essaiCategories:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('hr:essaiCategories:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:essaiCategories:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:essaiCategories:delete', { token, id }),
    },
    contractFunctions: {
        list: (token, includeInactive) => api.invoke('hr:contractFunctions:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('hr:contractFunctions:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:contractFunctions:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:contractFunctions:delete', { token, id }),
    },
    contractObjectives: {
        list: (token, includeInactive) => api.invoke('hr:contractObjectives:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('hr:contractObjectives:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:contractObjectives:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:contractObjectives:delete', { token, id }),
    },
    jobPositions: {
        list: (token, includeInactive) => api.invoke('hr:jobPositions:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('hr:jobPositions:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:jobPositions:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:jobPositions:delete', { token, id }),
    },
    departments: {
        list: (token, includeInactive) => api.invoke('hr:departments:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('hr:departments:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:departments:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:departments:delete', { token, id }),
    },
    commissionActivities: {
        list: (token) => api.invoke('hr:commissionActivities:list', { token }),
    },
    jobDescriptionTemplates: {
        list: (token) => api.invoke('hr:jobDescriptionTemplates:list', { token }),
        create: (token, payload) => api.invoke('hr:jobDescriptionTemplates:create', { token, payload }),
        update: (token, id, payload) => api.invoke('hr:jobDescriptionTemplates:update', { token, id, payload }),
        delete: (token, id) => api.invoke('hr:jobDescriptionTemplates:delete', { token, id }),
    },
    // Espace self-service : mon propre contenu RH & Paie (lecture seule).
    me: {
        overview: (token) => api.invoke('hr:me:overview', { token }),
        careerProfile: (token) => api.invoke('hr:me:careerProfile', { token }),
        payslips: (token) => api.invoke('hr:me:payslips', { token }),
        payslip: (token, id) => api.invoke('hr:me:payslip', { token, id }),
        payslipPrint: (token, id) => api.invoke('hr:me:payslipPrint', { token, id }),
        attendance: (token, year, month) => api.invoke('hr:me:attendance', { token, year, month }),
        leaveRequests: (token) => api.invoke('hr:me:leaveRequests', { token }),
        contractRenderData: (token, id) => api.invoke('hr:me:contractRenderData', { token, id }),
        reglementInterieur: (token) => api.invoke('hr:me:reglementInterieur', { token }),
        reglementInterieurPrint: (token) => api.invoke('hr:me:reglementInterieurPrint', { token }),
        signedContracts: (token) => api.invoke('hr:me:signedContracts', { token }),
        signedContractFile: (token, id) => api.invoke('hr:me:signedContractFile', { token, id }),
        signedContractOpen: (token, id) => api.invoke('hr:me:signedContractOpen', { token, id }),
        signedContractPrint: (token, id) => api.invoke('hr:me:signedContractPrint', { token, id }),
    },
    payslipTemplates: {
        list: (token) => api.invoke('hr:payslipTemplates:list', { token }),
        update: (token, id, payload) => api.invoke('hr:payslipTemplates:update', { token, id, payload }),
    },
    leaveTypes: {
        list: (token) => api.invoke('hr:leaveTypes:list', { token }),
    },
    leave: {
        balance: (token, employeeId) => api.invoke('hr:leave:balance', { token, employeeId }),
    },
    leaveRequests: {
        list: (token, filters, page, limit) => api.invoke('hr:leaveRequests:list', { token, filters, page, limit }),
        create: (token, payload) => api.invoke('hr:leaveRequests:create', { token, payload }),
        decide: (token, id, status, note) => api.invoke('hr:leaveRequests:decide', { token, id, status, note }),
        print: (token, id) => api.invoke('hr:leaveRequests:print', { token, id }),
        delete: (token, id) => api.invoke('hr:leaveRequests:delete', { token, id }),
        uploadSigned: (token, payload) => api.invoke('hr:leaveRequests:uploadSigned', { token, payload }),
        openSigned: (token, id) => api.invoke('hr:leaveRequests:openSigned', { token, id }),
        removeSigned: (token, id) => api.invoke('hr:leaveRequests:removeSigned', { token, id }),
    },
    attendance: {
        list: (token, employeeId, year, month) => api.invoke('hr:attendance:list', { token, employeeId, year, month }),
        summary: (token, employeeId, year, month) => api.invoke('hr:attendance:summary', { token, employeeId, year, month }),
        bulkUpsert: (token, records) => api.invoke('hr:attendance:bulkUpsert', { token, records }),
    },
    lateness: {
        list: (token, filters) => api.invoke('hr:lateness:list', { token, ...filters }),
        linkableLeaveRequests: (token, employeeId, date) => api.invoke('hr:lateness:linkableLeaveRequests', { token, employeeId, date }),
        linkableActivities: (token, employeeId, date) => api.invoke('hr:lateness:linkableActivities', { token, employeeId, date }),
        justify: (token, payload) => api.invoke('hr:lateness:justify', { token, payload }),
        unjustify: (token, employeeId, date) => api.invoke('hr:lateness:unjustify', { token, employeeId, date }),
        tolerate: (token, payload) => api.invoke('hr:lateness:tolerate', { token, payload }),
        untolerate: (token, employeeId, date) => api.invoke('hr:lateness:untolerate', { token, employeeId, date }),
    },
};
// Performance — évaluation & gestion des performances du personnel
const performance = {
    kpis: {
        list: (token, includeInactive) => api.invoke('performance:kpis:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('performance:kpis:create', { token, payload }),
        update: (token, id, payload) => api.invoke('performance:kpis:update', { token, id, payload }),
        delete: (token, id) => api.invoke('performance:kpis:delete', { token, id }),
    },
    weights: {
        list: (token) => api.invoke('performance:weights:list', { token }),
        upsert: (token, id, payload) => api.invoke('performance:weights:upsert', { token, id, payload }),
        delete: (token, id) => api.invoke('performance:weights:delete', { token, id }),
    },
    units: {
        list: (token, includeInactive) => api.invoke('performance:units:list', { token, includeInactive }),
        create: (token, payload) => api.invoke('performance:units:create', { token, payload }),
        update: (token, id, payload) => api.invoke('performance:units:update', { token, id, payload }),
        delete: (token, id) => api.invoke('performance:units:delete', { token, id }),
    },
    employees: {
        list: (token, scope) => api.invoke('performance:employees:list', { token, scope }),
    },
    objectives: {
        list: (token, filters) => api.invoke('performance:objectives:list', { token, filters }),
        getById: (token, id) => api.invoke('performance:objectives:getById', { token, id }),
        create: (token, payload) => api.invoke('performance:objectives:create', { token, payload }),
        update: (token, id, payload) => api.invoke('performance:objectives:update', { token, id, payload }),
        delete: (token, id) => api.invoke('performance:objectives:delete', { token, id }),
        duplicate: (token, sourceObj, targetObj) => api.invoke('performance:objectives:duplicate', { token, source: sourceObj, target: targetObj }),
    },
    evaluations: {
        list: (token, filters) => api.invoke('performance:evaluations:list', { token, filters }),
        getById: (token, id) => api.invoke('performance:evaluations:getById', { token, id }),
        create: (token, payload) => api.invoke('performance:evaluations:create', { token, payload }),
        update: (token, id, payload) => api.invoke('performance:evaluations:update', { token, id, payload }),
        computeKpis: (token, id) => api.invoke('performance:evaluations:computeKpis', { token, id }),
        submit: (token, id) => api.invoke('performance:evaluations:submit', { token, id }),
        sign: (token, id, level) => api.invoke('performance:evaluations:sign', { token, id, level }),
        refuse: (token, id, reason) => api.invoke('performance:evaluations:refuse', { token, id, reason }),
        delete: (token, id) => api.invoke('performance:evaluations:delete', { token, id }),
    },
    plans: {
        list: (token, filters) => api.invoke('performance:plans:list', { token, filters }),
        create: (token, payload) => api.invoke('performance:plans:create', { token, payload }),
        update: (token, id, payload) => api.invoke('performance:plans:update', { token, id, payload }),
        delete: (token, id) => api.invoke('performance:plans:delete', { token, id }),
    },
    rankings: {
        get: (token, periodType, refDate, basis) => api.invoke('performance:rankings:get', { token, periodType, refDate, basis }),
        snapshot: (token, periodType, refDate, basis) => api.invoke('performance:rankings:snapshot', { token, periodType, refDate, basis }),
        history: (token, periodType) => api.invoke('performance:rankings:history', { token, periodType }),
        getSnapshot: (token, id) => api.invoke('performance:rankings:getSnapshot', { token, id }),
        deleteSnapshot: (token, id) => api.invoke('performance:rankings:deleteSnapshot', { token, id }),
        getRoster: (token) => api.invoke('performance:ranking:getRoster', { token }),
        setRoster: (token, ids) => api.invoke('performance:ranking:setRoster', { token, ids }),
    },
    dashboard: (token) => api.invoke('performance:dashboard', { token }),
    me: {
        overview: (token, year) => api.invoke('performance:me:overview', { token, year }),
        evaluation: (token, id) => api.invoke('performance:me:evaluation', { token, id }),
        sign: (token, id) => api.invoke('performance:me:sign', { token, id }),
        ranking: (token, periodType, refDate) => api.invoke('performance:me:ranking', { token, periodType, refDate }),
        objectives: (token) => api.invoke('performance:me:objectives', { token }),
    },
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
    // Aperçu avant impression d'une liste (impression directe avec choix d'imprimante).
    print: (token, payload) => api.invoke('export:print', { token, ...payload }),
};
// Export PDF de document (convention / attestation) avec en-tête + pied de page
// rendus sur chaque page via le moteur natif Chromium.
const documentExport = {
    exportDocumentPdf: (token, payload) => api.invoke('documents:exportDocumentPdf', { token, ...payload }),
    // Aperçu avant impression du document (impression directe avec choix d'imprimante).
    printDocument: (token, payload) => api.invoke('documents:printDocument', { token, ...payload }),
    // Rendu PDF en mémoire (base64), sans dialogue ni fenêtre — pour réutiliser
    // le PDF comme pièce jointe (ex. convention jointe à un email).
    renderDocumentPdf: (token, payload) => api.invoke('documents:renderDocumentPdf', { token, ...payload }),
    exportDocumentDocx: (token, payload) => api.invoke('documents:exportDocumentDocx', { token, ...payload }),
};
// Modèles de facture
const invoiceTemplates = {
    list: (token) => api.invoke('invoiceTemplates:list', { token }),
    update: (token, id, payload) => api.invoke('invoiceTemplates:update', { token, id, payload }),
    setDefaults: (token, defaults) => api.invoke('invoiceTemplates:setDefaults', { token, defaults }),
};
// Modèle d'export de listes
const listExportTemplates = {
    list: (token) => api.invoke('listExportTemplates:list', { token }),
    update: (token, id, payload) => api.invoke('listExportTemplates:update', { token, id, payload }),
};
// Ordre de virement (bulletins de paie) — modèle éditable + aperçu/export
const wireTransfer = {
    getTemplate: (token) => api.invoke('wireTransfer:getTemplate', { token }),
    updateTemplate: (token, id, payload) => api.invoke('wireTransfer:updateTemplate', { token, id, payload }),
    print: (token, periodYear, periodMonth) => api.invoke('wireTransfer:print', { token, periodYear, periodMonth }),
    exportPdf: (token, periodYear, periodMonth) => api.invoke('wireTransfer:exportPdf', { token, periodYear, periodMonth }),
    exportExcel: (token, periodYear, periodMonth) => api.invoke('wireTransfer:exportExcel', { token, periodYear, periodMonth }),
};
// Commissions
const commissions = {
    getDashboard: (token) => api.invoke('commissions:getDashboard', { token }),
    list: (token, filters, page, limit) => api.invoke('commissions:list', { token, filters, page, limit }),
    getById: (token, id) => api.invoke('commissions:getById', { token, id }),
    create: (token, payload) => api.invoke('commissions:create', { token, payload }),
    prepareInstallmentCommission: (token, installmentId) => api.invoke('commissions:prepareInstallmentCommission', { token, installmentId }),
    createForInstallment: (token, payload) => api.invoke('commissions:createForInstallment', { token, payload }),
    update: (token, payload) => api.invoke('commissions:update', { token, payload }),
    pay: (token, payload) => api.invoke('commissions:pay', { token, payload }),
    cancel: (token, payload) => api.invoke('commissions:cancel', { token, payload }),
    getBeneficiarySummary: (token, beneficiaryType, beneficiaryId) => api.invoke('commissions:getBeneficiarySummary', { token, beneficiaryType, beneficiaryId }),
    listReferrers: (token, filters, page, limit) => api.invoke('commissions:listReferrers', { token, filters, page, limit }),
    getReferrerById: (token, id) => api.invoke('commissions:getReferrerById', { token, id }),
    getReferrerTimeline: (token, id) => api.invoke('commissions:getReferrerTimeline', { token, id }),
    createReferrer: (token, payload) => api.invoke('commissions:createReferrer', { token, payload }),
    updateReferrer: (token, id, payload) => api.invoke('commissions:updateReferrer', { token, id, payload }),
    deleteReferrer: (token, id) => api.invoke('commissions:deleteReferrer', { token, id }),
    listUsers: (token) => api.invoke('commissions:listUsers', { token }),
    listEligibleConventions: (token, filters) => api.invoke('commissions:listEligibleConventions', { token, filters }),
    getSettings: (token) => api.invoke('commissions:getSettings', { token }),
    updateSettings: (token, payload) => api.invoke('commissions:updateSettings', { token, payload }),
};
// Charges / dépenses prévisionnelles
const expenses = {
    listCategories: (token) => api.invoke('expenses:listCategories', { token }),
    listAccounts: (token) => api.invoke('expenses:listAccounts', { token }),
    list: (token, filters, page, limit) => api.invoke('expenses:list', { token, filters, page, limit }),
    stats: (token) => api.invoke('expenses:stats', { token }),
    getById: (token, id) => api.invoke('expenses:getById', { token, id }),
    create: (token, payload) => api.invoke('expenses:create', { token, payload }),
    update: (token, id, payload) => api.invoke('expenses:update', { token, id, payload }),
    settle: (token, payload) => api.invoke('expenses:settle', { token, payload }),
    fundAccount: (token, payload) => api.invoke('expenses:fundAccount', { token, payload }),
    cancel: (token, id) => api.invoke('expenses:cancel', { token, id }),
    remove: (token, id) => api.invoke('expenses:remove', { token, id }),
};
// Analyses décisionnelles (BI) — admin uniquement
const analytics = {
    executive: (token) => api.invoke('analytics:executive', { token }),
    financial: (token) => api.invoke('analytics:financial', { token }),
    portfolio: (token) => api.invoke('analytics:portfolio', { token }),
    crm: (token) => api.invoke('analytics:crm', { token }),
    crmDetail: (token, metric, extra, page, limit) => api.invoke('analytics:crmDetail', { token, metric, ...extra, page, limit }),
    charges: (token) => api.invoke('analytics:charges', { token }),
    contracts: (token) => api.invoke('analytics:contracts', { token }),
    risk: (token) => api.invoke('analytics:risk', { token }),
    recommendations: (token) => api.invoke('analytics:recommendations', { token }),
    followUp: (token) => api.invoke('analytics:followUp', { token }),
    visitors: (token) => api.invoke('analytics:visitors', { token }),
    calls: (token) => api.invoke('analytics:calls', { token }),
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
    setAccountViewers: (token, id, userIds) => api.invoke('treasury:setAccountViewers', { token, id, userIds }),
    listOperations: (token, filters, page, limit) => api.invoke('treasury:listOperations', { token, filters, page, limit }),
    createOperation: (token, payload) => api.invoke('treasury:createOperation', { token, payload }),
    updateOperation: (token, id, payload) => api.invoke('treasury:updateOperation', { token, id, payload }),
    deleteOperation: (token, id) => api.invoke('treasury:deleteOperation', { token, id }),
    getEntityCashflow: (token, entityType, entityId, limit) => api.invoke('treasury:getEntityCashflow', { token, entityType, entityId, limit }),
    listCategories: (token, filters) => api.invoke('treasury:listCategories', { token, filters }),
    createCategory: (token, payload) => api.invoke('treasury:createCategory', { token, payload }),
    updateCategory: (token, id, payload) => api.invoke('treasury:updateCategory', { token, id, payload }),
    deleteCategory: (token, id) => api.invoke('treasury:deleteCategory', { token, id }),
    listThirdParties: (token, filters) => api.invoke('treasury:listThirdParties', { token, filters }),
    createThirdParty: (token, payload) => api.invoke('treasury:createThirdParty', { token, payload }),
    updateThirdParty: (token, id, payload) => api.invoke('treasury:updateThirdParty', { token, id, payload }),
    deleteThirdParty: (token, id) => api.invoke('treasury:deleteThirdParty', { token, id }),
    listUsers: (token) => api.invoke('treasury:listUsers', { token }),
};
// Dashboard
const dashboard = {
    getStats: (token) => api.invoke('dashboard:getStats', { token }),
};
// Configuration connexion BDD (accessible avant authentification)
const config = {
    getDb: () => api.invoke('config:getDb', {}),
    testDb: (dbConfig) => api.invoke('config:testDb', { config: dbConfig }),
    saveDb: (dbConfig) => api.invoke('config:saveDb', { config: dbConfig }),
};
// Paramètres applicatifs (réservés aux administrateurs)
const settings = {
    getCompany: (token) => api.invoke('settings:getCompany', { token }),
    updateCompany: (token, payload) => api.invoke('settings:updateCompany', { token, payload }),
    getReglementInterieur: (token) => api.invoke('settings:getReglementInterieur', { token }),
    setReglementInterieur: (token, documentId) => api.invoke('settings:setReglementInterieur', { token, documentId }),
    uploadLogo: (token, payload) => api.invoke('settings:uploadLogo', { token, payload }),
    deleteLogo: (token) => api.invoke('settings:deleteLogo', { token }),
    getLogoData: (token) => api.invoke('settings:getLogoData', { token }),
    /** Logo de connexion lu directement depuis le dossier logo/ (sans session ni accès DB). */
    getLoginLogoData: () => api.invoke('settings:getLoginLogoData', {}),
    getStorage: (token) => api.invoke('settings:getStorage', { token }),
    updateStorage: (token, payload) => api.invoke('settings:updateStorage', { token, payload }),
    getPayrollAccount: (token) => api.invoke('settings:getPayrollAccount', { token }),
    updatePayrollAccount: (token, payload) => api.invoke('settings:updatePayrollAccount', { token, payload }),
    getAttendanceQr: (token) => api.invoke('settings:getAttendanceQr', { token }),
    updateAttendanceQr: (token, payload) => api.invoke('settings:updateAttendanceQr', { token, payload }),
    getManualTemplateEditors: (token) => api.invoke('settings:getManualTemplateEditors', { token }),
    updateManualTemplateEditors: (token, userIds) => api.invoke('settings:updateManualTemplateEditors', { token, userIds }),
    getLatenessSettings: (token) => api.invoke('settings:getLatenessSettings', { token }),
    updateLatenessSettings: (token, payload) => api.invoke('settings:updateLatenessSettings', { token, payload }),
    getVisitorQr: (token) => api.invoke('settings:getVisitorQr', { token }),
    updateVisitorQr: (token, payload) => api.invoke('settings:updateVisitorQr', { token, payload }),
    getEmail: (token) => api.invoke('settings:getEmail', { token }),
    updateEmail: (token, payload) => api.invoke('settings:updateEmail', { token, payload }),
    testEmail: (token, to) => api.invoke('settings:testEmail', { token, to }),
    getSms: (token) => api.invoke('settings:getSms', { token }),
    updateSms: (token, payload) => api.invoke('settings:updateSms', { token, payload }),
    testSms: (token, to) => api.invoke('settings:testSms', { token, to }),
    testWhatsapp: (token, to) => api.invoke('settings:testWhatsapp', { token, to }),
    getConditionsParticulieres: (token) => api.invoke('settings:getConditionsParticulieres', { token }),
    updateConditionsParticulieres: (token, items) => api.invoke('settings:updateConditionsParticulieres', { token, items }),
    getSlideshow: (token) => api.invoke('settings:getSlideshow', { token }),
    updateSlideshow: (token, items) => api.invoke('settings:updateSlideshow', { token, items }),
    uploadSlideshowMedia: (token, payload) => api.invoke('settings:uploadSlideshowMedia', { token, payload }),
    getSlideshowMediaData: (token, relativePath) => api.invoke('settings:getSlideshowMediaData', { token, relativePath }),
    getSlideshowVisibility: (token) => api.invoke('settings:getSlideshowVisibility', { token }),
    updateSlideshowVisibility: (token, payload) => api.invoke('settings:updateSlideshowVisibility', { token, payload }),
    // Modèles de partage de localisation GPS
    getShareLocation: (token) => api.invoke('settings:getShareLocation', { token }),
    updateShareLocation: (token, payload) => api.invoke('settings:updateShareLocation', { token, payload }),
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
    uploadClientDoc: (token, clientId, category, payload) => api.invoke('documents:uploadClientDoc', { token, clientId, category, ...payload }),
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
// Profils de carrière (filières métier par poste) — paramétrage SUPER_ADMIN/ADMIN.
const careerProfiles = {
    list: (token) => api.invoke('careerProfiles:list', { token }),
    getById: (token, id) => api.invoke('careerProfiles:getById', { token, id }),
    create: (token, payload) => api.invoke('careerProfiles:create', { token, payload }),
    update: (token, id, payload) => api.invoke('careerProfiles:update', { token, id, payload }),
    delete: (token, id) => api.invoke('careerProfiles:delete', { token, id }),
    duplicate: (token, id) => api.invoke('careerProfiles:duplicate', { token, id }),
};
electron_1.contextBridge.exposeInMainWorld('electron', { auth, users, prospects, clients, owners, properties, conventions, conventionTemplates, attestationTemplates, attestations, quotes, quoteTemplates, catalog, accounting, bilan, communication, crm, archiving, documents, documentExport, lotissements, terrains, programmes, projects, hr, careerProfiles, performance, visitors, calls, socialMedia, innovations, constructionLibrary, construction, geo, countries, commissions, expenses, analytics, exporter, invoiceTemplates, listExportTemplates, wireTransfer, treasury, budget, dashboard, settings, reminders, config });
