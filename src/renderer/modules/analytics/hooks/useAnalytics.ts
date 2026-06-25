import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = () => window.electron.analytics;
const token = () => useAuthStore.getState().token!;

function make(key: string, fn: (t: string) => Promise<any>) {
  return () => useQuery({ queryKey: ['analytics', key], queryFn: () => fn(token()) });
}

export const useExecutiveAnalytics = make('executive', (t) => ipc().executive(t));
export const useFinancialAnalytics = make('financial', (t) => ipc().financial(t));
export const usePortfolioAnalytics = make('portfolio', (t) => ipc().portfolio(t));
export const useCrmAnalytics = make('crm', (t) => ipc().crm(t));
export const useChargesAnalytics = make('charges', (t) => ipc().charges(t));
export const useContractsAnalytics = make('contracts', (t) => ipc().contracts(t));
export const useRiskAnalytics = make('risk', (t) => ipc().risk(t));
export const useRecommendations = make('recommendations', (t) => ipc().recommendations(t));
