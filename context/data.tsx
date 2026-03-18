import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/api';
import { onDataChanged } from '@/lib/dataEvents';

export type Card = {
  id: string;
  player: string;
  sport?: string;
  year?: string | number;
  grade?: string;
  gradingCo?: string;
  buy?: number;
  val?: number;
  qty?: number;
  num?: string;
  name?: string;
  brand?: string;
  cond?: string;
  notes?: string;
  auto?: boolean;
  sold?: boolean;
  soldPrice?: number;
  soldDate?: string;
  createdAt?: string;
};

export type Snapshot = {
  id: string;
  value: number;
  createdAt: string;
};

export type Activity = {
  id: string;
  type: string;
  player: string;
  sport?: string;
  detail?: string;
  createdAt: string;
};

type DataContextType = {
  cards: Card[];
  snapshots: Snapshot[];
  activity: Activity[];
  initialLoading: boolean;
  refresh: (silent?: boolean) => Promise<void>;
};

const DataContext = createContext<DataContextType>({
  cards: [],
  snapshots: [],
  activity: [],
  initialLoading: true,
  refresh: async () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [cardsData, snapshotsData, activityData] = await Promise.all([
        api.getCards().catch(() => null),
        api.getSnapshots().catch(() => []),
        api.getActivity().catch(() => []),
      ]);
      if (cardsData) {
        setCards(Array.isArray(cardsData) ? cardsData : (cardsData.cards || []));
      }
      setSnapshots(Array.isArray(snapshotsData) ? snapshotsData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);
    } catch {
      // keep existing data on error
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // Fetch all data immediately when the app opens
  useEffect(() => { refresh(); }, [refresh]);

  // Re-fetch silently whenever any card is mutated anywhere
  useEffect(() => onDataChanged(() => refresh()), [refresh]);

  return (
    <DataContext.Provider value={{ cards, snapshots, activity, initialLoading, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
