interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  total?: number;
  error?: string | object;
}

interface Window {
  electron: {
    auth: {
      login: (identifier: string, password: string) => Promise<IpcResponse<{ user: any; token: string }>>;
      logout: (token: string) => Promise<IpcResponse>;
      me: (token: string) => Promise<IpcResponse<any>>;
      changePassword: (token: string, current: string, next: string) => Promise<IpcResponse>;
      updateProfile: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateTheme: (token: string, theme: string) => Promise<IpcResponse<any>>;
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
      assign: (token: string, id: number, assignedToId: number | null) => Promise<IpcResponse<any>>;
      listAssignableUsers: (token: string) => Promise<IpcResponse<Array<{
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
      }>>>;
    };
    clients: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      toggleActive: (token: string, id: number) => Promise<IpcResponse<any>>;
      updateStatus: (token: string, id: number, status: string) => Promise<IpcResponse<any>>;
      assign: (token: string, id: number, assignedToId: number | null) => Promise<IpcResponse<any>>;
      setReferrer: (token: string, id: number, referrerId: number | null) => Promise<IpcResponse<any>>;
      listAssignableUsers: (token: string) => Promise<IpcResponse<Array<{
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
      }>>>;
      listReferrers: (token: string) => Promise<IpcResponse<Array<{
        id: number;
        firstName: string;
        lastName: string;
        companyName: string | null;
        email: string | null;
      }>>>;
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
      statusStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
    };
    conventions: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      generateInstallments: (token: string, id: number) => Promise<IpcResponse<any[]>>;
      getInstallments: (token: string, conventionId: number) => Promise<IpcResponse<any[]>>;
      updateInstallments: (
        token: string,
        conventionId: number,
        installments: { id: number; dueDate: string; amount: number }[],
      ) => Promise<IpcResponse<any[]>>;
      statusStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
    };
    conventionTemplates: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
    };
    attestationTemplates: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
    };
    attestations: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      typeStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
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
      // GED
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      import: (token: string, payload: object) => Promise<IpcResponse<any[]>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      remove: (token: string, id: number) => Promise<IpcResponse>;
      open: (token: string, id: number) => Promise<IpcResponse>;
      getFileData: (token: string, id: number) => Promise<IpcResponse<{ base64?: string; mimeType: string; name: string; tooLarge?: boolean }>>;
      listCategories: (token: string) => Promise<IpcResponse<any[]>>;
      createCategory: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateCategory: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteCategory: (token: string, id: number) => Promise<IpcResponse>;
      listFolders: (token: string) => Promise<IpcResponse<any[]>>;
      createFolder: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateFolder: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteFolder: (token: string, id: number) => Promise<IpcResponse>;
      listTags: (token: string) => Promise<IpcResponse<any[]>>;
      createTag: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateTag: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteTag: (token: string, id: number) => Promise<IpcResponse>;
      listAudit: (token: string, limit?: number) => Promise<IpcResponse<any[]>>;
      gedDashboard: (token: string) => Promise<IpcResponse<any>>;
      pathForFile: (file: File) => string;
    };
    lotissements: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      statusStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
    };
    terrains: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      updateStatut: (token: string, id: number, statut: string) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      statusStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
      generateAcdInvoices: (token: string, id: number) => Promise<IpcResponse<{ count: number }>>;
      cancelAcdInvoices: (token: string, id: number) => Promise<IpcResponse<{ cancelled: number }>>;
      updateAcdInvoices: (
        token: string,
        terrainId: number,
        invoices: { id: number; dueDate: string; amount: number }[],
      ) => Promise<IpcResponse<any[]>>;
    };
    programmes: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      statusStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
    };
    projects: {
      list: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      statusStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
      listTypes: (token: string, includeInactive?: boolean) => Promise<IpcResponse<any[]>>;
      createType: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateType: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteType: (token: string, id: number) => Promise<IpcResponse>;
    };
    geo: {
      resolveMapLink: (
        token: string,
        link: string,
      ) => Promise<IpcResponse<{ latitude: number; longitude: number }>>;
    };
    countries: {
      list: (
        token: string,
      ) => Promise<IpcResponse<{ id: number; isoCode: string; name: string; dialCode: string }[]>>;
    };
    exporter: {
      generate: (
        token: string,
        payload: {
          format: 'pdf' | 'xlsx';
          fileName: string;
          title: string;
          subtitle?: string;
          headers: string[];
          rows: string[][];
          totalRow?: string[];
        },
      ) => Promise<IpcResponse<{ path?: string; canceled?: boolean }>>;
    };
    documentExport: {
      exportDocumentPdf: (
        token: string,
        payload: {
          fileName: string;
          bodyHtml: string;
          headerTemplate: string;
          footerTemplate: string;
          headerMm: number;
          footerMm: number;
        },
      ) => Promise<IpcResponse<{ filePath?: string; canceled?: boolean }>>;
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
      ) => Promise<IpcResponse<{ filePath?: string; canceled?: boolean }>>;
    };
    invoiceTemplates: {
      list: (
        token: string,
      ) => Promise<IpcResponse<{ templates: any[]; defaults: Record<string, number> }>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      setDefaults: (
        token: string,
        defaults: Record<string, number>,
      ) => Promise<IpcResponse<Record<string, number>>>;
    };
    accounting: {
      getDashboard: (token: string) => Promise<IpcResponse<any>>;
      getRevenue: (
        token: string,
        period: string,
      ) => Promise<IpcResponse<{ revenue: number; count: number; label: string; byType: Record<string, number> }>>;
      getInvoices: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]>>;
      getInvoiceTypeStats: (token: string, filters?: object) => Promise<IpcResponse<Record<string, number>>>;
      getInvoiceById: (token: string, id: number) => Promise<IpcResponse<any>>;
      createInvoice: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateInvoiceStatus: (token: string, id: number, status: string) => Promise<IpcResponse<any>>;
      reinstateInvoice: (token: string, id: number) => Promise<IpcResponse<{ id: number; status: string; reference: string }>>;
      addPayment: (token: string, invoiceId: number, payload: object) => Promise<IpcResponse<any>>;
      getOverdueInstallments: (token: string) => Promise<IpcResponse<any[]>>;
      getUnpaidInstallments: (token: string) => Promise<IpcResponse<any[]>>;
      getUpcomingInstallments: (token: string, days?: number) => Promise<IpcResponse<any[]>>;
      getPaidInstallments: (token: string, year?: number, semester?: number) => Promise<IpcResponse<any[]>>;
      getCancelledInstallments: (token: string) => Promise<IpcResponse<any[]>>;
      listInstallments: (token: string) => Promise<IpcResponse<any[]>>;
      payInstallment: (token: string, installmentId: number, payload: object) => Promise<IpcResponse<any>>;
      cancelInstallment: (token: string, installmentId: number) => Promise<IpcResponse<any>>;
      reinstateInstallment: (token: string, installmentId: number) => Promise<IpcResponse<any>>;
      printInvoice: (
        token: string,
        invoiceId: number,
      ) => Promise<IpcResponse<{ path?: string; canceled?: boolean }>>;
      getSaleConventions: (token: string) => Promise<IpcResponse<any[]>>;
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
      listEligibleConventions: (token: string) => Promise<IpcResponse<any[]>>;
      getSettings: (token: string) => Promise<IpcResponse<any>>;
      updateSettings: (token: string, payload: object) => Promise<IpcResponse<any>>;
    };
    treasury: {
      getDashboard: (token: string) => Promise<IpcResponse<any>>;
      listAccounts: (token: string, filters?: object) => Promise<IpcResponse<any[]>>;
      getAccountById: (token: string, id: number) => Promise<IpcResponse<any>>;
      createAccount: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateAccount: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteAccount: (token: string, id: number) => Promise<IpcResponse>;
      listOperations: (token: string, filters?: object, page?: number, limit?: number) => Promise<IpcResponse<any[]> & { totalEntree?: number; totalSortie?: number }>;
      createOperation: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateOperation: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteOperation: (token: string, id: number) => Promise<IpcResponse>;
      getEntityCashflow: (
        token: string,
        entityType: 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME',
        entityId: number,
        limit?: number,
      ) => Promise<IpcResponse<{
        operations: any[];
        totalEntree: number;
        totalSortie: number;
        net: number;
        count: number;
      }>>;
      listCategories: (token: string, filters?: object) => Promise<IpcResponse<any[]>>;
      createCategory: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateCategory: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteCategory: (token: string, id: number) => Promise<IpcResponse>;
      listUsers: (token: string) => Promise<IpcResponse<any[]>>;
    };
    dashboard: {
      getStats: (token: string) => Promise<
        IpcResponse<{
          isPrivileged: boolean;
          counts: {
            prospects: number;
            clients: number | null;
            owners: number | null;
            availableTerrains: number | null;
            availableProperties: number | null;
            lotissements: number | null;
            programmes: number | null;
          };
          slideshow: Array<{
            type: 'image' | 'video';
            src: string;
            caption?: string;
            durationMs?: number;
          }>;
        }>
      >;
    };
    settings: {
      // Entreprise
      getCompany: (token: string) => Promise<IpcResponse<{
        name: string;
        slogan: string;
        logoPath: string;
        registreCommerce: string;
        compteContribuable: string;
      }>>;
      updateCompany: (token: string, payload: object) => Promise<IpcResponse>;
      uploadLogo: (token: string, payload: { fileName: string; fileType: string; fileSize: number; fileData: string }) =>
        Promise<IpcResponse<{ relativePath: string }>>;
      deleteLogo: (token: string) => Promise<IpcResponse>;
      getLogoData: (token: string) => Promise<IpcResponse<{ base64: string; mimeType: string } | null>>;

      // Stockage
      getStorage: (token: string) => Promise<IpcResponse<{
        path: string;
        maxFileSizeMb: number;
        resolvedPath: string;
      }>>;
      updateStorage: (token: string, payload: object) => Promise<IpcResponse>;

      // Email SMTP
      getEmail: (token: string) => Promise<IpcResponse<{
        host: string; port: number; secure: boolean;
        user: string; password: string; passwordSet: boolean;
        fromAddress: string; fromName: string;
      }>>;
      updateEmail: (token: string, payload: object) => Promise<IpcResponse>;
      testEmail: (token: string, to: string) => Promise<IpcResponse<{ ok: true; messageId?: string }>>;

      // SMS
      getSms: (token: string) => Promise<IpcResponse<{
        provider: string;
        accountSid: string; authToken: string; authTokenSet: boolean;
        from: string;
        apiLogin: string; apiPassword: string; apiPasswordSet: boolean;
      }>>;
      updateSms: (token: string, payload: object) => Promise<IpcResponse>;
      testSms: (token: string, to: string) => Promise<IpcResponse<{ ok: true }>>;

      // Slideshow
      getSlideshow: (token: string) => Promise<IpcResponse<Array<{
        type: 'image' | 'video';
        src: string;
        caption?: string;
        durationMs?: number;
      }>>>;
      updateSlideshow: (token: string, items: object[]) => Promise<IpcResponse>;
      uploadSlideshowMedia: (token: string, payload: { fileName: string; fileType: string; fileSize: number; fileData: string }) =>
        Promise<IpcResponse<{ relativePath: string; type: 'image' | 'video' }>>;
      getSlideshowMediaData: (token: string, relativePath: string) =>
        Promise<IpcResponse<{ base64: string; mimeType: string }>>;
      getSlideshowVisibility: (token: string) =>
        Promise<IpcResponse<{ allowedRoles: string[] }>>;
      updateSlideshowVisibility: (
        token: string,
        payload: { allowedRoles: string[] },
      ) => Promise<IpcResponse>;
      // Types de pièces d'identité (catalogue extensible)
      listIdTypes: (token: string, includeInactive?: boolean) => Promise<IpcResponse<any[]>>;
      createIdType: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateIdType: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteIdType: (token: string, id: number) => Promise<IpcResponse>;
      // Natures de titres de lotissement
      listTitleTypes: (token: string, includeInactive?: boolean) => Promise<IpcResponse<any[]>>;
      createTitleType: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateTitleType: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      deleteTitleType: (token: string, id: number) => Promise<IpcResponse>;
    };
    budget: {
      getDashboard: (token: string) => Promise<IpcResponse<any>>;
      list: (token: string, filters?: object) => Promise<IpcResponse<any[]>>;
      getById: (token: string, id: number) => Promise<IpcResponse<any>>;
      create: (token: string, payload: object) => Promise<IpcResponse<any>>;
      update: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      close: (token: string, id: number) => Promise<IpcResponse<any>>;
      reopen: (token: string, id: number) => Promise<IpcResponse<any>>;
      delete: (token: string, id: number) => Promise<IpcResponse>;
      listLines: (token: string, filters?: object) => Promise<IpcResponse<any[]>>;
      getLineById: (token: string, id: number) => Promise<IpcResponse<any>>;
      createLine: (token: string, payload: object) => Promise<IpcResponse<any>>;
      updateLine: (token: string, id: number, payload: object) => Promise<IpcResponse<any>>;
      toggleLineActive: (token: string, id: number) => Promise<IpcResponse<any>>;
      deleteLine: (token: string, id: number) => Promise<IpcResponse>;
      listEligibleManagers: (token: string) => Promise<IpcResponse<any[]>>;
      listAccessibleLines: (token: string) => Promise<IpcResponse<any[]>>;
    };
  };
}
