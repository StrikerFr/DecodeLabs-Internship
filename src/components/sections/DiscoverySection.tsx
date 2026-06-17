import { useEffect, useRef, useState } from "react";

type Props = {
  onPhaseChange?: (phase: number) => void;
};

// Smooth band: 0 outside [a,d], ramps up [a..b], stays 1 [b..c], ramps down [c..d]
const band = (t: number, a: number, b: number, c: number, d: number) => {
  if (t <= a || t >= d) return 0;
  if (t < b) return (t - a) / (b - a);
  if (t > c) return 1 - (t - c) / (d - c);
  return 1;
};

const FEATURES = [
  { label: "Age", weight: 0.35 },
  { label: "Income", weight: 0.55 },
  { label: "Experience", weight: 0.45 },
  { label: "Education", weight: 0.4 },
  { label: "Purchase History", weight: 0.8 },
  { label: "Customer Activity", weight: 0.95 },
  { label: "Subscription Length", weight: 0.92 },
  { label: "Monthly Spend", weight: 0.85 },
];

const MODELS = [
  { name: "Random Forest", score: 98.4 },
  { name: "XGBoost", score: 97.1 },
  { name: "Gradient Boost", score: 95.8 },
  { name: "Decision Tree", score: 91.2 },
  { name: "Logistic Regression", score: 88.6 },
  { name: "KNN", score: 84.3 },
];

const THOUGHTS = [
  "Strong correlation detected",
  "Target variable identified",
  "Balanced dataset",
  "High prediction potential",
];

const TOP_FEATURES = new Set(["Customer Activity", "Subscription Length", "Monthly Spend"]);

const PANEL = "rgba(255,255,255,0.78)";
const PANEL_BORDER = "rgba(17,17,17,0.08)";
const PANEL_SHADOW = "0 30px 80px -40px rgba(17,17,17,0.25), 0 0 0 1px rgba(255,255,255,0.6) inset";

