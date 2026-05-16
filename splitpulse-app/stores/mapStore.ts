import { create } from "zustand";
import type { Instant, Location, InstantType } from "@/types";

interface MapState {
  instants: Instant[];
  locations: Location[];
  filter: InstantType | null;
  activeLocationId: string | null;

  setInstants: (i: Instant[]) => void;
  setLocations: (l: Location[]) => void;
  addInstant: (i: Instant) => void;
  updateInstant: (patch: Partial<Instant> & { id: string }) => void;
  removeInstant: (id: string) => void;
  upsertLocation: (l: Location) => void;
  setFilter: (t: InstantType | null) => void;
  setActiveLocation: (id: string | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  instants: [],
  locations: [],
  filter: null,
  activeLocationId: null,

  setInstants: (instants) => set({ instants }),
  setLocations: (locations) => set({ locations }),

  addInstant: (i) =>
    set((s) =>
      s.instants.some((x) => x.id === i.id)
        ? s
        : { instants: [i, ...s.instants] },
    ),

  updateInstant: (patch) =>
    set((s) => ({
      instants: s.instants.map((x) =>
        x.id === patch.id ? { ...x, ...patch } : x,
      ),
    })),

  removeInstant: (id) =>
    set((s) => ({ instants: s.instants.filter((x) => x.id !== id) })),

  upsertLocation: (l) =>
    set((s) => ({
      locations: s.locations.some((x) => x.id === l.id)
        ? s.locations.map((x) => (x.id === l.id ? { ...x, ...l } : x))
        : [...s.locations, l],
    })),

  setFilter: (filter) => set({ filter }),
  setActiveLocation: (activeLocationId) => set({ activeLocationId }),
}));
