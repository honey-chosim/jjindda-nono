"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SentRequest {
  profileId: string;
  profileName: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  sentAt: string;
}

interface AppState {
  hasUsedRequestToday: boolean;
  currentUserId: string;
  sentRequests: SentRequest[];
  setRequestUsed: () => void;
  addSentRequest: (profileId: string, profileName: string) => void;
  updateSentRequestStatus: (
    profileId: string,
    status: SentRequest["status"]
  ) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasUsedRequestToday: false,
      currentUserId: "me",
      sentRequests: [],
      setRequestUsed: () => set({ hasUsedRequestToday: true }),
      addSentRequest: (profileId, profileName) =>
        set((state) => ({
          sentRequests: [
            ...state.sentRequests,
            {
              profileId,
              profileName,
              status: "pending",
              sentAt: new Date().toISOString(),
            },
          ],
          hasUsedRequestToday: true,
        })),
      updateSentRequestStatus: (profileId, status) =>
        set((state) => ({
          sentRequests: state.sentRequests.map((r) =>
            r.profileId === profileId ? { ...r, status } : r
          ),
        })),
    }),
    {
      name: "jjindda-nono-app",
    }
  )
);
