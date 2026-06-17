type ClassifyAIErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type ClassifyAIEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: ClassifyAIErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __classifyAIEvents?: ClassifyAIEvents;
  }
}

export function reportClassifyAIError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__classifyAIEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
