import { createHashRouter, Navigate } from 'react-router-dom';
import App from './App';
import LoginPage from './modules/auth/LoginPage';
import ProtectedLayout from './shared/components/layout/ProtectedLayout';
import RoleGuard from './shared/components/layout/RoleGuard';

// Users
import UsersListPage from './modules/users/pages/UsersListPage';
import UserFormPage from './modules/users/pages/UserFormPage';
import UserDetailPage from './modules/users/pages/UserDetailPage';

// Profile (tout utilisateur connecté)
import ProfilePage from './modules/profile/pages/ProfilePage';

// Prospects
import ProspectsListPage from './modules/prospects/pages/ProspectsListPage';
import ProspectFormPage from './modules/prospects/pages/ProspectFormPage';
import ProspectDetailPage from './modules/prospects/pages/ProspectDetailPage';
import ProspectKanbanPage from './modules/prospects/pages/ProspectKanbanPage';
import ProspectTimelinePage from './modules/prospects/pages/ProspectTimelinePage';

// Clients
import ClientsListPage from './modules/clients/pages/ClientsListPage';
import ClientFormPage from './modules/clients/pages/ClientFormPage';
import ClientDetailPage from './modules/clients/pages/ClientDetailPage';
import ClientTimelinePage from './modules/clients/pages/ClientTimelinePage';

// Owners
import OwnersListPage from './modules/owners/pages/OwnersListPage';
import OwnerFormPage from './modules/owners/pages/OwnerFormPage';
import OwnerDetailPage from './modules/owners/pages/OwnerDetailPage';

// Properties
import PropertiesListPage from './modules/properties/pages/PropertiesListPage';
import PropertyFormPage from './modules/properties/pages/PropertyFormPage';
import PropertyDetailPage from './modules/properties/pages/PropertyDetailPage';

// Conventions
import ConventionsListPage from './modules/conventions/pages/ConventionsListPage';
import ConventionFormPage from './modules/conventions/pages/ConventionFormPage';
import ConventionDetailPage from './modules/conventions/pages/ConventionDetailPage';
import ConventionTemplateFormPage from './modules/conventions/pages/ConventionTemplateFormPage';
import ConventionDocumentPage from './modules/conventions/pages/ConventionDocumentPage';
import AttestationTemplateFormPage from './modules/conventions/pages/AttestationTemplateFormPage';
import AttestationsListPage from './modules/conventions/pages/AttestationsListPage';
import AttestationFormPage from './modules/conventions/pages/AttestationFormPage';
import AttestationDetailPage from './modules/conventions/pages/AttestationDetailPage';
import AttestationDocumentPage from './modules/conventions/pages/AttestationDocumentPage';

// Devis
import QuotesListPage from './modules/quotes/pages/QuotesListPage';
import QuoteFormPage from './modules/quotes/pages/QuoteFormPage';
import ConstructionProjectsListPage from './modules/construction/pages/ConstructionProjectsListPage';
import ConstructionProjectFormPage from './modules/construction/pages/ConstructionProjectFormPage';
import ConstructionProjectDetailPage from './modules/construction/pages/ConstructionProjectDetailPage';
import ConstructionEstimatePage from './modules/construction/pages/ConstructionEstimatePage';
import PermitProjectsListPage from './modules/permits/pages/PermitProjectsListPage';
import PermitProjectFormPage from './modules/permits/pages/PermitProjectFormPage';
import PermitProjectDetailPage from './modules/permits/pages/PermitProjectDetailPage';
import PermitEstimatePage from './modules/permits/pages/PermitEstimatePage';
import AmlDashboardPage from './modules/aml/pages/AmlDashboardPage';
import AmlProfilesListPage from './modules/aml/pages/AmlProfilesListPage';
import AmlProfileFormPage from './modules/aml/pages/AmlProfileFormPage';
import AmlProfileDetailPage from './modules/aml/pages/AmlProfileDetailPage';
import AmlReviewsListPage from './modules/aml/pages/AmlReviewsListPage';
import AmlReviewDetailPage from './modules/aml/pages/AmlReviewDetailPage';
import AmlSuspiciousReportsListPage from './modules/aml/pages/AmlSuspiciousReportsListPage';
import AmlSuspiciousReportDetailPage from './modules/aml/pages/AmlSuspiciousReportDetailPage';
import AmlTrainingListPage from './modules/aml/pages/AmlTrainingListPage';
import AmlWatchlistPage from './modules/aml/pages/AmlWatchlistPage';
import QuoteDetailPage from './modules/quotes/pages/QuoteDetailPage';
import QuoteDocumentPage from './modules/quotes/pages/QuoteDocumentPage';
import QuoteTemplateFormPage from './modules/quotes/pages/QuoteTemplateFormPage';
import ProformaListPage from './modules/proforma/pages/ProformaListPage';
import ProformaDetailPage from './modules/proforma/pages/ProformaDetailPage';

