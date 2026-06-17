import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

type HeroProps = {
  onIntensityChange?: (v: number) => void;
};

const PLACEHOLDERS = [
  "Analyze customer_churn.csv",
  "Analyze iris_dataset.csv",
  "Predict loan_approvals.csv",
  "Find patterns in my dataset…",
];

const SEQUENCE = [
  "Reading dataset...",
  "Detecting patterns...",
  "Finding relationships...",
  "Testing models...",
  "Generating insights...",
  "Ready.",
];

const DISCOVERIES = [
  "Classification",
  "Patterns Found",
  "Feature Importance",
  "Predictions",
  "Relationships",
  "Model Selection",
];

export function Hero({ onIntensityChange }: HeroProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Rotate placeholders
  useEffect(() => {
    if (processing) return;
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 2800);
    return () => clearInterval(t);
  }, [processing]);

  useEffect(() => {
    if (!processing) return;
    if (step >= SEQUENCE.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1100);
    return () => clearTimeout(t);
  }, [processing, step]);

  const startProcessing = (file?: File) => {
    setProcessing(true);
    setStep(0);
    if (file) {
      (window as unknown as { __pendingFile?: File }).__pendingFile = file;
    }
    setTimeout(() => {
      navigate({ to: "/analyze" });
    }, 600);
  };

  const intensity = processing ? 1 : dragging ? 0.85 : 0;

  useEffect(() => {
    onIntensityChange?.(intensity);
  }, [intensity, onIntensityChange]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    startProcessing(file);
  };

  return (
    <section
      className="relative h-screen w-full overflow-hidden"
      style={{ color: "#111111" }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Volumetric ambient lighting — purple + teal radial wash */}
      <div
        className="pointer-events-none absolute inset-0 animate-pulse"
        style={{
          background:
            "radial-gradient(circle at 35% 45%, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0) 45%), radial-gradient(circle at 65% 55%, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0) 45%)",
          animationDuration: "8s",
        }}
      />
      {/* Faint light fog so text stays legible without killing the core */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(247,247,245,0.6) 0%, rgba(247,247,245,0.2) 45%, rgba(247,247,245,0) 75%)",
        }}
      />

      {/* Interactive drag overlay guide */}
      <div
        className="pointer-events-none absolute inset-4 rounded-3xl border-2 border-dashed border-indigo-500/25 bg-white/40 transition-all duration-500 z-50 flex items-center justify-center"
        style={{
          opacity: dragging ? 1 : 0,
          transform: dragging ? "scale(1)" : "scale(0.98)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div className="text-center bg-white/95 px-8 py-7 rounded-2xl border border-zinc-200/80 shadow-2xl flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-semibold text-lg animate-bounce">
            ↓
          </div>
          <p className="text-sm font-semibold tracking-tight text-zinc-900">
            Drop your dataset here
          </p>
          <p className="text-[10px] text-zinc-500 tracking-widest uppercase">CSV, XLSX, JSON</p>
        </div>
      </div>

      {/* Floating orbiting discoveries — DOM overlay */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        {DISCOVERIES.map((label, i) => {
          const angle = (i / DISCOVERIES.length) * Math.PI * 2;
          const radius = 38; // % of min dimension
          const x = 50 + Math.cos(angle) * radius * 0.9;
          const y = 50 + Math.sin(angle) * radius * 0.55;
          return (
            <span
              key={label}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-[9px] tracking-[0.18em] uppercase px-3.5 py-2 rounded-full border flex items-center gap-2 select-none font-medium transition-all duration-300"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                color: "rgba(17,17,17,0.65)",
                background: "rgba(255, 255, 255, 0.45)",
                borderColor: "rgba(17, 17, 17, 0.05)",
                backdropFilter: "blur(8px)",
                boxShadow:
                  "0 6px 16px -4px rgba(17, 17, 17, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                animation: `discoveryDrift 14s ease-in-out ${i * 1.1}s infinite`,
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: i % 2 ? "#14b8a6" : "#7c3aed",
                  boxShadow: `0 0 6px ${i % 2 ? "#14b8a6" : "#7c3aed"}`,
                }}
              />
              {label}
            </span>
          );
        })}
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <div
          className="text-center transition-opacity duration-500"
          style={{ opacity: dragging || processing ? 0.25 : 1 }}
        >
          {/* Small label */}
          <div
            className="mb-6 inline-flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase"
            style={{
              color: "rgba(17,17,17,0.55)",
              opacity: 0,
              animation: "rise 0.8s cubic-bezier(0.2,0.7,0.2,1) forwards",
            }}
          >
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ background: "#7c3aed", boxShadow: "0 0 8px #7c3aed" }}
            />
            AI Data Scientist
          </div>

          <h1
            className="font-bold tracking-[-0.04em] leading-[1.02]"
            style={{ fontSize: "clamp(44px, 6.8vw, 88px)" }}
          >
            <span
              className="block font-sans"
              style={{
                opacity: 0,
                animation: "rise 0.9s cubic-bezier(0.2,0.7,0.2,1) 0.1s forwards",
                color: "#18181b",
              }}
            >
              Understand Your Data
            </span>
            <span
              className="block font-sans font-bold tracking-[-0.03em]"
              style={{
                fontSize: "0.86em",
                marginTop: "0.14em",
                opacity: 0,
                animation: "rise 0.9s cubic-bezier(0.2,0.7,0.2,1) 0.4s forwards",
                color: "#4f46e5",
              }}
            >
              Before You Train It
            </span>
          </h1>
        </div>

        {/* Command center — wide glass bar */}
        <div
          className="relative mt-14 w-full max-w-3xl transition-all duration-500"
          style={{
            transform: dragging ? "translateY(-4px) scale(1.005)" : "none",
          }}
        >
          <div
            className="flex items-center gap-3 rounded-full border px-3 py-2.5 backdrop-blur-2xl transition-all duration-300"
            style={{
              background: dragging ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
              borderColor: dragging ? "rgba(124,58,237,0.45)" : "rgba(17,17,17,0.06)",
              boxShadow: dragging
                ? "0 35px 90px -20px rgba(124,58,237,0.35), 0 0 0 1px rgba(124,58,237,0.2) inset"
                : "0 20px 60px -25px rgba(17,17,17,0.15), 0 0 0 1px rgba(255,255,255,0.6) inset",
            }}
          >
            {/* Leading status dot */}
            <span
              className="ml-3 inline-block h-2 w-2 rounded-full"
              style={{
                background: processing
                  ? step === SEQUENCE.length - 1
                    ? "#14b8a6"
                    : "#7c3aed"
                  : "#7c3aed",
                boxShadow: `0 0 12px ${processing && step === SEQUENCE.length - 1 ? "#14b8a6" : "#7c3aed"}`,
                animation: processing
                  ? "pulseDot 1.2s ease-in-out infinite"
                  : "pulseDot 2.4s ease-in-out infinite",
              }}
            />

            {/* Rotating placeholder / processing text */}
            <div className="relative flex-1 overflow-hidden h-7">
              {processing ? (
                <div
                  key={step}
                  className="absolute inset-0 flex items-center text-[15px] tracking-tight font-medium"
                  style={{ color: "#18181b", animation: "morphIn 0.5s ease-out" }}
                >
                  {SEQUENCE[step]}
                </div>
              ) : (
                <div
                  key={placeholderIdx}
                  className="absolute inset-0 flex items-center text-[15px] tracking-tight"
                  style={{
                    color: "rgba(17,17,17,0.5)",
                    animation: "morphIn 0.6s ease-out",
                  }}
                >
                  {PLACEHOLDERS[placeholderIdx]}
                </div>
              )}
            </div>

            {/* Format chips */}
            <div className="hidden md:flex items-center gap-1.5 pr-1">
              {["CSV", "XLSX", "JSON"].map((f) => (
                <span
                  key={f}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em]"
                  style={{
                    background: "rgba(17,17,17,0.04)",
                    color: "rgba(17,17,17,0.5)",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="group flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-300 relative overflow-hidden active:scale-95 cursor-pointer"
              style={{
                background: "#18181b",
                color: "#ffffff",
                boxShadow:
                  "0 8px 20px -6px rgba(24, 24, 27, 0.4), 0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
            >
              Engage Core
              <span className="transition-transform group-hover:translate-x-1 duration-300">→</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startProcessing(f);
              }}
            />
          </div>

          {/* Sub-hint */}
          <div
            className="mt-3 flex items-center justify-center gap-2 text-[10.5px] tracking-[0.24em] uppercase"
            style={{ color: "rgba(17,17,17,0.4)" }}
          >
            <span>Drop a dataset</span>
            <span style={{ color: "rgba(17,17,17,0.2)" }}>·</span>
            <span>Or type a command</span>
            <span style={{ color: "rgba(17,17,17,0.2)" }}>·</span>
            <span>AI ready</span>
          </div>
        </div>

        {/* Sci-fi scroll cue: thin vertical beam + pulsing dot */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span
            className="block h-14 w-px"
            style={{
              background:
                "linear-gradient(to bottom, rgba(124,58,237,0) 0%, rgba(124,58,237,0.55) 50%, rgba(20,184,166,0.6) 100%)",
            }}
          />
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{
              background: "#14b8a6",
              boxShadow: "0 0 12px #14b8a6, 0 0 24px rgba(20,184,166,0.5)",
              animation: "beamPulse 2.2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes rise {
          0% { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes morphIn {
          0% { opacity: 0; transform: translateY(6px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes pulseDot {
          0%,100% { opacity: 0.55; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes beamPulse {
          0%,100% { opacity: 0.35; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes discoveryDrift {
          0% { opacity: 0; transform: translate(-50%, -50%) translateY(0); }
          15% { opacity: 0.7; }
          50% { opacity: 0.55; transform: translate(-50%, -50%) translateY(-10px); }
          85% { opacity: 0.7; }
          100% { opacity: 0; transform: translate(-50%, -50%) translateY(0); }
        }
      `}</style>
    </section>
  );
}
