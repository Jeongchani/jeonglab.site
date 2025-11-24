// src/types/link.ts
export type LinkCategory = 'Project' | 'Study' | 'Server' | 'Tool' | 'Docs' | 'Etc';
export type LinkVisibility = 'public' | 'private';

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon: string; // "emoji:🏠" | "si-github" | "custom:xxx.svg"
  category: LinkCategory;
  pinned: boolean;
  notes?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  visibility: LinkVisibility;
}