// Communication
import CommunicationPage from './modules/communication/pages/CommunicationPage';
import SendMessagePage from './modules/communication/pages/SendMessagePage';

// CRM
import CrmPage from './modules/crm/pages/CrmPage';
import ActivityFormPage from './modules/crm/pages/ActivityFormPage';

// Archiving
import ArchivingPage from './modules/archiving/pages/ArchivingPage';
import ArchivePoliciesPage from './modules/archiving/pages/ArchivePoliciesPage';
import GedDocumentsPage from './modules/archiving/pages/GedDocumentsPage';
import GedDocumentDetailPage from './modules/archiving/pages/GedDocumentDetailPage';
import GedDashboardPage from './modules/archiving/pages/GedDashboardPage';
import GedSettingsPage from './modules/archiving/pages/GedSettingsPage';

// Accounting
import AccountingDashboardPage from './modules/accounting/pages/AccountingDashboardPage';
import InvoicesListPage from './modules/accounting/pages/InvoicesListPage';
import InvoiceFormPage from './modules/accounting/pages/InvoiceFormPage';
import InvoiceDetailPage from './modules/accounting/pages/InvoiceDetailPage';
import InstallmentsPage from './modules/accounting/pages/InstallmentsPage';
import BilanPage from './modules/accounting/pages/BilanPage';

// Lotissements
import LotissementsListPage from './modules/lotissements/pages/LotissementsListPage';
import LotissementFormPage from './modules/lotissements/pages/LotissementFormPage';
import LotissementDetailPage from './modules/lotissements/pages/LotissementDetailPage';

// Terrains
import TerrainsListPage from './modules/terrains/pages/TerrainsListPage';
import TerrainFormPage from './modules/terrains/pages/TerrainFormPage';
import TerrainDetailPage from './modules/terrains/pages/TerrainDetailPage';
import EmployeesListPage from './modules/hr/pages/EmployeesListPage';
import EmployeeFormPage from './modules/hr/pages/EmployeeFormPage';
import EmployeeDetailPage from './modules/hr/pages/EmployeeDetailPage';
import PayslipsListPage from './modules/hr/pages/PayslipsListPage';
import PayslipDetailPage from './modules/hr/pages/PayslipDetailPage';
import PayrollSettingsPage from './modules/hr/pages/PayrollSettingsPage';
import HrTemplatesPage from './modules/hr/pages/HrTemplatesPage';
import ContractTemplateFormPage from './modules/hr/pages/ContractTemplateFormPage';
import ContractDocumentPage from './modules/hr/pages/ContractDocumentPage';
import JobDescriptionTemplateFormPage from './modules/hr/pages/JobDescriptionTemplateFormPage';
import JobDescriptionDocumentPage from './modules/hr/pages/JobDescriptionDocumentPage';
import MyHrPage from './modules/hr/pages/MyHrPage';
import PerformanceDashboardPage from './modules/performance/pages/PerformanceDashboardPage';
import ObjectivesListPage from './modules/performance/pages/ObjectivesListPage';
import EvaluationsListPage from './modules/performance/pages/EvaluationsListPage';
import EvaluationDetailPage from './modules/performance/pages/EvaluationDetailPage';
import RankingsPage from './modules/performance/pages/RankingsPage';
import PerformanceSettingsPage from './modules/performance/pages/PerformanceSettingsPage';
import LeaveRequestsPage from './modules/hr/pages/LeaveRequestsPage';
import AttendancePage from './modules/hr/pages/AttendancePage';
import LatenessPage from './modules/hr/pages/LatenessPage';

// Programmes immobiliers
import ProgrammesListPage from './modules/programmes/pages/ProgrammesListPage';
import ProgrammeFormPage from './modules/programmes/pages/ProgrammeFormPage';
import ProgrammeDetailPage from './modules/programmes/pages/ProgrammeDetailPage';
import VisitorsListPage from './modules/visitors/pages/VisitorsListPage';
import VisitorFormPage from './modules/visitors/pages/VisitorFormPage';
import VisitObjectsPage from './modules/visitors/pages/VisitObjectsPage';
import CallsListPage from './modules/calls/pages/CallsListPage';
import CallFormPage from './modules/calls/pages/CallFormPage';

// Réseaux Sociaux & Plateformes Web
import SocialMediaDashboardPage from './modules/social-media/pages/SocialMediaDashboardPage';
import SocialPublicationsPage from './modules/social-media/pages/SocialPublicationsPage';
import SocialFollowersPage from './modules/social-media/pages/SocialFollowersPage';
import SocialPlatformsPage from './modules/social-media/pages/SocialPlatformsPage';
import ItInnovationsListPage from './modules/it-innovations/pages/ItInnovationsListPage';
import ItInnovationDetailPage from './modules/it-innovations/pages/ItInnovationDetailPage';

