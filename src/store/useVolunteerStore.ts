import { create } from 'zustand';

interface VolunteerState {
  declinedAlertIds: string[];
  declineAlert: (alertId: string) => void;
  clearDeclined: () => void;
}

export const useVolunteerStore = create<VolunteerState>((set) => ({
  declinedAlertIds: [],
  declineAlert: (alertId) =>
    set((state) => ({ declinedAlertIds: [...state.declinedAlertIds, alertId] })),
  clearDeclined: () => set({ declinedAlertIds: [] }),
}));
