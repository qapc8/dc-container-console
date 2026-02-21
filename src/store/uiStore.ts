import { create } from 'zustand';
import type { TabId, UnitSystem } from '../types';

interface UiState {
  activeTab: TabId;
  unitSystem: UnitSystem;
  selectedRackId: string | null;
  sidebarOpen: boolean;

  setActiveTab: (tab: TabId) => void;
  setUnitSystem: (system: UnitSystem) => void;
  toggleUnitSystem: () => void;
  setSelectedRack: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'configure',
  unitSystem: 'metric',
  selectedRackId: null,
  sidebarOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setUnitSystem: (system) => set({ unitSystem: system }),
  toggleUnitSystem: () =>
    set(state => ({
      unitSystem: state.unitSystem === 'metric' ? 'imperial' : 'metric',
    })),
  setSelectedRack: (id) => set({ selectedRackId: id }),
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
}));
