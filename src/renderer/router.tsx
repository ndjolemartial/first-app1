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

// Clients
import ClientsListPage from './modules/clients/pages/ClientsListPage';
import ClientFormPage from './modules/clients/pages/ClientFormPage';
import ClientDetailPage from './modules/clients/pages/ClientDetailPage';

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
import ConventionTemplatesListPage from './modules/conventions/pages/ConventionTemplatesListPage';
import ConventionTemplateFormPage from './modules/conventions/pages/ConventionTemplateFormPage';
import ConventionDocumentPage from './modules/conventions/pages/ConventionDocumentPage';

// Communication
import CommunicationPage from './modules/communication/pages/CommunicationPage';
import TemplatesPage from './modules/communication/pages/TemplatesPage';
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
import InvoiceTemplatesPage from './modules/accounting/pages/InvoiceTemplatesPage';

// Lotissements
import LotissementsListPage from './modules/lotissements/pages/LotissementsListPage';
import LotissementFormPage from './modules/lotissements/pages/LotissementFormPage';
import LotissementDetailPage from './modules/lotissements/pages/LotissementDetailPage';

// Terrains
import TerrainsListPage from './modules/terrains/pages/TerrainsListPage';
import TerrainFormPage from './modules/terrains/pages/TerrainFormPage';
import TerrainDetailPage from './modules/terrains/pages/TerrainDetailPage';

// Programmes immobiliers
import ProgrammesListPage from './modules/programmes/pages/ProgrammesListPage';
import ProgrammeFormPage from './modules/programmes/pages/ProgrammeFormPage';
import ProgrammeDetailPage from './modules/programmes/pages/ProgrammeDetailPage';

// Commissions
import CommissionsDashboardPage from './modules/commissions/pages/CommissionsDashboardPage';
import CommissionsListPage from './modules/commissions/pages/CommissionsListPage';
import CommissionFormPage from './modules/commissions/pages/CommissionFormPage';
import BeneficiaryCommissionsPage from './modules/commissions/pages/BeneficiaryCommissionsPage';
import ReferrersListPage from './modules/commissions/pages/ReferrersListPage';
import ReferrerFormPage from './modules/commissions/pages/ReferrerFormPage';

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
import CategoriesPage from './modules/treasury/pages/CategoriesPage';

// Dashboard placeholder
import DashboardPage from './modules/dashboard/DashboardPage';

// Settings (paramétrage de l'application)
import SettingsPage from './modules/settings/pages/SettingsPage';

export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
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

          // Users — réservé aux ADMIN / SUPER_ADMIN
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']} />,
            children: [
              { path: 'users', element: <UsersListPage /> },
              { path: 'users/new', element: <UserFormPage /> },
              { path: 'users/:id', element: <UserDetailPage /> },
              { path: 'users/:id/edit', element: <UserFormPage /> },
            ],
          },

          // Paramètres applicatifs — réservé aux ADMIN / SUPER_ADMIN
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN']} />,
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

          // Clients
          { path: 'clients', element: <ClientsListPage /> },
          { path: 'clients/new', element: <ClientFormPage /> },
          { path: 'clients/:id', element: <ClientDetailPage /> },
          { path: 'clients/:id/edit', element: <ClientFormPage /> },

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

          // Conventions — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'conventions', element: <ConventionsListPage /> },
              { path: 'conventions/new', element: <ConventionFormPage /> },
              { path: 'conventions/templates', element: <ConventionTemplatesListPage /> },
              { path: 'conventions/templates/new', element: <ConventionTemplateFormPage /> },
              { path: 'conventions/templates/:id/edit', element: <ConventionTemplateFormPage /> },
              { path: 'conventions/:id', element: <ConventionDetailPage /> },
              { path: 'conventions/:id/edit', element: <ConventionFormPage /> },
              { path: 'conventions/:id/document', element: <ConventionDocumentPage /> },
            ],
          },

          // Communication
          { path: 'communication', element: <CommunicationPage /> },
          { path: 'communication/templates', element: <TemplatesPage /> },
          { path: 'communication/send', element: <SendMessagePage /> },

          // CRM
          { path: 'crm', element: <CrmPage /> },
          { path: 'crm/activities/new', element: <ActivityFormPage /> },
          { path: 'crm/activities/:id/edit', element: <ActivityFormPage /> },

          // Archiving — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              // L'accès au module ouvre le tableau de bord GED
              { path: 'archiving', element: <Navigate to="/archiving/ged/dashboard" replace /> },
              { path: 'archiving/entities', element: <ArchivingPage /> },
              { path: 'archiving/policies', element: <ArchivePoliciesPage /> },
              { path: 'archiving/ged', element: <GedDocumentsPage /> },
              { path: 'archiving/ged/dashboard', element: <GedDashboardPage /> },
              { path: 'archiving/ged/settings', element: <GedSettingsPage /> },
              { path: 'archiving/ged/:id', element: <GedDocumentDetailPage /> },
            ],
          },

          // Lotissements — réservé aux MANAGER+ (ACCOUNTANT inclus). AGENT/READONLY n'ont pas accès.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'lotissements', element: <LotissementsListPage /> },
              { path: 'lotissements/new', element: <LotissementFormPage /> },
              { path: 'lotissements/:id', element: <LotissementDetailPage /> },
              { path: 'lotissements/:id/edit', element: <LotissementFormPage /> },
            ],
          },

          // Terrains
          { path: 'terrains', element: <TerrainsListPage /> },
          { path: 'terrains/new', element: <TerrainFormPage /> },
          { path: 'terrains/:id', element: <TerrainDetailPage /> },
          { path: 'terrains/:id/edit', element: <TerrainFormPage /> },

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
              { path: 'accounting/invoice-templates', element: <InvoiceTemplatesPage /> },
            ],
          },

          // Budgets — ASSISTANTE_DIRECTION exclue (pas d'accès au module).
          // Seul le tableau de bord est ouvert aux non-admin (ils n'y voient que leurs lignes).
          // Les listes/fiches/édition restent réservées aux admins.
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY']} />,
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

          // Trésorerie — ASSISTANTE_DIRECTION exclue (pas d'accès au module).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY']} />,
            children: [
              { path: 'treasury', element: <TreasuryDashboardPage /> },
              { path: 'treasury/accounts/new', element: <AccountFormPage /> },
              { path: 'treasury/accounts/:id', element: <AccountDetailPage /> },
              { path: 'treasury/accounts/:id/edit', element: <AccountFormPage /> },
              { path: 'treasury/operations/new', element: <OperationFormPage /> },
              { path: 'treasury/categories', element: <CategoriesPage /> },
            ],
          },

          // Commissions — lecture ouverte à tous (vue filtrée pour les rôles non privilégiés).
          { path: 'commissions', element: <CommissionsDashboardPage /> },
          { path: 'commissions/all', element: <CommissionsListPage /> },
          { path: 'commissions/beneficiary/:type/:id', element: <BeneficiaryCommissionsPage /> },
          // Consultation des apporteurs : ouverte aussi à ASSISTANTE_DIRECTION (lecture seule).
          {
            element: <RoleGuard allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION']} />,
            children: [
              { path: 'commissions/referrers', element: <ReferrersListPage /> },
            ],
          },
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
        ],
      },
    ],
  },
]);