// Projets
import ProjectsListPage from './modules/projects/pages/ProjectsListPage';
import ProjectFormPage from './modules/projects/pages/ProjectFormPage';
import ProjectDetailPage from './modules/projects/pages/ProjectDetailPage';

// Commissions
import CommissionsDashboardPage from './modules/commissions/pages/CommissionsDashboardPage';
import CommissionsListPage from './modules/commissions/pages/CommissionsListPage';
import CommissionFormPage from './modules/commissions/pages/CommissionFormPage';
import BeneficiaryCommissionsPage from './modules/commissions/pages/BeneficiaryCommissionsPage';
import ReferrersListPage from './modules/commissions/pages/ReferrersListPage';
import ReferrerDetailPage from './modules/commissions/pages/ReferrerDetailPage';
import ReferrerTimelinePage from './modules/commissions/pages/ReferrerTimelinePage';
import ReferrerFormPage from './modules/commissions/pages/ReferrerFormPage';
import ExpensesListPage from './modules/expenses/pages/ExpensesListPage';
import ExpenseFormPage from './modules/expenses/pages/ExpenseFormPage';
import AnalyticsExecutivePage from './modules/analytics/pages/AnalyticsExecutivePage';
import AnalyticsFinancialPage from './modules/analytics/pages/AnalyticsFinancialPage';
import AnalyticsPortfolioPage from './modules/analytics/pages/AnalyticsPortfolioPage';
import AnalyticsCrmPage from './modules/analytics/pages/AnalyticsCrmPage';
import AnalyticsFollowUpPage from './modules/analytics/pages/AnalyticsFollowUpPage';
import AnalyticsChargesPage from './modules/analytics/pages/AnalyticsChargesPage';
import AnalyticsContractsPage from './modules/analytics/pages/AnalyticsContractsPage';
import AnalyticsVisitorsPage from './modules/analytics/pages/AnalyticsVisitorsPage';
import AnalyticsRiskPage from './modules/analytics/pages/AnalyticsRiskPage';
import AnalyticsCallsPage from './modules/analytics/pages/AnalyticsCallsPage';
import AnalyticsRecommendationsPage from './modules/analytics/pages/AnalyticsRecommendationsPage';

// Budgets
import BudgetDashboardPage from './modules/budget/pages/BudgetDashboardPage';
import BudgetsListPage from './modules/budget/pages/BudgetsListPage';
import BudgetFormPage from './modules/budget/pages/BudgetFormPage';
import BudgetDetailPage from './modules/budget/pages/BudgetDetailPage';
import BudgetLineFormPage from './modules/budget/pages/BudgetLineFormPage';

// Trésorerie
import TreasuryDashboardPage from './modules/treasury/pages/TreasuryDashboardPage';
import AccountFormPage from './modules/treasury/pages/AccountFormPage';
import AccountDetailPage from './modules/treasury/pages/AccountDetailPage';
import OperationFormPage from './modules/treasury/pages/OperationFormPage';

// Dashboard placeholder
import DashboardPage from './modules/dashboard/DashboardPage';

// Settings (paramétrage de l'application)
import SettingsPage from './modules/settings/pages/SettingsPage';
import DbConnectionPage from './modules/settings/pages/DbConnectionPage';

