import { createHashRouter } from 'react-router-dom';
import App from './App';
import LoginPage from './modules/auth/LoginPage';
import ProtectedLayout from './shared/components/layout/ProtectedLayout';

// Users
import UsersListPage from './modules/users/pages/UsersListPage';
import UserFormPage from './modules/users/pages/UserFormPage';
import UserDetailPage from './modules/users/pages/UserDetailPage';

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

// Contracts
import ContractsListPage from './modules/contracts/pages/ContractsListPage';
import ContractFormPage from './modules/contracts/pages/ContractFormPage';
import ContractDetailPage from './modules/contracts/pages/ContractDetailPage';

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

// Accounting
import AccountingDashboardPage from './modules/accounting/pages/AccountingDashboardPage';
import InvoicesListPage from './modules/accounting/pages/InvoicesListPage';
import InvoiceFormPage from './modules/accounting/pages/InvoiceFormPage';
import InvoiceDetailPage from './modules/accounting/pages/InvoiceDetailPage';
import InstallmentsPage from './modules/accounting/pages/InstallmentsPage';

// Lotissements
import LotissementsListPage from './modules/lotissements/pages/LotissementsListPage';
import LotissementFormPage from './modules/lotissements/pages/LotissementFormPage';
import LotissementDetailPage from './modules/lotissements/pages/LotissementDetailPage';

// Terrains
import TerrainsListPage from './modules/terrains/pages/TerrainsListPage';
import TerrainFormPage from './modules/terrains/pages/TerrainFormPage';
import TerrainDetailPage from './modules/terrains/pages/TerrainDetailPage';

// Commissions
import CommissionsDashboardPage from './modules/commissions/pages/CommissionsDashboardPage';
import CommissionsListPage from './modules/commissions/pages/CommissionsListPage';
import CommissionFormPage from './modules/commissions/pages/CommissionFormPage';
import BeneficiaryCommissionsPage from './modules/commissions/pages/BeneficiaryCommissionsPage';
import ReferrersListPage from './modules/commissions/pages/ReferrersListPage';
import ReferrerFormPage from './modules/commissions/pages/ReferrerFormPage';

// Dashboard placeholder
import DashboardPage from './modules/dashboard/DashboardPage';

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

          // Users
          { path: 'users', element: <UsersListPage /> },
          { path: 'users/new', element: <UserFormPage /> },
          { path: 'users/:id', element: <UserDetailPage /> },
          { path: 'users/:id/edit', element: <UserFormPage /> },

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

          // Owners
          { path: 'owners', element: <OwnersListPage /> },
          { path: 'owners/new', element: <OwnerFormPage /> },
          { path: 'owners/:id', element: <OwnerDetailPage /> },
          { path: 'owners/:id/edit', element: <OwnerFormPage /> },

          // Properties
          { path: 'properties', element: <PropertiesListPage /> },
          { path: 'properties/new', element: <PropertyFormPage /> },
          { path: 'properties/:id', element: <PropertyDetailPage /> },
          { path: 'properties/:id/edit', element: <PropertyFormPage /> },

          // Contracts
          { path: 'contracts', element: <ContractsListPage /> },
          { path: 'contracts/new', element: <ContractFormPage /> },
          { path: 'contracts/:id', element: <ContractDetailPage /> },
          { path: 'contracts/:id/edit', element: <ContractFormPage /> },

          // Communication
          { path: 'communication', element: <CommunicationPage /> },
          { path: 'communication/templates', element: <TemplatesPage /> },
          { path: 'communication/send', element: <SendMessagePage /> },

          // CRM
          { path: 'crm', element: <CrmPage /> },
          { path: 'crm/activities/new', element: <ActivityFormPage /> },
          { path: 'crm/activities/:id/edit', element: <ActivityFormPage /> },

          // Archiving
          { path: 'archiving', element: <ArchivingPage /> },
          { path: 'archiving/policies', element: <ArchivePoliciesPage /> },

          // Lotissements
          { path: 'lotissements', element: <LotissementsListPage /> },
          { path: 'lotissements/new', element: <LotissementFormPage /> },
          { path: 'lotissements/:id', element: <LotissementDetailPage /> },
          { path: 'lotissements/:id/edit', element: <LotissementFormPage /> },

          // Terrains
          { path: 'terrains', element: <TerrainsListPage /> },
          { path: 'terrains/new', element: <TerrainFormPage /> },
          { path: 'terrains/:id', element: <TerrainDetailPage /> },
          { path: 'terrains/:id/edit', element: <TerrainFormPage /> },

          // Accounting
          { path: 'accounting', element: <AccountingDashboardPage /> },
          { path: 'accounting/invoices', element: <InvoicesListPage /> },
          { path: 'accounting/invoices/new', element: <InvoiceFormPage /> },
          { path: 'accounting/invoices/:id', element: <InvoiceDetailPage /> },
          { path: 'accounting/installments', element: <InstallmentsPage /> },

          // Commissions
          { path: 'commissions', element: <CommissionsDashboardPage /> },
          { path: 'commissions/all', element: <CommissionsListPage /> },
          { path: 'commissions/new', element: <CommissionFormPage /> },
          { path: 'commissions/beneficiary/:type/:id', element: <BeneficiaryCommissionsPage /> },
          { path: 'commissions/referrers', element: <ReferrersListPage /> },
          { path: 'commissions/referrers/new', element: <ReferrerFormPage /> },
          { path: 'commissions/referrers/:id/edit', element: <ReferrerFormPage /> },
        ],
      },
    ],
  },
]);
