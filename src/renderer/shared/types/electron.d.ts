interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  total?: number;
  error?: string | object;
}

interface Window {
  electron: {
    auth: {
      login: (email: string, password: string) => Promise<IpcResponse<{ user: any; token: string }>>;
      logout: (token: string) => Promise<IpcResponse>;
      me: (token: string) => Promise<IpcResponse<any>>;
      changePassword: (token: string, current: string, next: string) => Promise<IpcResponse>;
    };
    users: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      resetPassword: (token: string, id: number, newPassword: string) => Promise<IpcResponse>;
      toggleActive: (token: string, id: number) => Promise<IpcResponse<any>>;
    };
    prospects: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      updateStatus: (token: string, id: number, status: string) => Promise<IpcResponse<any>>;
      convertToClient: (token: string, id: number, clientData?: object) => Promise<IpcResponse<any>>;
      kanban: (token: string) => Promise<IpcResponse<Record<string, any[]>>>;
    };
    clients: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      toggleActive: (token: string, id: number) => Promise<IpcResponse<any>>;
      updateStatus: (token: string, id: number, status: string) => Promise<IpcResponse<any>>;
    };
    owners: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      portfolio: (token: string, id: number) => Promise<IpcResponse<any>>;
    };
    properties: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      updateStatus: (token: string, id: number, status: string) => Promise<IpcResponse<any>>;
    };
    contracts: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      generateInstallments: (token: string, id: number) => Promise<IpcResponse<any[]>>;
      getInstallments: (token: string, contractId: number) => Promise<IpcResponse<any[]>>;
    };
    communication: {
      listTemplates: (token: string, channel?: string) => Promise<IpcResponse<any[]>>;
      getTemplate: (token: string, id: number) => Promise<IpcResponse<any>>;
      createTemplate: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateTemplate: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteTemplate: (token: string, id: number) => Promise<IpcResponse>;
      getHistory: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      sendEmail: (token: string, payload: object) => Promise<IpcResponse<any>>;
      sendSms: (token: string, payload: object) => Promise<IpcResponse<any>>;
    };
    crm: {
      listActivities: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getActivity: (token: string, id: number) => Promise<IpcResponse<any>>;
      createActivity: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateActivity: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteActivity: (token: string, id: number) => Promise<IpcResponse>;
      completeActivity: (token: string, id: number) => Promise<IpcResponse<any>>;
      getStats: (token: string) => Promise<IpcResponse<any>>;
    };
    archiving: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      archive: (token: string, payload: object) => Promise<IpcResponse<any>>;
      restore: (token: string, id: number) => Promise<IpcResponse<any>>;
      permanentDelete: (token: string, id: number) => Promise<IpcResponse>;
      getStats: (token: string) => Promise<IpcResponse<any>>;
      listPolicies: (token: string) => Promise<IpcResponse<any[]>>;
      createPolicy: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updatePolicy: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deletePolicy: (token: string, id: number) => Promise<IpcResponse>;
    };
    documents: {
      uploadIdDocument: (token: string, clientId: number, payload: object) => Promise<IpcResponse<any>>;
      getByClient: (token: string, clientId: number) => Promise<IpcResponse<any[]>>;
      uploadOwnerDoc: (token: string, ownerId: number, category: string, payload: object) => Promise<IpcResponse<any>>;
      getByOwner: (token: string, ownerId: number) => Promise<IpcResponse<any[]>>;
      uploadTerrainDoc: (token: string, terrainId: number, category: string, payload: object) => Promise<IpcResponse<any>>;
      getByTerrain: (token: string, terrainId: number) => Promise<IpcResponse<any[]>>;
      openFile: (token: string, relativePath: string) => Promise<IpcResponse>;
    };
    lotissements: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
    };
    terrains: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      updateStatut: (token: string, id: number, statut: string) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
    };
    geo: {
      resolveMapLink: (
        token: string,
        link: string,
      ) => Promise<IpcResponse<{ latitude: number; longitude: number }>>;
    };
    accounting: {
      getDashboard: (token: string) => Promise<IpcResponse<any>>;
      getInvoices: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getInvoiceById: (token: string, id: number) => Promise<IpcResponse<any>>;
      createInvoice: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateInvoiceStatus: (token: string, id: number, status: string) => Promise<IpcResponse<any>>;
      addPayment: (token: string, invoiceId: number, payload: object) => Promise<IpcResponse<any>>;
      getOverdueInstallments: (token: string) => Promise<IpcResponse<any[]>>;
      getUpcomingInstallments: (token: string, days?: number) => Promise<IpcResponse<any[]>>;
      payInstallment: (token: string, installmentId: number, payload: object) => Promise<IpcResponse<any>>;
      getSaleContracts: (token: string) => Promise<IpcResponse<any[]>>;
    };
    commissions: {
      getDashboard: (token: string) => Promise<IpcResponse<any>>;
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      pay: (token: string, payload: object) => Promise<IpcResponse<any>>;
      cancel: (token: string, payload: object) => Promise<IpcResponse<any>>;
      getBeneficiarySummary: (token: string, beneficiaryType: string, beneficiaryId: number) => Promise<IpcResponse<any>>;
      listReferrers: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getReferrerById: (token: string, id: number) => Promise<IpcResponse<any>>;
      createReferrer: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateReferrer: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteReferrer: (token: string, id: number) => Promise<IpcResponse>;
      listUsers: (token: string) => Promise<IpcResponse<any[]>>;
      listEligibleContracts: (token: string) => Promise<IpcResponse<any[]>>;
      getSettings: (token: string) => Promise<IpcResponse<any>>;
      updateSettings: (token: string, payload: object) => Promise<IpcResponse<any>>;
    };
  };
}
