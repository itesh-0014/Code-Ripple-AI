import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      darkMode: true,
      sidebarOpen: false,
      setDarkMode: darkMode => set({ darkMode }),
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),
      setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
    }),
    { name: 'gitsense-ui' },
  ),
);
