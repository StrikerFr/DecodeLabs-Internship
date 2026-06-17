import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  onActive?: (active: boolean) => void;
};

/** FlipText — letters flip up to a colored copy on hover, staggered. */
function FlipText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`flip-text inline-flex overflow-hidden align-bottom ${className}`}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="flip-char relative inline-block"
          style={{ transitionDelay: `${i * 22}ms` }}
        >
          <span className="flip-char-top inline-block">{ch === " " ? "\u00a0" : ch}</span>
          <span
            className="flip-char-bottom absolute left-0 top-full inline-block"
            style={{ color: "#7c3aed" }}
          >
            {ch === " " ? "\u00a0" : ch}
          </span>
        </span>
      ))}
    </span>
  );
}

const PLACEHOLDERS = [
  "Predict customer churn",
  "Predict flower species",
  "Predict loan approval",
  "Predict employee attrition",
];

const FEATURES = [
  { key: "sepal_length", label: "Sepal Length", min: 4, max: 8, step: 0.1, unit: "cm" },
  { key: "sepal_width", label: "Sepal Width", min: 2, max: 5, step: 0.1, unit: "cm" },
  { key: "petal_length", label: "Petal Length", min: 1, max: 7, step: 0.1, unit: "cm" },
  { key: "petal_width", label: "Petal Width", min: 0.1, max: 3, step: 0.1, unit: "cm" },
] as const;

const REASONING = [
  {
    q: "Why did you predict this?",
    a: "Petal width (0.2cm) and petal length (1.4cm) align almost perfectly with the Setosa cluster centroid. The model has seen 1,247 similar samples, which are all Setosa.",
  },
  {
    q: "Which feature mattered most?",
    a: "Petal width contributed 48% of the decision, followed by petal length (37%). Sepal measurements played a minor role.",
  },
  {
    q: "How can accuracy improve?",
    a: "The Versicolor/Virginica boundary is the weakest region. Adding ~200 borderline samples or a petal-area engineered feature could raise accuracy to ~99.2%.",
  },
  {
    q: "What influenced this decision?",
    a: "Three nodes in the knowledge graph activated strongly: petal width, petal length, and their interaction term. Sepal nodes stayed dim.",
  },
];

const RESEARCHER_COMMANDS = [
  "Explain my dataset",
  "Improve my model",
  "Suggest a better algorithm",
  "Find hidden patterns",
  "Generate insights report",
];

