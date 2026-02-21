import { create } from 'zustand';
import type { SavedConfig } from '../types';

const STORAGE_KEY = 'dc-console-saved-configs';

function loadFromStorage(): SavedConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(configs: SavedConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

interface ComparisonState {
  savedConfigs: SavedConfig[];
  selectedIds: string[];

  saveConfig: (config: SavedConfig) => void;
  deleteConfig: (id: string) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  loadConfigs: () => void;
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  savedConfigs: loadFromStorage(),
  selectedIds: [],

  saveConfig: (config) => {
    const updated = [...get().savedConfigs, config];
    saveToStorage(updated);
    set({ savedConfigs: updated });
  },

  deleteConfig: (id) => {
    const updated = get().savedConfigs.filter(c => c.id !== id);
    saveToStorage(updated);
    set({
      savedConfigs: updated,
      selectedIds: get().selectedIds.filter(sid => sid !== id),
    });
  },

  toggleSelection: (id) => {
    set(state => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter(sid => sid !== id)
        : [...state.selectedIds, id],
    }));
  },

  clearSelection: () => set({ selectedIds: [] }),

  loadConfigs: () => set({ savedConfigs: loadFromStorage() }),
}));