export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    // Configuration de la connexion BDD — publique (utilisable même si la base
    // est injoignable, donc avant authentification).
    path: '/db-settings',
    element: <DbConnectionPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'dashboard', element: <DashboardPage /> },

          // Profil personnel (accessible à tout utilisateur connecté)
          { path: 'profile', element: <ProfilePage /> },

          // Mon espace RH & Paie — self-service en lecture seule, accessible à
          // tout utilisateur authentifié (limité côté IPC à son propre dossier).
          { path: 'my-hr', element: <MyHrPage /> },
          { path: 'my-hr/contracts/:id/document', element: <ContractDocumentPage selfMode /> },
          { path: 'my-hr/contracts/:id/job-description', element: <JobDescriptionDocumentPage selfMode /> },

          // Retards & Départs précipités — accessible à tout utilisateur
          // authentifié : SUPER_ADMIN/ADMIN/MANAGER voient tous les
          // collaborateurs éligibles, les autres rôles sont limités côté IPC à
          // leur propre dossier (auto-consultation, sans filtre Collaborateur).
          { path: 'hr/lateness', element: <LatenessPage /> },

          // Users — ADMIN / SUPER_ADMIN (gestion complète) et AGENT_TECHNIQUE
          // (gestion limitée aux comptes AGENT / AGENT_TECHNIQUE / READONLY,
          // appliquée côté backend).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'AGENT_TECHNIQUE']} />,
            children: [
              { path: 'users', element: <UsersListPage /> },
              { path: 'users/new', element: <UserFormPage /> },
              { path: 'users/:id', element: <UserDetailPage /> },
              { path: 'users/:id/edit', element: <UserFormPage /> },
            ],
          },

          // Paramètres applicatifs — admins (tous les onglets). MANAGER et
          // ACCOUNTANT y accèdent aussi mais ne voient que l'onglet « Catalogue
          // prestations / produits » ; RH ne voit que « Modèles de contrats de
          // travail ». Route ouverte à tous les rôles authentifiés car un
          // utilisateur désigné (n'importe quel rôle, cf. Paramètres → Modèles
          // de messages → « Gérer les accès ») doit pouvoir atteindre l'onglet
          // « Modèles email / SMS » ; le filtrage réel par onglet — dont le
          // repli « aucun accès » pour un rôle sans onglet visible — reste
          // entièrement géré dans SettingsPage.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'RH', 'READONLY']} />,
            children: [
              { path: 'settings', element: <SettingsPage /> },
            ],
          },

          // Prospects
          { path: 'prospects', element: <ProspectsListPage /> },
          { path: 'prospects/kanban', element: <ProspectKanbanPage /> },
          { path: 'prospects/new', element: <ProspectFormPage /> },
          { path: 'prospects/:id', element: <ProspectDetailPage /> },
          { path: 'prospects/:id/edit', element: <ProspectFormPage /> },
          { path: 'prospects/:id/timeline', element: <ProspectTimelinePage /> },

          // Clients
          { path: 'clients', element: <ClientsListPage /> },
          { path: 'clients/new', element: <ClientFormPage /> },
          { path: 'clients/:id', element: <ClientDetailPage /> },
          { path: 'clients/:id/edit', element: <ClientFormPage /> },
          { path: 'clients/:id/timeline', element: <ClientTimelinePage /> },

          // Owners — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'owners', element: <OwnersListPage /> },
              { path: 'owners/new', element: <OwnerFormPage /> },
              { path: 'owners/:id', element: <OwnerDetailPage /> },
              { path: 'owners/:id/edit', element: <OwnerFormPage /> },
            ],
          },

          // Properties
          { path: 'properties', element: <PropertiesListPage /> },
          { path: 'properties/new', element: <PropertyFormPage /> },
          { path: 'properties/:id', element: <PropertyDetailPage /> },
          { path: 'properties/:id/edit', element: <PropertyFormPage /> },

          // Devis — consultation : tous les rôles authentifiés.
          { path: 'quotes', element: <QuotesListPage /> },
          { path: 'quotes/:id', element: <QuoteDetailPage /> },
          { path: 'quotes/:id/document', element: <QuoteDocumentPage /> },
          // Devis — écriture (création / édition) : AGENT et plus, ACCOUNTANT inclus.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE']} />,
            children: [
              { path: 'quotes/new', element: <QuoteFormPage /> },
              { path: 'quotes/:id/edit', element: <QuoteFormPage /> },
            ],
          },
          // Modèles de devis — édition réservée aux MANAGER+.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']} />,
            children: [
              { path: 'quotes/templates/new', element: <QuoteTemplateFormPage /> },
              { path: 'quotes/templates/:id/edit', element: <QuoteTemplateFormPage /> },
            ],
          },

          // Factures Proforma — document optionnel émis depuis un devis ou une
          // convention Brouillon ; consultation ouverte à tous les rôles
          // authentifiés (périmètre par auteur appliqué côté IPC pour les rôles
          // hors SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT, même principe que Devis).
          { path: 'proforma', element: <ProformaListPage /> },
          { path: 'proforma/:id', element: <ProformaDetailPage /> },

          // Devis construction (Module 17) — consultation : tous les rôles authentifiés (périmètre
          // par référent commercial appliqué côté IPC pour les rôles hors SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT).
          { path: 'construction', element: <ConstructionProjectsListPage /> },
          { path: 'construction/projects/:id', element: <ConstructionProjectDetailPage /> },
          { path: 'construction/estimates/:id', element: <ConstructionEstimatePage /> },
          // Devis construction — écriture (création / édition) : réservée à SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT
          // (cf. WRITE_ROLES dans construction-projects.ipc.ts — les autres rôles sont en lecture seule).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'construction/projects/new', element: <ConstructionProjectFormPage /> },
              { path: 'construction/projects/:id/edit', element: <ConstructionProjectFormPage /> },
            ],
          },

          // Devis permis de construire (Module 18) — mêmes conventions de rôle que le Module 17.
          { path: 'permits', element: <PermitProjectsListPage /> },
          { path: 'permits/projects/:id', element: <PermitProjectDetailPage /> },
          { path: 'permits/estimates/:id', element: <PermitEstimatePage /> },
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'permits/projects/new', element: <PermitProjectFormPage /> },
              { path: 'permits/projects/:id/edit', element: <PermitProjectFormPage /> },
            ],
          },

          // Conformité LBC/FT (Module 19) — rôle CONFORMITE dédié (exclusif,
          // aucune équivalence checkRole) + SUPER_ADMIN/ADMIN en supervision +
          // MANAGER et ACCOUNTANT en plein accès (parité ADMIN, y compris les
          // actions les plus sensibles côté IPC — AML_ADMIN_ONLY dans aml.ipc.ts).
          // La confidentialité fine des déclarations de soupçon est appliquée
          // côté IPC (AML_REPORT_MANAGE_ROLES === AML_ROLES ici, pas besoin
          // d'un second RoleGuard).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'aml/dashboard', element: <AmlDashboardPage /> },
              { path: 'aml/profiles', element: <AmlProfilesListPage /> },
              { path: 'aml/profiles/new', element: <AmlProfileFormPage /> },
              { path: 'aml/profiles/:id', element: <AmlProfileDetailPage /> },
              { path: 'aml/profiles/:id/edit', element: <AmlProfileFormPage /> },
              { path: 'aml/reviews', element: <AmlReviewsListPage /> },
              { path: 'aml/reviews/:id', element: <AmlReviewDetailPage /> },
              { path: 'aml/suspicious-reports', element: <AmlSuspiciousReportsListPage /> },
              { path: 'aml/suspicious-reports/:id', element: <AmlSuspiciousReportDetailPage /> },
            ],
          },
          // Conformité LBC/FT — accès restreint AGENT / AGENT_TECHNIQUE /
          // ASSISTANTE_DIRECTION / READONLY : uniquement Référentiel de
          // vigilance et Formations (jamais Profils/Revues/Déclarations/
          // Tableau de bord). Écriture sur le référentiel de vigilance
          // limitée à AGENT_TECHNIQUE et lecture des formations limitée à
          // leurs propres participations — appliqué côté IPC (aml.ipc.ts,
          // AML_RESTRICTED_ROLES / WATCHLIST_RESTRICTED_WRITE_ROLES), pas
          // ici (RoleGuard ne gère que l'accès à la route, pas la
          // granularité des actions).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT', 'AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY']} />,
            children: [
              { path: 'aml/training', element: <AmlTrainingListPage /> },
              { path: 'aml/watchlist', element: <AmlWatchlistPage /> },
            ],
          },

          // Conventions / Attestations — CONSULTATION : MANAGER+ (ACCOUNTANT inclus)
          // et AGENT (limité par le backend à ses clients référents en BROUILLON).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE']} />,
            children: [
              { path: 'conventions', element: <ConventionsListPage /> },
              { path: 'conventions/attestations', element: <AttestationsListPage /> },
              { path: 'conventions/attestations/:id', element: <AttestationDetailPage /> },
              { path: 'conventions/attestations/:id/document', element: <AttestationDocumentPage /> },
              { path: 'conventions/:id', element: <ConventionDetailPage /> },
              { path: 'conventions/:id/document', element: <ConventionDocumentPage /> },
            ],
          },
          // Conventions / Attestations — ÉCRITURE (création, édition, modèles) :
          // réservée aux MANAGER+ (ACCOUNTANT inclus). AGENT, READONLY et
          // ASSISTANTE_DIRECTION exclus (cette dernière est en lecture seule).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'conventions/new', element: <ConventionFormPage /> },
              { path: 'conventions/templates/new', element: <ConventionTemplateFormPage /> },
              { path: 'conventions/templates/:id/edit', element: <ConventionTemplateFormPage /> },
              { path: 'conventions/attestation-templates/new', element: <AttestationTemplateFormPage /> },
              { path: 'conventions/attestation-templates/:id/edit', element: <AttestationTemplateFormPage /> },
              { path: 'conventions/attestations/new', element: <AttestationFormPage /> },
              { path: 'conventions/attestations/:id/edit', element: <AttestationFormPage /> },
              { path: 'conventions/:id/edit', element: <ConventionFormPage /> },
            ],
          },

          // Communication
          { path: 'communication', element: <CommunicationPage /> },
          { path: 'communication/send', element: <SendMessagePage /> },

          // CRM
          { path: 'crm', element: <CrmPage /> },
          { path: 'crm/activities/new', element: <ActivityFormPage /> },
          { path: 'crm/activities/:id/edit', element: <ActivityFormPage /> },

          // GED — Documents : accessible à TOUS les utilisateurs (espace personnel
          // + dossiers partagés). Le contrôle d'accès fin est appliqué côté serveur.
          { path: 'archiving', element: <Navigate to="/archiving/ged" replace /> },
          { path: 'archiving/ged', element: <GedDocumentsPage /> },
          { path: 'archiving/ged/:id', element: <GedDocumentDetailPage /> },

          // Reste du module Archivage — réservé aux MANAGER+ (ACCOUNTANT/AD inclus).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'archiving/entities', element: <ArchivingPage /> },
              { path: 'archiving/policies', element: <ArchivePoliciesPage /> },
              { path: 'archiving/ged/dashboard', element: <GedDashboardPage /> },
              { path: 'archiving/ged/settings', element: <GedSettingsPage /> },
            ],
          },

          // Lotissements — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          // Lecture (liste + détail) ouverte à ASSISTANTE_DIRECTION ; création / modification non.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'lotissements', element: <LotissementsListPage /> },
              { path: 'lotissements/:id', element: <LotissementDetailPage /> },
            ],
          },
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'lotissements/new', element: <LotissementFormPage /> },
              { path: 'lotissements/:id/edit', element: <LotissementFormPage /> },
            ],
          },

          // Terrains
          { path: 'terrains', element: <TerrainsListPage /> },
          { path: 'terrains/new', element: <TerrainFormPage /> },
          { path: 'terrains/:id', element: <TerrainDetailPage /> },
          { path: 'terrains/:id/edit', element: <TerrainFormPage /> },

          // Gestion des visiteurs — SUPER_ADMIN, ADMIN, ASSISTANTE_DIRECTION (accueil) + MANAGER.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION', 'MANAGER']} />,
            children: [
              { path: 'visitors', element: <VisitorsListPage /> },
              { path: 'visitors/new', element: <VisitorFormPage /> },
              { path: 'visitors/:id/edit', element: <VisitorFormPage /> },
            ],
          },
          // Objets de visite (configuration) — MANAGER exclu.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'visitors/objects', element: <VisitObjectsPage /> },
            ],
          },

          // Gestion des appels — SUPER_ADMIN, ADMIN, MANAGER, ASSISTANTE_DIRECTION, ACCOUNTANT.
          {
            element: (
              <RoleGuard
                allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'ACCOUNTANT']}
              />
            ),
            children: [
              { path: 'calls', element: <CallsListPage /> },
              { path: 'calls/new', element: <CallFormPage /> },
              { path: 'calls/:id/edit', element: <CallFormPage /> },
            ],
          },

          // Réseaux Sociaux & Plateformes Web — Tableau de bord & Plateformes :
          // SUPER_ADMIN, ADMIN, MANAGER uniquement (rôle exact côté IPC,
          // `checkExactRole` dans social-media.ipc.ts). ACCOUNTANT,
          // ASSISTANTE_DIRECTION et AGENT_TECHNIQUE en sont exclus (ACCOUNTANT
          // et ASSISTANTE_DIRECTION conservent l'accès à Publications &
          // articles ; ASSISTANTE_DIRECTION conserve aussi l'accès à Abonnés).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']} />,
            children: [
              { path: 'social-media', element: <SocialMediaDashboardPage /> },
              { path: 'social-media/dashboard', element: <SocialMediaDashboardPage /> },
              { path: 'social-media/platforms', element: <SocialPlatformsPage /> },
            ],
          },

          // Réseaux Sociaux & Plateformes Web — Publications & articles :
          // ouvert à tous les rôles à l'exception de READONLY.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'RH']} />,
            children: [
              { path: 'social-media/publications', element: <SocialPublicationsPage /> },
            ],
          },

          // Réseaux Sociaux & Plateformes Web — Abonnés : SUPER_ADMIN/ADMIN/MANAGER
          // + ASSISTANTE_DIRECTION + AGENT_TECHNIQUE (plein accès). ACCOUNTANT exclu
          // (rôle exact côté IPC, `checkExactRole`).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE']} />,
            children: [
              { path: 'social-media/followers', element: <SocialFollowersPage /> },
            ],
          },

          // Innovations IT (Module 16) — création/gestion réservée aux rôles
          // techniques (rôle exact côté IPC, `checkExactRole` dans
          // it-innovations.ipc.ts) : AGENT_TECHNIQUE (porteur, restreint à ses
          // propres innovations) + SUPER_ADMIN/ADMIN/MANAGER/RH (vue complète,
          // validation des phases réservée à SUPER_ADMIN/ADMIN/MANAGER).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RH', 'AGENT_TECHNIQUE']} />,
            children: [
              { path: 'innovations', element: <ItInnovationsListPage /> },
              { path: 'innovations/:id', element: <ItInnovationDetailPage /> },
            ],
          },

          // Programmes immobiliers — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'programmes', element: <ProgrammesListPage /> },
              { path: 'programmes/new', element: <ProgrammeFormPage /> },
              { path: 'programmes/:id', element: <ProgrammeDetailPage /> },
              { path: 'programmes/:id/edit', element: <ProgrammeFormPage /> },
            ],
          },

          // Projets — MANAGER+ (ACCOUNTANT, ASSISTANTE_DIRECTION) et AGENT_TECHNIQUE.
          // AGENT et READONLY n'ont pas accès.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE']} />,
            children: [
              { path: 'projects', element: <ProjectsListPage /> },
              { path: 'projects/new', element: <ProjectFormPage /> },
              { path: 'projects/:id', element: <ProjectDetailPage /> },
              { path: 'projects/:id/edit', element: <ProjectFormPage /> },
            ],
          },

          // Personnel & contrats — admins/RH + Comptable + MANAGER +
          // ASSISTANTE_DIRECTION (ces deux derniers filtrés côté IPC : limités
          // aux employés dont le contrat en cours n'est pas un CDI).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'hr/employees', element: <EmployeesListPage /> },
              { path: 'hr/employees/new', element: <EmployeeFormPage /> },
              { path: 'hr/employees/:id', element: <EmployeeDetailPage /> },
              { path: 'hr/employees/:id/edit', element: <EmployeeFormPage /> },
              { path: 'hr/contracts/:id/document', element: <ContractDocumentPage /> },
              { path: 'hr/contracts/:id/job-description', element: <JobDescriptionDocumentPage /> },
            ],
          },

          // Bulletins de paie — ASSISTANTE_DIRECTION EXCLUE (accès personnel/
          // contrats conservé ci-dessus, mais pas la paie). admins/RH + Comptable
          // + MANAGER (ce dernier filtré côté IPC).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER']} />,
            children: [
              { path: 'hr/payslips', element: <PayslipsListPage /> },
              { path: 'hr/payslips/:id', element: <PayslipDetailPage /> },
            ],
          },

          // Congés & absences — ASSISTANTE_DIRECTION conservée (accueil / secrétariat).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT', 'MANAGER', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'hr/leave', element: <LeaveRequestsPage /> },
            ],
          },

          // Pointage — Comptable EXCLU (accès RH complet sauf le pointage).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'hr/attendance', element: <AttendancePage /> },
            ],
          },

          // Performance — gestion opérationnelle (objectifs, évaluations,
          // classements) : admins, RH et MANAGER (ce dernier limité à son équipe
          // côté IPC). Le tableau de bord est exclu pour le MANAGER (voir groupe
          // ci-dessous).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH', 'MANAGER']} />,
            children: [
              { path: 'performance/objectives', element: <ObjectivesListPage /> },
              { path: 'performance/evaluations', element: <EvaluationsListPage /> },
              { path: 'performance/evaluations/:id', element: <EvaluationDetailPage /> },
              { path: 'performance/rankings', element: <RankingsPage /> },
            ],
          },

          // Performance — tableau de bord & configuration : admins & RH
          // uniquement (MANAGER exclu).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH']} />,
            children: [
              { path: 'performance', element: <PerformanceDashboardPage /> },
              { path: 'performance/dashboard', element: <PerformanceDashboardPage /> },
              { path: 'performance/settings', element: <PerformanceSettingsPage /> },
            ],
          },

          // RH & Paie — configuration : réservé aux admins, au rôle RH et au Comptable.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'RH', 'ACCOUNTANT']} />,
            children: [
              { path: 'hr/payroll-settings', element: <PayrollSettingsPage /> },
              { path: 'hr/templates', element: <HrTemplatesPage /> },
              { path: 'hr/contracts/templates/new', element: <ContractTemplateFormPage /> },
              { path: 'hr/contracts/templates/:id/edit', element: <ContractTemplateFormPage /> },
              { path: 'hr/job-descriptions/templates/new', element: <JobDescriptionTemplateFormPage /> },
              { path: 'hr/job-descriptions/templates/:id/edit', element: <JobDescriptionTemplateFormPage /> },
            ],
          },

          // Accounting — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          // ASSISTANTE_DIRECTION est explicitement exclue de ce module.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'accounting', element: <AccountingDashboardPage /> },
              { path: 'accounting/invoices', element: <InvoicesListPage /> },
              { path: 'accounting/invoices/new', element: <InvoiceFormPage /> },
              { path: 'accounting/invoices/:id', element: <InvoiceDetailPage /> },
              { path: 'accounting/installments', element: <InstallmentsPage /> },
              { path: 'accounting/bilan', element: <BilanPage /> },
            ],
          },

          // Budgets — ASSISTANTE_DIRECTION et READONLY exclus (pas d'accès au module).
          // Seul le tableau de bord est ouvert aux non-admin (ils n'y voient que leurs lignes).
          // Les listes/fiches/édition restent réservées aux admins.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'budgets', element: <BudgetDashboardPage /> },
            ],
          },
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']} />,
            children: [
              { path: 'budgets/list', element: <BudgetsListPage /> },
              { path: 'budgets/new', element: <BudgetFormPage /> },
              { path: 'budgets/:id', element: <BudgetDetailPage /> },
              { path: 'budgets/:id/edit', element: <BudgetFormPage /> },
              { path: 'budgets/:id/lines/new', element: <BudgetLineFormPage /> },
              { path: 'budgets/:id/lines/:lineId/edit', element: <BudgetLineFormPage /> },
            ],
          },

          // Trésorerie — ASSISTANTE_DIRECTION et READONLY exclus (pas d'accès au module).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'treasury', element: <TreasuryDashboardPage /> },
              { path: 'treasury/accounts/new', element: <AccountFormPage /> },
              { path: 'treasury/accounts/:id', element: <AccountDetailPage /> },
              { path: 'treasury/accounts/:id/edit', element: <AccountFormPage /> },
              { path: 'treasury/operations/new', element: <OperationFormPage /> },
            ],
          },

          // Commissions — lecture ouverte à tous (vue filtrée pour les rôles non privilégiés).
          { path: 'commissions', element: <CommissionsDashboardPage /> },
          { path: 'commissions/all', element: <CommissionsListPage /> },
          { path: 'commissions/beneficiary/:type/:id', element: <BeneficiaryCommissionsPage /> },
          // Consultation des apporteurs : ouverte à tout rôle authentifié — vue
          // complète pour SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT, restreinte aux
          // apporteurs dont l'utilisateur est le référent pour les autres rôles
          // (filtrage appliqué côté IPC, cf. commissions.ipc.ts).
          { path: 'commissions/referrers', element: <ReferrersListPage /> },
          { path: 'commissions/referrers/:id', element: <ReferrerDetailPage /> },
          { path: 'commissions/referrers/:id/timeline', element: <ReferrerTimelinePage /> },
          // Création / modification (commissions + apporteurs) : strictement
          // réservée aux ADMIN / SUPER_ADMIN / MANAGER / ACCOUNTANT.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']} />,
            children: [
              { path: 'commissions/new', element: <CommissionFormPage /> },
              { path: 'commissions/referrers/new', element: <ReferrerFormPage /> },
              { path: 'commissions/referrers/:id/edit', element: <ReferrerFormPage /> },
            ],
          },

          // Charges / dépenses prévisionnelles — ADMIN, MANAGER, COMPTABLE,
          // ASSISTANTE_DIRECTION (MANAGER et ASSISTANTE_DIRECTION ne voient que
          // leurs propres charges, filtrage appliqué côté IPC).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'expenses', element: <ExpensesListPage /> },
              { path: 'expenses/new', element: <ExpenseFormPage /> },
              { path: 'expenses/:id/edit', element: <ExpenseFormPage /> },
            ],
          },

          // Analyses décisionnelles (BI) — administrateurs uniquement, sauf
          // CRM & Clients / Suivi Prospects & Clients / Statistiques visiteurs
          // ouverts également en plein accès au rôle MANAGER (décision produit).
          // Restructuré en sous-menus (barre latérale) au lieu de volets dans
          // une seule page : une route dédiée par rubrique.
          { path: 'analytics', element: <Navigate to="/analytics/executive" replace /> },
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']} />,
            children: [
              { path: 'analytics/executive', element: <AnalyticsExecutivePage /> },
              { path: 'analytics/financial', element: <AnalyticsFinancialPage /> },
              { path: 'analytics/portfolio', element: <AnalyticsPortfolioPage /> },
              { path: 'analytics/charges', element: <AnalyticsChargesPage /> },
              { path: 'analytics/contracts', element: <AnalyticsContractsPage /> },
              { path: 'analytics/risk', element: <AnalyticsRiskPage /> },
              { path: 'analytics/recommendations', element: <AnalyticsRecommendationsPage /> },
            ],
          },
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']} />,
            children: [
              { path: 'analytics/crm', element: <AnalyticsCrmPage /> },
              { path: 'analytics/visitors', element: <AnalyticsVisitorsPage /> },
              { path: 'analytics/calls', element: <AnalyticsCallsPage /> },
            ],
          },
          // Suivi Prospects & Clients : plein accès SUPER_ADMIN/ADMIN/MANAGER,
          // accès restreint (périmètre affecté, sans export/impression) pour
          // AGENT, AGENT_TECHNIQUE, ACCOUNTANT, ASSISTANTE_DIRECTION, READONLY.
          {
            element: (
              <RoleGuard
                allowedRoles={[
                  'SUPER_ADMIN', 'ADMIN', 'MANAGER',
                  'AGENT', 'AGENT_TECHNIQUE', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'READONLY',
                ]}
              />
            ),
            children: [
              { path: 'analytics/followup', element: <AnalyticsFollowUpPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