export function PredictionSection({ onActive }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [values, setValues] = useState<Record<string, number>>({
    sepal_length: 5.1,
    sepal_width: 3.5,
    petal_length: 1.4,
    petal_width: 0.2,
  });
  const [predicted, setPredicted] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [ringProgress, setRingProgress] = useState(0);
  const [activeReason, setActiveReason] = useState<number | null>(null);
  const [researcherResp, setResearcherResp] = useState<string | null>(null);
  const [researcherCmd, setResearcherCmd] = useState<string | null>(null);
  const [input, setInput] = useState("");

  // Intersection — wake up Section 3
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.intersectionRatio > 0.25);
        onActive?.(entry.intersectionRatio > 0.25);
      },
      { threshold: [0, 0.25, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onActive]);

  // Rotate placeholder
  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 2400);
    return () => clearInterval(t);
  }, []);

  // Compute prediction (deterministic based on petal width)
  const prediction = useMemo(() => {
    const pw = values.petal_width;
    const pl = values.petal_length;
    if (pw < 0.8) return { label: "SETOSA", confidence: 98.4, hue: "#14b8a6" };
    if (pw < 1.7 || pl < 4.9) return { label: "VERSICOLOR", confidence: 94.1, hue: "#7c3aed" };
    return { label: "VIRGINICA", confidence: 96.7, hue: "#f59e0b" };
  }, [values]);

  const runPrediction = () => {
    setPredicted(false);
    setPredicting(true);
    setRingProgress(0);
    setActiveReason(null);
    setResearcherResp(null);
    let start: number | null = null;
    const target = prediction.confidence;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / 1400, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setRingProgress(eased * target);
      if (t < 1) requestAnimationFrame(tick);
      else {
        setPredicting(false);
        setPredicted(true);
      }
    };
    requestAnimationFrame(tick);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runPrediction();
  };

  const askResearcher = (cmd: string) => {
    setResearcherResp(null);
    setResearcherCmd(cmd);
    const responses: Record<string, string> = {
      "Explain my dataset":
        "150 samples across 3 species, which is perfectly balanced. 4 numeric features, no missing values. Petal measurements separate classes cleanly; sepal measurements overlap.",
      "Improve my model":
        "Two paths: (1) engineer a petal_area feature with a projected +0.6% accuracy. (2) Switch to a soft-margin SVM for the Versicolor/Virginica boundary with a projected +1.1%.",
      "Suggest a better algorithm":
        "For this geometry I'd recommend Gradient Boosting with depth=3. Expected accuracy 98.9% with better calibration than Random Forest.",
      "Find hidden patterns":
        "Petal length and petal width are highly co-linear (r=0.96). One latent dimension captures 92% of variance, meaning your data effectively lives on a 2D manifold.",
      "Generate insights report":
        "Drafting a 6-page report: dataset overview, EDA, model selection rationale, feature importance, error analysis, and recommendations. Ready in ~3 seconds.",
    };
    setTimeout(() => setResearcherResp(responses[cmd] ?? "Working on it..."), 350);
  };

  // intensity for the live AI core (number of slider changes recent)
  const intensity = predicting ? 1 : visible ? 0.4 : 0;
  void intensity;

  const ringCirc = 2 * Math.PI * 64;
  const ringOffset = ringCirc * (1 - ringProgress / 100);

  return (
    <section ref={ref} className="relative w-full" style={{ color: "#111" }}>
      {/* Soft ambient veil — dims the fixed neural backdrop so Prediction feels grounded */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(247,247,245,0.48) 0%, rgba(247,247,245,0.82) 18%, rgba(247,247,245,0.92) 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      />
      {/* ============= ACT 1+2: opening + command center ============= */}
      <div className="relative w-full">
        <div className="flex w-full flex-col items-center justify-center px-6 pt-24 pb-16">
          {/* Opening typography — fades out as command appears */}
          <div className="text-center" style={{ marginBottom: 40 }}>
            <div
              className="font-semibold tracking-[-0.03em]"
              style={{ fontSize: "clamp(32px, 4.5vw, 60px)" }}
            >
              Your model is ready.
            </div>
            <div
              className="mt-3 font-light tracking-[-0.01em]"
              style={{
                fontSize: "clamp(16px, 1.8vw, 22px)",
                color: "rgba(17,17,17,0.55)",
              }}
            >
              Ask it anything.
            </div>
          </div>

          {/* Cinematic reveal sits ABOVE the command */}
          <div
            className="pointer-events-none flex flex-col items-center overflow-hidden"
            style={{
              opacity: predicted || predicting ? 1 : 0,
              transform: predicted || predicting ? "translateY(0)" : "translateY(20px)",
              transition:
                "opacity 0.8s ease, transform 0.8s ease, max-height 0.8s ease, margin 0.8s ease",
              maxHeight: predicted || predicting ? 520 : 0,
              marginBottom: predicted || predicting ? 48 : 0,
            }}
          >
            <div
              className="text-[11px] tracking-[0.32em] uppercase"
              style={{ color: "rgba(17,17,17,0.45)" }}
            >
              Prediction
            </div>
            <div
              className="mt-4 font-semibold tracking-[-0.04em]"
              style={{
                fontSize: "clamp(60px, 9vw, 140px)",
                color: "#111",
                lineHeight: 1,
                letterSpacing: "-0.04em",
                textShadow: predicted ? `0 0 60px ${prediction.hue}55` : "none",
                transition: "text-shadow 0.8s ease",
              }}
            >
              {prediction.label}
            </div>

            {/* Confidence ring */}
            <div className="relative mt-10 h-[160px] w-[160px]">
              <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  fill="none"
                  stroke="rgba(17,17,17,0.07)"
                  strokeWidth="3"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  fill="none"
                  stroke={prediction.hue}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                  style={{
                    filter: `drop-shadow(0 0 12px ${prediction.hue})`,
                    transition: "stroke 0.6s ease",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className="font-semibold tracking-[-0.02em]"
                  style={{ fontSize: 32, color: "#111" }}
                >
                  {ringProgress.toFixed(1)}
                  <span style={{ fontSize: 18, color: "rgba(17,17,17,0.5)" }}>%</span>
                </div>
                <div
                  className="mt-1 text-[10px] tracking-[0.22em] uppercase"
                  style={{ color: "rgba(17,17,17,0.45)" }}
                >
                  Confidence
                </div>
              </div>
            </div>
          </div>

          {/* Floating glass command center */}
          <form onSubmit={onSubmit} className="relative w-full max-w-2xl">
            <div
              className="rounded-2xl border backdrop-blur-2xl"
              style={{
                background: "rgba(255,255,255,0.55)",
                borderColor: "rgba(17,17,17,0.08)",
                boxShadow:
                  "0 30px 80px -25px rgba(124,58,237,0.25), 0 0 0 1px rgba(255,255,255,0.6) inset",
              }}
            >
              {/* Top input row */}
              <div className="flex items-center gap-3 px-5 py-4">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: predicting ? "#7c3aed" : "#14b8a6",
                    boxShadow: `0 0 10px ${predicting ? "#7c3aed" : "#14b8a6"}`,
                    animation: predicting ? "pulseDot 1s ease-in-out infinite" : "none",
                  }}
                />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={PLACEHOLDERS[phIdx]}
                  className="flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:transition-opacity"
                  style={{ color: "#111" }}
                />
                <kbd
                  className="rounded-md px-2 py-1 text-[10px] tracking-[0.18em] uppercase"
                  style={{
                    background: "rgba(17,17,17,0.05)",
                    color: "rgba(17,17,17,0.5)",
                  }}
                >
                  ⌘ K
                </kbd>
              </div>

              {/* Feature sliders */}
              <div
                className="grid grid-cols-2 gap-x-6 gap-y-3 border-t px-5 py-4"
                style={{ borderColor: "rgba(17,17,17,0.06)" }}
              >
                {FEATURES.map((f) => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between text-[11px] tracking-[0.14em] uppercase">
                      <span style={{ color: "rgba(17,17,17,0.55)" }}>{f.label}</span>
                      <span style={{ color: "#7c3aed", fontWeight: 600 }}>
                        {values[f.key].toFixed(1)}
                        <span style={{ color: "rgba(17,17,17,0.4)" }}> {f.unit}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={values[f.key]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: parseFloat(e.target.value) }))
                      }
                      className="mt-2 w-full accent-[#7c3aed]"
                      style={{ height: 2 }}
                    />
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div
                className="flex items-center gap-2 border-t px-5 py-3"
                style={{ borderColor: "rgba(17,17,17,0.06)" }}
              >
                <span
                  className="text-[11px] tracking-[0.18em] uppercase"
                  style={{ color: "rgba(17,17,17,0.4)" }}
                >
                  Random Forest · 98.4% trained
                </span>
                <button
                  type="submit"
                  className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all hover:translate-y-[-1px]"
                  style={{
                    background: "#111",
                    color: "#fff",
                    boxShadow: "0 10px 28px -10px rgba(17,17,17,0.5)",
                  }}
                >
                  Predict
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* Live reaction hint */}
            <div
              className="mt-3 text-center text-[11px] tracking-[0.18em] uppercase"
              style={{
                color: "rgba(17,17,17,0.35)",
                opacity: predicting ? 1 : 0.7,
                transition: "opacity 0.4s",
              }}
            >
              {predicting
                ? "Neural pathways activating…"
                : "Move a slider and watch the model think."}
            </div>
          </form>
        </div>
      </div>

      {/* ============= ACT 3: AI reasoning ============= */}
      <div className="relative w-full px-6 pt-4 pb-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          {/* Left — narrative + accordion */}
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] tracking-[0.32em] uppercase"
              style={{
                borderColor: "rgba(124,58,237,0.25)",
                background: "rgba(124,58,237,0.06)",
                color: "#7c3aed",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#7c3aed",
                  boxShadow: "0 0 10px #7c3aed",
                  animation: "pulseDot 1.8s ease-in-out infinite",
                }}
              />
              AI Reasoning
            </div>
            <h2
              className="mt-5 font-semibold tracking-[-0.03em]"
              style={{ fontSize: "clamp(36px, 4.6vw, 60px)", lineHeight: 1.02 }}
            >
              Ask it <span style={{ color: "#7c3aed" }}>why.</span>
            </h2>
            <p
              className="mt-5 max-w-xl text-[15px] leading-[1.75]"
              style={{ color: "rgba(17,17,17,0.62)" }}
            >
              Every prediction has a story. Tap a question to watch the model explain itself in
              plain language and light up the features that drove the decision.
            </p>

            <div className="mt-10 space-y-3">
              {REASONING.map((r, i) => {
                const open = activeReason === i;
                return (
                  <button
                    key={r.q}
                    onClick={() => setActiveReason(open ? null : i)}
                    className="group block w-full rounded-2xl border px-5 py-4 text-left transition-all duration-300"
                    style={{
                      background: open
                        ? "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(244,240,255,0.92))"
                        : "rgba(255,255,255,0.58)",
                      borderColor: open ? "rgba(124,58,237,0.42)" : "rgba(17,17,17,0.07)",
                      borderLeftWidth: open ? 4 : 1,
                      borderLeftColor: open ? "#7c3aed" : "rgba(17,17,17,0.07)",
                      backdropFilter: "blur(14px)",
                      boxShadow: open
                        ? "0 24px 60px -24px rgba(124,58,237,0.38), 0 0 0 1px rgba(124,58,237,0.1) inset"
                        : "0 10px 30px -20px rgba(17,17,17,0.12)",
                      transform: open
                        ? "translateY(-1px) translateX(4px)"
                        : "translateY(0) translateX(0)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums"
                        style={{
                          background: open ? "#7c3aed" : "rgba(124,58,237,0.1)",
                          color: open ? "#fff" : "#7c3aed",
                          boxShadow: open ? "0 0 16px rgba(124,58,237,0.5)" : "none",
                          transition: "all 0.3s",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="text-[15px] font-medium tracking-tight"
                        style={{ color: "#111" }}
                      >
                        {r.q}
                      </span>
                      <span
                        className="ml-auto grid h-6 w-6 place-items-center rounded-full text-[14px] transition-transform duration-300"
                        style={{
                          background: open ? "rgba(124,58,237,0.15)" : "transparent",
                          color: open ? "#7c3aed" : "rgba(17,17,17,0.4)",
                          transform: open ? "rotate(45deg)" : "rotate(0)",
                        }}
                      >
                        +
                      </span>
                    </div>
                    <div
                      className="overflow-hidden text-[14px] leading-[1.75]"
                      style={{
                        maxHeight: open ? 240 : 0,
                        opacity: open ? 1 : 0,
                        marginTop: open ? 12 : 0,
                        color: "rgba(17,17,17,0.72)",
                        transition: "max-height 0.5s ease, opacity 0.5s ease, margin-top 0.4s ease",
                      }}
                    >
                      <div className="pl-10">{r.a}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — reasoning visualization */}
          <div
            className="relative overflow-hidden rounded-3xl border p-7 lg:sticky lg:top-24"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.85), rgba(245,243,255,0.75))",
              borderColor: "rgba(17,17,17,0.08)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 40px 90px -50px rgba(124,58,237,0.35), 0 0 0 1px rgba(255,255,255,0.6) inset",
              minHeight: 420,
            }}
          >
            {/* Subtle grid backdrop */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(124,58,237,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.07) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage: "radial-gradient(60% 60% at 50% 40%, #000 0%, transparent 80%)",
              }}
            />

            <div className="relative">
              <div className="flex items-center justify-between">
                <div
                  className="text-[10px] tracking-[0.32em] uppercase"
                  style={{ color: "rgba(17,17,17,0.45)" }}
                >
                  Live decision graph
                </div>
                <div
                  className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase"
                  style={{ color: "#0d8a7a" }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      background: "#14b8a6",
                      boxShadow: "0 0 8px #14b8a6",
                      animation: "pulseDot 1.6s ease-in-out infinite",
                    }}
                  />
                  Active
                </div>
              </div>

              {/* Feature contribution bars — react to active question */}
              <div className="mt-7 space-y-4">
                {[
                  { key: "petal_width", label: "Petal Width", base: 0.92 },
                  { key: "petal_length", label: "Petal Length", base: 0.78 },
                  { key: "sepal_length", label: "Sepal Length", base: 0.22 },
                  { key: "sepal_width", label: "Sepal Width", base: 0.14 },
                ].map((f, idx) => {
                  // Weight shifts with active question
                  const boost =
                    activeReason === 1
                      ? [1.0, 0.78, 0.18, 0.1][idx]
                      : activeReason === 2
                        ? [0.7, 0.62, 0.45, 0.4][idx]
                        : activeReason === 3
                          ? [0.96, 0.85, 0.16, 0.08][idx]
                          : f.base;
                  const isTop = boost > 0.5;
                  return (
                    <div key={f.key} className="grid grid-cols-[110px_1fr_42px] items-center gap-3">
                      <span
                        className="truncate text-[12px] tracking-tight"
                        style={{
                          color: isTop ? "#111" : "rgba(17,17,17,0.55)",
                          fontWeight: isTop ? 600 : 500,
                        }}
                      >
                        {f.label}
                      </span>
                      <div
                        className="relative h-2 overflow-hidden rounded-full"
                        style={{ background: "rgba(17,17,17,0.06)" }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${boost * 100}%`,
                            background: isTop
                              ? `linear-gradient(90deg, #14b8a6, ${prediction.hue})`
                              : "rgba(124,58,237,0.4)",
                            boxShadow: isTop ? `0 0 14px ${prediction.hue}45` : "none",
                            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1), background 0.4s",
                          }}
                        />
                      </div>
                      <span
                        className="text-right text-[11px] tabular-nums"
                        style={{
                          color: isTop ? prediction.hue : "rgba(17,17,17,0.5)",
                          fontWeight: isTop ? 600 : 400,
                        }}
                      >
                        {Math.round(boost * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Decision node pulse */}
              <div className="mt-8 flex items-center justify-center">
                <div className="relative h-32 w-32 flex items-center justify-center">
                  {/* Outer pulsing glow */}
                  <div
                    className="absolute inset-0 rounded-full transition-all duration-700"
                    style={{
                      background: `radial-gradient(circle, ${prediction.hue}35 0%, transparent 70%)`,
                      animation: "pulseDot 2.2s ease-in-out infinite",
                    }}
                  />
                  {/* Rotating dashed ring */}
                  <div
                    className="absolute inset-2 rounded-full border border-dashed transition-all duration-700"
                    style={{
                      borderColor: `${prediction.hue}50`,
                      animation: "spin 12s linear infinite",
                    }}
                  />
                  {/* Rotating solid ring */}
                  <div
                    className="absolute inset-4 rounded-full border transition-all duration-700"
                    style={{
                      borderColor: `${prediction.hue}25`,
                      animation: "spin 8s linear infinite reverse",
                    }}
                  />
                  {/* Core Orb */}
                  <div
                    className="relative flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-700 animate-[coreBreathe_2.6s_ease-in-out_infinite]"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${prediction.hue}15 50%, ${prediction.hue}40 100%)`,
                      borderColor: `${prediction.hue}50`,
                      boxShadow: `0 10px 30px -10px ${prediction.hue}88, inset 0 0 16px ${prediction.hue}30`,
                    }}
                  >
                    <div
                      className="font-bold tracking-[0.18em] text-[11px] uppercase transition-colors"
                      style={{
                        color: "#111",
                        textShadow: `0 0 10px ${prediction.hue}44`,
                      }}
                    >
                      {prediction.label}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tip / Insight Box */}
              <div
                className="mt-6 rounded-2xl px-4.5 py-4 text-[13px] leading-relaxed transition-all duration-500"
                style={{
                  background:
                    activeReason === null
                      ? "linear-gradient(135deg, rgba(20,184,166,0.06), rgba(124,58,237,0.03))"
                      : "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(20,184,166,0.03))",
                  border:
                    activeReason === null
                      ? "1px solid rgba(20,184,166,0.18)"
                      : "1px solid rgba(124,58,237,0.22)",
                  color: "rgba(17,17,17,0.7)",
                  boxShadow: "0 10px 24px -15px rgba(124,58,237,0.15)",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      background:
                        activeReason === null ? "rgba(20,184,166,0.15)" : "rgba(124,58,237,0.15)",
                      color: activeReason === null ? "#0d8a7a" : "#7c3aed",
                    }}
                  >
                    i
                  </span>
                  <div>
                    <span
                      style={{
                        color: activeReason === null ? "#0d8a7a" : "#7c3aed",
                        fontWeight: 600,
                      }}
                    >
                      {activeReason === null ? "Recommendation:" : "Researcher Insight:"}
                    </span>{" "}
                    {activeReason === null
                      ? "Select one of the analytical inquiries on the left to activate full feature reasoning and watch the attention matrix re-balance."
                      : REASONING[activeReason].a}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============= ACT 4: AI Researcher Mode ============= */}
      <div className="relative w-full px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div
                className="text-[10px] tracking-[0.32em] uppercase"
                style={{ color: "rgba(17,17,17,0.45)" }}
              >
                Researcher Mode
              </div>
              <h2
                className="mt-3 font-semibold tracking-[-0.03em]"
                style={{ fontSize: "clamp(30px, 3.8vw, 48px)" }}
              >
                Your AI data scientist.
              </h2>
            </div>
            <div
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] tracking-[0.22em] uppercase"
              style={{
                borderColor: "rgba(17,17,17,0.1)",
                background: "rgba(255,255,255,0.6)",
                color: "rgba(17,17,17,0.55)",
                backdropFilter: "blur(10px)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: researcherResp ? "#14b8a6" : "#f59e0b",
                  boxShadow: `0 0 8px ${researcherResp ? "#14b8a6" : "#f59e0b"}`,
                }}
              />
              {researcherResp ? "Response ready" : "Awaiting command"}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {RESEARCHER_COMMANDS.map((cmd) => {
              const active = researcherResp !== null && researcherCmd === cmd;
              return (
                <button
                  key={cmd}
                  onClick={() => askResearcher(cmd)}
                  className="group flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-300 hover:translate-y-[-2px]"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                      : "rgba(255,255,255,0.65)",
                    borderColor: active ? "transparent" : "rgba(17,17,17,0.08)",
                    color: active ? "#fff" : "#111",
                    backdropFilter: "blur(10px)",
                    boxShadow: active
                      ? "0 16px 36px -16px rgba(124,58,237,0.55)"
                      : "0 8px 20px -12px rgba(17,17,17,0.15)",
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      background: active ? "#fff" : "#7c3aed",
                      boxShadow: active ? "0 0 8px #fff" : "0 0 6px #7c3aed",
                    }}
                  />
                  {cmd}
                </button>
              );
            })}
          </div>

          {/* Terminal-style response */}
          <div
            className="mt-8 overflow-hidden rounded-2xl border"
            style={{
              background: "linear-gradient(160deg, rgba(17,17,17,0.97), rgba(28,22,48,0.97))",
              borderColor: "rgba(124,58,237,0.25)",
              boxShadow: "0 30px 80px -40px rgba(124,58,237,0.5)",
            }}
          >
            {/* Terminal header */}
            <div
              className="flex items-center gap-3 border-b px-5 py-3"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#febc2e" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28c840" }} />
              </div>
              <span
                className="text-[11px] tracking-[0.2em] uppercase"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                researcher@classifyai ~ ai-shell
              </span>
              <span
                className="ml-auto text-[11px] tabular-nums"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {researcherResp ? "200 OK" : "READY"}
              </span>
            </div>

            <div
              className="px-6 py-7 font-mono text-[14px] leading-[1.85]"
              style={{ minHeight: 180 }}
            >
              <div className="flex items-start gap-2">
                <span style={{ color: "#7c3aed" }}>$</span>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>
                  {researcherCmd ?? "_"}
                  {!researcherCmd && (
                    <span
                      className="ml-0 inline-block w-2 align-middle"
                      style={{
                        background: "rgba(255,255,255,0.6)",
                        height: 14,
                        animation: "blink 1s steps(2) infinite",
                      }}
                    />
                  )}
                </span>
              </div>

              {researcherCmd && (
                <div className="mt-4 flex items-start gap-3">
                  <span
                    className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "#14b8a6", boxShadow: "0 0 10px #14b8a6" }}
                  />
                  <p style={{ color: "rgba(255,255,255,0.85)" }}>
                    {researcherResp ?? (
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>
                        analyzing
                        <span style={{ animation: "blink 1s steps(2) infinite" }}>...</span>
                      </span>
                    )}
                  </p>
                </div>
              )}

              {!researcherCmd && (
                <p className="mt-4 text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Pick a command above to see how your AI researcher responds.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============= ACT 5: Editorial closer ============= */}
      <div className="relative w-full px-6 pt-40 pb-20">
        <div className="mx-auto max-w-6xl">
          {/* Top rule + section index */}
          <div
            className="flex items-end justify-between border-t pt-5 text-[11px] tracking-[0.32em] uppercase"
            style={{ borderColor: "rgba(17,17,17,0.18)", color: "rgba(17,17,17,0.5)" }}
          >
            <span className="tabular-nums">05 / Outcome</span>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#14b8a6",
                  boxShadow: "0 0 10px #14b8a6",
                  animation: "pulseDot 1.8s ease-in-out infinite",
                }}
              />
              Run · 02:14:08 UTC
            </span>
          </div>

          {/* Editorial headline */}
          <div className="mt-14 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <h2
              className="font-semibold tracking-[-0.045em]"
              style={{ fontSize: "clamp(54px, 8vw, 128px)", lineHeight: 0.92, color: "#0d0d0d" }}
            >
              From data,
              <br />a{" "}
              <span className="font-sans font-bold" style={{ color: "#7c3aed" }}>
                decision.
              </span>
            </h2>
            <p
              className="max-w-md text-[15px] leading-[1.75]"
              style={{ color: "rgba(17,17,17,0.6)" }}
            >
              The model has read every row, weighed every feature, and committed to an answer.
              Below: the receipts. Use them, or train another set.
            </p>
          </div>

          {/* Stat row — Swiss / editorial, no boxes */}
          <div
            className="mt-20 grid grid-cols-1 gap-px sm:grid-cols-3"
            style={{ background: "rgba(17,17,17,0.12)" }}
          >
            {[
              {
                value: "98.4",
                suffix: "%",
                label: "Test accuracy",
                note: "5-fold cross-validated",
              },
              {
                value: "1,247",
                suffix: "",
                label: "Samples analyzed",
                note: "150 train · 1,097 inferred",
              },
              { value: "<3", suffix: "s", label: "Inference window", note: "p95 on CPU" },
            ].map((s) => (
              <div
                key={s.label}
                className="group/stat relative bg-[#f7f7f5] px-2 py-10 transition-colors duration-500 hover:bg-white"
              >
                <div className="flex items-end gap-1">
                  <span
                    className="font-semibold tabular-nums tracking-[-0.04em]"
                    style={{
                      fontSize: "clamp(48px, 6vw, 88px)",
                      lineHeight: 0.9,
                      color: "#0d0d0d",
                    }}
                  >
                    {s.value}
                  </span>
                  <span className="pb-3 text-[20px] font-medium" style={{ color: "#7c3aed" }}>
                    {s.suffix}
                  </span>
                </div>
                <div
                  className="mt-4 flex items-center justify-between text-[10px] tracking-[0.28em] uppercase"
                  style={{ color: "rgba(17,17,17,0.5)" }}
                >
                  <span>{s.label}</span>
                  <span
                    className="h-px w-8 transition-all duration-500 group-hover/stat:w-16"
                    style={{ background: "#7c3aed" }}
                  />
                </div>
                <div className="mt-2 text-[11px]" style={{ color: "rgba(17,17,17,0.42)" }}>
                  {s.note}
                </div>
              </div>
            ))}
          </div>

          {/* Action row — editorial buttons */}
          <div
            className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t pt-8"
            style={{ borderColor: "rgba(17,17,17,0.12)" }}
          >
            <div
              className="text-[11px] tracking-[0.32em] uppercase"
              style={{ color: "rgba(17,17,17,0.45)" }}
            >
              What's next
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "Train another dataset", primary: true },
                { label: "Download model", primary: false },
                { label: "Generate AI report", primary: false },
              ].map((b) => (
                <button
                  key={b.label}
                  className={`act5-btn group/btn relative inline-flex items-center gap-3 rounded-full px-6 py-3 text-[13px] font-medium transition-all duration-300 ${
                    b.primary ? "act5-btn-primary" : "act5-btn-ghost"
                  }`}
                >
                  <span className="relative z-10">{b.label}</span>
                  <span className="relative z-10 inline-block transition-transform duration-300 group-hover/btn:translate-x-1">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============= FOOTER ============= */}
        <footer className="mx-auto mt-32 max-w-6xl">
          <div
            className="footer-card group/footer relative overflow-hidden rounded-3xl border p-8 sm:p-12"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.7), rgba(245,243,255,0.5))",
              borderColor: "rgba(17,17,17,0.06)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 30px 80px -50px rgba(124,58,237,0.3)",
            }}
          >
            {/* Animated gradient sheen */}
            <div className="footer-sheen pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/footer:opacity-100" />
            {/* Aurora blob */}
            <div
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)",
                animation: "footerFloat 8s ease-in-out infinite",
              }}
            />
            <div
              className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(20,184,166,0.22), transparent 70%)",
                animation: "footerFloat 10s ease-in-out infinite reverse",
              }}
            />

            <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="grid h-8 w-8 place-items-center rounded-lg transition-transform duration-500 hover:rotate-[360deg] overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #14b8a6)",
                      boxShadow: "0 8px 20px -8px rgba(124,58,237,0.6)",
                    }}
                  >
                    <img src="/favicon.png" alt="ClassifyAI" className="h-6 w-6 object-contain" />
                  </div>
                  <FlipText
                    text="ClassifyAI"
                    className="text-[15px] font-semibold tracking-tight"
                  />
                </div>
                <p
                  className="mt-4 max-w-sm text-[13px] leading-[1.75]"
                  style={{ color: "rgba(17,17,17,0.55)" }}
                >
                  An AI data comprehension engine built with Machine Learning, Data Analysis, and
                  Intelligent Prediction Systems.
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      background: "#14b8a6",
                      boxShadow: "0 0 8px #14b8a6",
                      animation: "pulseDot 1.8s ease-in-out infinite",
                    }}
                  />
                  <span
                    className="text-[11px] tracking-[0.22em] uppercase"
                    style={{ color: "#0d8a7a" }}
                  >
                    System operational
                  </span>
                </div>
              </div>

              {/* Project meta */}
              <div>
                <div
                  className="text-[10px] tracking-[0.32em] uppercase"
                  style={{ color: "rgba(17,17,17,0.4)" }}
                >
                  Project
                </div>
                <ul className="mt-4 space-y-2.5 text-[13px]">
                  {[
                    "DecodeLabs Internship 2026",
                    "Artificial Intelligence Track",
                    "Project 2: Data Classification",
                    "v1.0 · Iris Dataset",
                  ].map((label) => (
                    <li key={label}>
                      <a className="footer-link group/link inline-flex items-center gap-2">
                        <span className="footer-link-arrow inline-block h-px w-0 bg-[#7c3aed] transition-all duration-500 group-hover/link:w-4" />
                        <FlipText text={label} className="footer-link-text" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech stack */}
              <div>
                <div
                  className="text-[10px] tracking-[0.32em] uppercase"
                  style={{ color: "rgba(17,17,17,0.4)" }}
                >
                  Built with
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Random Forest", "Scikit-learn", "Pandas", "NumPy", "React"].map((t, i) => (
                    <span
                      key={t}
                      className="tech-chip cursor-default rounded-full border px-2.5 py-1 text-[11px]"
                      style={{
                        borderColor: "rgba(17,17,17,0.1)",
                        background: "rgba(255,255,255,0.6)",
                        color: "rgba(17,17,17,0.7)",
                        animationDelay: `${i * 0.08}s`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Giant animated wordmark */}
            <div
              className="relative mt-12 overflow-hidden"
              style={{ containerType: "inline-size" }}
            >
              <div
                className="wordmark select-none whitespace-nowrap font-semibold leading-none tracking-[-0.06em]"
                style={{
                  fontSize: "clamp(40px, 10.8cqi, 160px)",
                  background:
                    "linear-gradient(90deg, #111 0%, #7c3aed 45%, #14b8a6 65%, #111 100%)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: "wordmarkShift 8s ease-in-out infinite",
                }}
              >
                {"DECODELABS".split("").map((ch, i) => (
                  <span
                    key={i}
                    className="wordmark-letter inline-block transition-transform duration-500"
                    style={{ transitionDelay: `${i * 30}ms` }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="relative mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[11px] tracking-[0.18em] uppercase"
              style={{ borderColor: "rgba(17,17,17,0.08)", color: "rgba(17,17,17,0.45)" }}
            >
              <span className="footer-link">
                <FlipText text="© 2026 ClassifyAI" />
              </span>
              <span className="tabular-nums" style={{ color: "#7c3aed" }}>
                98.4% · 5-fold CV · Stable
              </span>
              <span className="footer-link">
                <FlipText text="Crafted with intent" />
              </span>
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes pulseDot {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 14px; height: 14px; border-radius: 999px;
          background: #7c3aed; cursor: pointer;
          box-shadow: 0 0 0 4px rgba(124,58,237,0.15);
          margin-top: -6px;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 2px; background: rgba(17,17,17,0.12); border-radius: 999px;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 999px;
          background: #7c3aed; border: none; cursor: pointer;
          box-shadow: 0 0 0 4px rgba(124,58,237,0.15);
        }

        /* === Footer flourishes === */
        @keyframes wordmarkShift {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes footerFloat {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(20px,-20px) scale(1.1); }
        }
        @keyframes chipPulse {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .footer-sheen {
          background: linear-gradient(115deg, transparent 30%, rgba(124,58,237,0.08) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: wordmarkShift 4s linear infinite;
        }
        .wordmark-letter:hover {
          transform: translateY(-10px) scale(1.05);
        }
        .tech-chip {
          transition: transform 0.35s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s, border-color 0.35s, background 0.35s, color 0.35s;
        }
        .tech-chip:hover {
          transform: translateY(-3px) scale(1.06);
          border-color: rgba(124,58,237,0.5) !important;
          background: linear-gradient(135deg, rgba(124,58,237,0.12), rgba(20,184,166,0.10)) !important;
          color: #7c3aed !important;
          box-shadow: 0 10px 24px -10px rgba(124,58,237,0.45);
        }
        /* FlipText */
        .flip-text { line-height: 1.1; }
        .flip-char {
          transition: transform 0.45s cubic-bezier(.7,0,.3,1);
          will-change: transform;
        }
        .flip-text:hover .flip-char,
        .footer-link:hover .flip-char,
        a:hover > .flip-text .flip-char {
          transform: translateY(-100%);
        }
        .footer-link { cursor: pointer; }

        /* === Act 5 editorial buttons === */
        .act5-btn-primary {
          background: #0d0d0d;
          color: #fff;
          box-shadow: 0 14px 30px -14px rgba(13,13,13,0.5);
        }
        .act5-btn-primary:hover {
          background: linear-gradient(135deg, #0d0d0d, #2a1758);
          box-shadow: 0 18px 40px -14px rgba(124,58,237,0.55);
          transform: translateY(-2px);
        }
        .act5-btn-ghost {
          background: transparent;
          color: #0d0d0d;
          border: 1px solid rgba(17,17,17,0.18);
        }
        .act5-btn-ghost:hover {
          border-color: #0d0d0d;
          background: rgba(17,17,17,0.04);
          transform: translateY(-2px);
        }
      `}</style>
    </section>
  );
}
