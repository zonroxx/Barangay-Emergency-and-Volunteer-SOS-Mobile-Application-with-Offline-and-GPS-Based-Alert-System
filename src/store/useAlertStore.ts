import { create } from 'zustand';
import { DbAlert } from '../db/types';

interface AlertState {
  activeAlert: DbAlert | null;
  setActiveAlert: (alert: DbAlert | null) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  activeAlert: null,
  setActiveAlert: (activeAlert) => set({ activeAlert }),
}));
