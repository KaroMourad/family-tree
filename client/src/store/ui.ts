import { create } from "zustand";

type UIState = {
  selectedPersonId: string | null;
  setSelectedPerson: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  selectedPersonId: null,
  setSelectedPerson: (id) => set({ selectedPersonId: id }),
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
