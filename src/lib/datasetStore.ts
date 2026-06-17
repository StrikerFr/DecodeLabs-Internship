import { useSyncExternalStore } from "react";
import type { DatasetSummary, ModelResult, FeatureImportance } from "./datasetParser";

type State = {
  fileName: string | null;
  summary: DatasetSummary | null;
  models: ModelResult[];
  featureImportance: FeatureImportance[];
  understanding: string;
  insights: { title: string; body: string; tone: "good" | "warn" | "info" }[];
};

let state: State = {
  fileName: null,
  summary: null,
  models: [],
  featureImportance: [],
  understanding: "",
  insights: [],
};

const listeners = new Set<() => void>();

export const datasetStore = {
  get: () => state,
  set: (next: Partial<State>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  },
  reset: () => {
    state = {
      fileName: null,
      summary: null,
      models: [],
      featureImportance: [],
      understanding: "",
      insights: [],
    };
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useDataset = () =>
  useSyncExternalStore(datasetStore.subscribe, datasetStore.get, datasetStore.get);