export function DiscoverySection({ onPhaseChange }: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      setT(p);
      onPhaseChange?.(p);
    };
    const loop = () => {
      onScroll();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onPhaseChange]);

  // Five clean phases — each owns roughly 1/5 of the scroll
  const opIntro = band(t, 0.0, 0.04, 0.14, 0.22);
  const opThoughts = band(t, 0.18, 0.24, 0.36, 0.44);
  const opGraph = band(t, 0.4, 0.46, 0.62, 0.7);
  const opModels = band(t, 0.66, 0.72, 0.84, 0.9);
  const opEnd = band(t, 0.88, 0.93, 1.0, 1.02);

  const thoughtIndex = Math.min(
    THOUGHTS.length - 1,
    Math.max(0, Math.floor(((t - 0.2) / 0.22) * THOUGHTS.length)),
  );

  // Sorted model bars highlight the winner
  const sortedModels = [...MODELS].sort((a, b) => b.score - a.score);

  return (
    <section
      ref={sectionRef}
      className="relative w-full"
      style={{ height: "320vh", color: "#111" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Backdrop — keeps the neural scene as ambient context, never noise */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 80% at 50% 50%, rgba(247,247,245,0.78) 0%, rgba(247,247,245,0.55) 55%, rgba(247,247,245,0.25) 100%)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            maskImage: "linear-gradient(to bottom, transparent 0px, black 160px)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 160px)",
          }}
        />

        {/* Scroll progress rail */}
        <div className="absolute left-8 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex">
          {["Intro", "Patterns", "Graph", "Models", "Result"].map((label, i) => {
            const active =
              (i === 0 && opIntro > 0.1) ||
              (i === 1 && opThoughts > 0.1) ||
              (i === 2 && opGraph > 0.1) ||
              (i === 3 && opModels > 0.1) ||
              (i === 4 && opEnd > 0.1);
            return (
              <div key={label} className="flex items-center gap-3">
                <span
                  className="block h-1.5 w-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: active ? "#7c3aed" : "rgba(17,17,17,0.2)",
                    boxShadow: active ? "0 0 10px #7c3aed" : "none",
                    transform: active ? "scale(1.4)" : "scale(1)",
                  }}
                />
                <span
                  className="text-[10px] tracking-[0.22em] uppercase transition-opacity"
                  style={{
                    color: active ? "#111" : "rgba(17,17,17,0.35)",
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* === 1. Intro statements === */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div
            className="max-w-4xl text-center"
            style={{
              opacity: opIntro,
              transform: `translateY(${(1 - opIntro) * 20}px)`,
              transition: "opacity 0.25s, transform 0.25s",
            }}
          >
            <div
              className="text-[11px] tracking-[0.28em] uppercase"
              style={{ color: "rgba(17,17,17,0.45)" }}
            >
              Phase 01: Discovery
            </div>
            <h2
              className="mt-5 font-semibold tracking-[-0.025em] leading-[1.05]"
              style={{ fontSize: "clamp(40px, 5.5vw, 72px)", color: "#111" }}
            >
              Every dataset hides patterns.{" "}
              <span style={{ color: "#7c3aed" }}>We reveal them.</span>
            </h2>
            <p
              className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed"
              style={{ color: "rgba(17,17,17,0.6)" }}
            >
              Scroll to watch the AI explore your dataset, build a knowledge graph, compare
              candidate models, and pick a winner.
            </p>
          </div>
        </div>

        {/* === 2. Thoughts stream === */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
          style={{ opacity: opThoughts }}
        >
          <div className="w-full max-w-xl">
            <div
              className="text-center text-[11px] tracking-[0.28em] uppercase"
              style={{ color: "rgba(17,17,17,0.45)" }}
            >
              AI is thinking
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {THOUGHTS.map((thought, i) => {
                const visible = i <= thoughtIndex;
                return (
                  <div
                    key={thought}
                    className="rounded-xl border px-5 py-3.5 backdrop-blur-xl transition-all duration-500"
                    style={{
                      background: PANEL,
                      borderColor: PANEL_BORDER,
                      boxShadow: visible ? PANEL_SHADOW : "none",
                      opacity: visible ? 1 : 0,
                      transform: visible ? "translateY(0)" : "translateY(12px)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          background: i === thoughtIndex ? "#7c3aed" : "#14b8a6",
                          boxShadow: i === thoughtIndex ? "0 0 10px #7c3aed" : "0 0 8px #14b8a6",
                        }}
                      />
                      <span
                        className="text-[14px] font-medium tracking-tight"
                        style={{ color: "#111" }}
                      >
                        {thought}
                      </span>
                      {i < thoughtIndex && (
                        <span
                          className="ml-auto text-[11px] tracking-[0.18em] uppercase"
                          style={{ color: "#14b8a6" }}
                        >
                          ✓ done
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* === 3. Knowledge graph (feature importance) === */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
          style={{ opacity: opGraph }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border p-6 backdrop-blur-xl sm:p-8"
            style={{
              background: PANEL,
              borderColor: PANEL_BORDER,
              boxShadow: PANEL_SHADOW,
              transform: `translateY(${(1 - opGraph) * 16}px)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-[11px] tracking-[0.28em] uppercase"
                  style={{ color: "rgba(17,17,17,0.45)" }}
                >
                  Feature Importance
                </div>
                <div
                  className="mt-1.5 text-[18px] font-semibold tracking-tight"
                  style={{ color: "#111" }}
                >
                  What predicts churn?
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase"
                style={{
                  background: "rgba(20,184,166,0.12)",
                  color: "#0d8a7a",
                }}
              >
                Top 3 highlighted
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {FEATURES.slice()
                .sort((a, b) => b.weight - a.weight)
                .map((f) => {
                  const isTop = TOP_FEATURES.has(f.label);
                  return (
                    <div
                      key={f.label}
                      className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-4"
                    >
                      <span
                        className="truncate text-[13px] font-medium tracking-tight"
                        style={{
                          color: isTop ? "#111" : "rgba(17,17,17,0.7)",
                        }}
                      >
                        {f.label}
                      </span>
                      <div
                        className="relative h-2 overflow-hidden rounded-full"
                        style={{ background: "rgba(17,17,17,0.06)" }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.round(f.weight * opGraph * 100)}%`,
                            background: isTop
                              ? "linear-gradient(90deg, #14b8a6, #7c3aed)"
                              : "rgba(124,58,237,0.5)",
                            boxShadow: isTop ? "0 0 16px rgba(124,58,237,0.4)" : "none",
                          }}
                        />
                      </div>
                      <span
                        className="w-10 text-right text-[12px] tabular-nums"
                        style={{
                          color: isTop ? "#0d8a7a" : "rgba(17,17,17,0.5)",
                          fontWeight: isTop ? 600 : 400,
                        }}
                      >
                        {(f.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
            </div>
            <div
              className="mt-6 rounded-xl px-4 py-3 text-[13px] leading-relaxed"
              style={{
                background: "rgba(20,184,166,0.08)",
                color: "rgba(17,17,17,0.75)",
                border: "1px solid rgba(20,184,166,0.18)",
              }}
            >
              <span style={{ color: "#0d8a7a", fontWeight: 600 }}>Insight:</span> Customer activity
              and subscription length dominate the signal, so you can expect strong, stable
              predictions.
            </div>
          </div>
        </div>

        {/* === 4. Model comparison === */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
          style={{ opacity: opModels }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border p-6 backdrop-blur-xl sm:p-8"
            style={{
              background: PANEL,
              borderColor: PANEL_BORDER,
              boxShadow: PANEL_SHADOW,
              transform: `translateY(${(1 - opModels) * 16}px)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className="text-[11px] tracking-[0.28em] uppercase"
                  style={{ color: "rgba(17,17,17,0.45)" }}
                >
                  Model Comparison
                </div>
                <div
                  className="mt-1.5 text-[18px] font-semibold tracking-tight"
                  style={{ color: "#111" }}
                >
                  6 models ranked by accuracy
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase"
                style={{
                  background: "rgba(124,58,237,0.1)",
                  color: "#7c3aed",
                }}
              >
                5-fold CV
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {sortedModels.map((m, i) => {
                const isWinner = i === 0;
                return (
                  <div
                    key={m.name}
                    className="grid grid-cols-[24px_minmax(0,1fr)_60px] items-center gap-4 rounded-xl px-3 py-2.5"
                    style={{
                      background: isWinner
                        ? "linear-gradient(90deg, rgba(20,184,166,0.12), rgba(124,58,237,0.08))"
                        : "transparent",
                      border: isWinner ? "1px solid rgba(20,184,166,0.3)" : "1px solid transparent",
                    }}
                  >
                    <span
                      className="text-[12px] tabular-nums"
                      style={{
                        color: isWinner ? "#0d8a7a" : "rgba(17,17,17,0.4)",
                        fontWeight: isWinner ? 600 : 500,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-[14px] font-medium tracking-tight"
                        style={{ color: "#111" }}
                      >
                        {m.name}
                      </span>
                      {isWinner && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase"
                          style={{
                            background: "#14b8a6",
                            color: "#fff",
                          }}
                        >
                          Winner
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <div
                        className="relative h-1.5 w-16 overflow-hidden rounded-full"
                        style={{ background: "rgba(17,17,17,0.06)" }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${m.score * opModels}%`,
                            background: isWinner ? "#14b8a6" : "#7c3aed",
                          }}
                        />
                      </div>
                      <span
                        className="w-12 text-right text-[12px] tabular-nums"
                        style={{
                          color: isWinner ? "#0d8a7a" : "rgba(17,17,17,0.6)",
                          fontWeight: isWinner ? 600 : 500,
                        }}
                      >
                        {m.score.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* === 5. Result === */}
        {/* === 5. Result === */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
          style={{ opacity: opEnd }}
        >
          <div
            className="pointer-events-auto relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border px-8 py-10 transition-all duration-700"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.78), rgba(244,240,255,0.68))",
              borderColor: "rgba(17,17,17,0.08)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow:
                "0 30px 70px -20px rgba(124,58,237,0.22), 0 0 0 1px rgba(255,255,255,0.7) inset",
              transform: `translateY(${(1 - opEnd) * 20}px) scale(${opEnd * 0.04 + 0.96})`,
            }}
          >
            {/* Ambient glows inside the card */}
            <div
              className="absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)",
              }}
            />
            <div
              className="absolute -left-12 -bottom-12 h-36 w-36 rounded-full blur-2xl opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(20,184,166,0.2), transparent 70%)",
              }}
            />

            <div className="relative">
              {/* Header Badge */}
              <div className="flex items-center justify-center">
                <div
                  className="flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] tracking-[0.25em] uppercase"
                  style={{
                    borderColor: "rgba(124,58,237,0.25)",
                    background: "rgba(124,58,237,0.06)",
                    color: "#7c3aed",
                  }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7c3aed] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7c3aed]" />
                  </span>
                  Recommended Model
                </div>
              </div>

              {/* Title */}
              <h3
                className="mt-5 text-center font-bold tracking-[-0.03em]"
                style={{
                  fontSize: "clamp(32px, 4.2vw, 44px)",
                  color: "#111",
                  lineHeight: 1.1,
                }}
              >
                Random Forest
              </h3>

              {/* Circular Accuracy Gauge */}
              <div className="my-8 flex justify-center">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full blur-xl opacity-35"
                    style={{ background: "radial-gradient(circle, #14b8a6, transparent 70%)" }}
                  />
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="rgba(17,17,17,0.05)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="url(#accGradient)"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - 0.984 * Math.max(0, opEnd))}
                      style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.2,0.8,0.2,1)" }}
                    />
                    <defs>
                      <linearGradient id="accGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="text-center z-10">
                    <div
                      className="text-[32px] font-bold tabular-nums tracking-tighter"
                      style={{ color: "#111" }}
                    >
                      {(98.4).toFixed(1)}
                      <span
                        className="text-[18px] font-medium"
                        style={{ color: "rgba(17,17,17,0.5)" }}
                      >
                        %
                      </span>
                    </div>
                    <div
                      className="text-[9px] tracking-[0.18em] uppercase"
                      style={{ color: "rgba(17,17,17,0.45)" }}
                    >
                      Accuracy
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: "Precision", value: "98.6%" },
                  { label: "Recall", value: "98.2%" },
                  { label: "F1 Score", value: "98.4%" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "rgba(17,17,17,0.05)",
                      background: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <div className="text-[15px] font-bold tabular-nums" style={{ color: "#111" }}>
                      {m.value}
                    </div>
                    <div
                      className="mt-1.5 text-[8.5px] tracking-[0.14em] uppercase"
                      style={{ color: "rgba(17,17,17,0.45)" }}
                    >
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p
                className="mt-6 text-center text-[13.5px] leading-relaxed"
                style={{ color: "rgba(17,17,17,0.58)" }}
              >
                The AI Researcher selected Random Forest based on high multi-class separation,
                stability across cross-validation folds, and low inference time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
