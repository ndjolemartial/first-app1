// Types du module Réseaux Sociaux & Plateformes Web (Module 15).

export type SocialPlatformType =
  | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'X_TWITTER' | 'YOUTUBE' | 'WEBSITE' | 'AUTRE';

export type SocialPublicationType = 'PUBLICATION' | 'ARTICLE';

export const PLATFORM_TYPE_LABEL: Record<SocialPlatformType, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  TIKTOK: 'TikTok',
  X_TWITTER: 'X (Twitter)',
  YOUTUBE: 'YouTube',
  WEBSITE: 'Site web',
  AUTRE: 'Autre',
};

export const PUBLICATION_TYPE_LABEL: Record<SocialPublicationType, string> = {
  PUBLICATION: 'Publication',
  ARTICLE: 'Article',
};

export interface SocialPlatform {
  id: number;
  uuid: string;
  name: string;
  type: SocialPlatformType;
  url: string | null;
  responsibleId: number | null;
  responsible?: { id: number; firstName: string; lastName: string } | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { publications: number };
}

export interface SocialPublication {
  id: number;
  uuid: string;
  platformId: number;
  platform?: { id: number; name: string; type: SocialPlatformType };
  type: SocialPublicationType;
  title: string;
  publishedAt: string;
  url: string | null;
  viewsCount: number;
  interactionsCount: number;
  authorId: number | null;
  author?: { id: number; firstName: string; lastName: string } | null;
  notes: string | null;
  createdAt: string;
  attachments?: Array<{ id: number; name: string; numeroArchive: string | null }>;
}

export interface SocialFollowerSnapshot {
  id: number;
  platformId: number;
  platform?: { id: number; name: string; type: SocialPlatformType };
  date: string;
  followersCount: number;
  recordedById: number | null;
  recordedBy?: { id: number; firstName: string; lastName: string } | null;
  notes: string | null;
  createdAt: string;
}

export interface SocialDashboardData {
  counters: {
    platforms: number;
    activePlatforms: number;
    publicationsTotal: number;
    viewsTotal: number;
    interactionsTotal: number;
    followersTotal: number;
  };
  trend: Array<{ label: string; publications: number; views: number; interactions: number }>;
  followersTrend: Array<{ label: string; total: number }>;
  byPlatform: Array<{
    id: number; name: string; type: SocialPlatformType; isActive: boolean;
    publications: number; views: number; interactions: number;
    followers: number | null; followersDate: string | null;
  }>;
}
