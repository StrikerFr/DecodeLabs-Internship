import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import jsPDF from "jspdf";
import {
  parseFile,
  runModelLab,
  computeFeatureImportance,
  summaryForPrompt,
  type DatasetSummary,
} from "@/lib/datasetParser";
import { datasetStore, useDataset } from "@/lib/datasetStore";
import { groqChat } from "@/lib/groq.functions";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "ClassifyAI - Dataset Analysis" },
      {
        name: "description",
        content:
          "Watch an AI Data Scientist understand your dataset, compare models, and reveal insights in real time.",
      },
      { property: "og:url", content: "https://classifyai.decodelabs.io/analyze" },
    ],
    links: [{ rel: "canonical", href: "https://classifyai.decodelabs.io/analyze" }],
  }),
  component: AnalyzePage,
});

/* =========================================================================
   Page
   ========================================================================= */

function AnalyzePage() {
  const navigate = useNavigate();
  const ds = useDataset();
  const [stage, setStage] = useState<"await" | "loading" | "ready">(ds.summary ? "ready" : "await");
  const [loadMsg, setLoadMsg] = useState("Reading dataset...");
  const [error, setError] = useState<string | null>(null);
  const callGroq = useServerFn(groqChat);

  // Auto-pick up a file dropped on hero (passed via global)
  useEffect(() => {
    const file = (window as unknown as { __pendingFile?: File }).__pendingFile;
    if (file && !ds.summary) {
      delete (window as unknown as { __pendingFile?: File }).__pendingFile;
      handleFile(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setStage("loading");
    const steps = [
      "Reading dataset...",
      "Detecting column types...",
      "Mapping relationships...",
      "Testing model candidates...",
      "Generating insights...",
      "Understanding complete.",
    ];
    let i = 0;
    setLoadMsg(steps[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setLoadMsg(steps[i]);
    }, 900);

    try {
      const summary = await parseFile(file);
      const models = runModelLab(summary);
      const featureImportance = computeFeatureImportance(summary);
      datasetStore.set({
        fileName: file.name,
        summary,
        models,
        featureImportance,
      });

      // Kick off Groq calls in background
      runGroqUnderstanding(summary).catch(() => {});
      runGroqInsights(summary).catch(() => {});

      // Hold the cinematic for a beat
      await new Promise((r) => setTimeout(r, 1800));
      clearInterval(interval);
      setStage("ready");
    } catch (e) {
      clearInterval(interval);
      setError(e instanceof Error ? e.message : "Failed to read file.");
      setStage("await");
    }
  }

  async function runGroqUnderstanding(summary: DatasetSummary) {
    const res = await callGroq({
      data: {
        messages: [
          {
            role: "system",
            content:
              "You are an AI Data Scientist. Given a dataset summary in JSON, write a short, human, plain-English explanation in 2–4 sentences. Identify likely target variable, task type, and the strongest predictors. No bullet points. No headers. Just prose. Confident, calm, insightful.",
          },
          {
            role: "user",
            content: JSON.stringify(summaryForPrompt(summary)),
          },
        ],
        temperature: 0.4,
      },
    });
    datasetStore.set({ understanding: res.content });
  }

  async function runGroqInsights(summary: DatasetSummary) {
    const res = await callGroq({
      data: {
        json: true,
        messages: [
          {
            role: "system",
            content:
              'You are an AI Data Scientist. Return a JSON object: {"insights":[{"title":string,"body":string,"tone":"good"|"warn"|"info"}]}. Produce 4-6 insights covering: key findings, hidden relationships, potential problems, data quality. Be specific to the columns provided. Keep each body under 25 words. Return ONLY JSON.',
          },
          {
            role: "user",
            content: JSON.stringify(summaryForPrompt(summary)),
          },
        ],
        temperature: 0.55,
      },
    });
    try {
      const parsed = JSON.parse(res.content);
      if (Array.isArray(parsed.insights)) {
        datasetStore.set({ insights: parsed.insights });
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="relative min-h-screen w-full"
      style={{ background: "#0a0a0c", color: "#e8e8ea" }}
    >
      <AtmosphereBg />
      <TopBar
        fileName={ds.fileName}
        onReset={() => {
          datasetStore.reset();
          navigate({ to: "/" });
        }}
      />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-40 pt-28">
        {stage === "await" && <Dropzone onFile={handleFile} error={error} />}
        {stage === "loading" && <CinematicLoader message={loadMsg} />}
        {stage === "ready" && ds.summary && <ResearchStream summary={ds.summary} />}
      </main>

      {stage === "ready" && ds.summary && <FloatingCopilot />}
    </div>
  );
}

/* =========================================================================
   Atmosphere
   ========================================================================= */

function AtmosphereBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% -10%, rgba(124,58,237,0.22) 0%, rgba(20,184,166,0.08) 35%, rgba(10,10,12,0) 70%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="absolute -left-32 top-40 h-[480px] w-[480px] rounded-full blur-[120px]"
        style={{ background: "rgba(124,58,237,0.18)" }}
      />
      <div
        className="absolute -right-40 bottom-20 h-[520px] w-[520px] rounded-full blur-[140px]"
        style={{ background: "rgba(20,184,166,0.15)" }}
      />
    </div>
  );
}

function TopBar({ fileName, onReset }: { fileName: string | null; onReset: () => void }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-30 border-b backdrop-blur-xl"
      style={{ background: "rgba(10,10,12,0.6)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2.5 text-sm tracking-tight">
          <span
            className="relative inline-block h-2 w-2 rounded-full"
            style={{ background: "#a78bfa", boxShadow: "0 0 12px #a78bfa" }}
          />
          <span className="font-medium" style={{ color: "#e8e8ea" }}>
            AI Researcher
          </span>
          <span style={{ color: "rgba(232,232,234,0.4)" }}>/ session</span>
        </Link>
        <div className="flex items-center gap-3">
          {fileName && (
            <span
              className="rounded-full border px-3 py-1 text-[11px] tracking-tight"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(232,232,234,0.7)" }}
            >
              {fileName}
            </span>
          )}
          <button
            onClick={onReset}
            className="text-[12px] tracking-tight transition-opacity hover:opacity-100"
            style={{ color: "rgba(232,232,234,0.55)" }}
          >
            New session
          </button>
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   Dropzone
   ========================================================================= */

function Dropzone({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <h1
        className="text-center font-semibold tracking-[-0.03em]"
        style={{ fontSize: "clamp(34px, 5vw, 56px)" }}
      >
        Drop a dataset to begin.
      </h1>
      <p
        className="mt-3 max-w-lg text-center text-[15px]"
        style={{ color: "rgba(232,232,234,0.55)" }}
      >
        CSV, Excel, JSON, or TXT. The AI Researcher will read, understand, and explain it.
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => ref.current?.click()}
        className="mt-10 flex h-56 w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all"
        style={{
          borderColor: drag ? "rgba(167,139,250,0.7)" : "rgba(255,255,255,0.12)",
          background: drag ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
          boxShadow: drag ? "0 30px 80px -30px rgba(124,58,237,0.5)" : "none",
        }}
      >
        <div className="text-[15px]" style={{ color: "rgba(232,232,234,0.75)" }}>
          Drop file here, or click to browse
        </div>
        <div className="mt-2 text-[12px] tracking-wide" style={{ color: "rgba(232,232,234,0.4)" }}>
          .csv · .xlsx · .json · .txt
        </div>
        <input
          ref={ref}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls,.json,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
      {error && (
        <p className="mt-4 text-[13px]" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* =========================================================================
   Cinematic loader
   ========================================================================= */

function CinematicLoader({ message }: { message: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="relative h-40 w-40">
        <div
          className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full border"
          style={{ borderColor: "rgba(167,139,250,0.3)", borderTopColor: "rgba(167,139,250,0.9)" }}
        />
        <div
          className="absolute inset-3 animate-[spin_5s_linear_infinite_reverse] rounded-full border"
          style={{ borderColor: "rgba(20,184,166,0.25)", borderRightColor: "rgba(20,184,166,0.8)" }}
        />
        <div
          className="absolute inset-8 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(167,139,250,0.6), rgba(124,58,237,0))",
            filter: "blur(8px)",
            animation: "pulse 2.4s ease-in-out infinite",
          }}
        />
      </div>
      <div
        key={message}
        className="mt-10 text-[16px] tracking-tight"
        style={{
          color: "#e8e8ea",
          animation: "morphIn 0.6s ease-out",
        }}
      >
        {message}
      </div>
      <div
        className="mt-2 text-[11px] tracking-[0.22em] uppercase"
        style={{ color: "rgba(232,232,234,0.4)" }}
      >
        the researcher is thinking
      </div>
      <style>{`
        @keyframes morphIn {
          0% { opacity: 0; transform: translateY(6px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

/* =========================================================================
   The research stream — all stages
   ========================================================================= */

function ResearchStream({ summary }: { summary: DatasetSummary }) {
  return (
    <div className="space-y-32">
      <SectionUnderstanding summary={summary} />
      <SectionDiscoveries />
      <SectionModelBattle />
      <SectionFeatureImportance />
      <SectionPredictionPlayground summary={summary} />
      <SectionResearcherChat summary={summary} />
      <SectionGenerate summary={summary} />
    </div>
  );
}

function SectionLabel({ n, label, meta }: { n: string; label: string; meta?: string }) {
  return (
    <div className="mb-12 flex items-end justify-between gap-6">
      <div className="flex min-w-0 items-baseline gap-5">
        <span
          className="shrink-0 text-[12px]"
          style={{ color: "rgba(167,139,250,0.6)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {n}
        </span>
        <h2
          className="truncate font-light tracking-[-0.02em]"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(28px, 3.6vw, 44px)",
            color: "#f4f4f5",
          }}
        >
          {label}
        </h2>
      </div>
      <div className="hidden flex-1 md:flex md:items-center md:gap-6">
        <span
          className="h-px flex-1"
          style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0))",
          }}
        />
        <span
          className="text-[10px] tracking-[0.32em] uppercase"
          style={{ color: "rgba(232,232,234,0.35)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {meta ?? label}
        </span>
      </div>
    </div>
  );
}

/* ---------- 1. Understanding ---------- */

function SectionUnderstanding({ summary }: { summary: DatasetSummary }) {
  const { understanding } = useDataset();
  return (
    <section>
      <SectionLabel n="01" label="Dataset Understanding" meta="Telemetry Matrix" />
      <div className="space-y-10">
        <div className="max-w-4xl">
          <p
            className="font-light tracking-[-0.01em]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(20px, 2.1vw, 28px)",
              lineHeight: 1.4,
              color: "rgba(244,244,245,0.92)",
            }}
          >
            {understanding ? understanding : <Shimmer lines={3} />}
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-px overflow-hidden rounded-md shadow-2xl md:grid-cols-3 lg:grid-cols-6"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Stat label="Rows" value={summary.rows.toLocaleString()} />
          <Stat label="Columns" value={String(summary.cols)} />
          <Stat label="Missing" value={String(summary.missingTotal)} />
          <Stat label="Quality" value={`${summary.qualityScore}%`} accent />
          <Stat label="Task" value={summary.taskHint} mono />
          <Stat label="Target" value={summary.targetCandidates[0] ?? "N/A"} mono />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className="space-y-4 p-6 transition-colors duration-300 hover:bg-[#0c0c10]"
      style={{ background: "#08080a" }}
    >
      <div
        className="text-[10px] tracking-[0.22em] uppercase"
        style={{ color: "rgba(232,232,234,0.4)", fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
      <div
        className={`${mono ? "text-[18px]" : "text-[30px]"} font-light tracking-tight`}
        style={{
          color: accent ? "#5eead4" : "#f4f4f5",
          textShadow: accent ? "0 0 18px rgba(20,184,166,0.35)" : "none",
          fontFamily: mono ? "'JetBrains Mono', monospace" : "'Space Grotesk', sans-serif",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Shimmer({ lines = 1 }: { lines?: number }) {
  return (
    <span className="block space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="block h-6 w-full overflow-hidden rounded"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%)",
            backgroundSize: "200% 100%",
            animation: "shim 1.6s linear infinite",
            width: i === lines - 1 ? "70%" : "100%",
          }}
        />
      ))}
      <style>{`@keyframes shim { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </span>
  );
}

/* ---------- 2. Discoveries ---------- */

function SectionDiscoveries() {
  const { insights } = useDataset();
  const toneColor = (t: "good" | "warn" | "info") =>
    t === "good" ? "#5eead4" : t === "warn" ? "#fbbf24" : "#a78bfa";
  return (
    <section>
      <SectionLabel n="02" label="Discoveries" meta="Semantic Analysis" />
      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 blur-md"
          style={{
            background: "linear-gradient(120deg, rgba(124,58,237,0.18), rgba(20,184,166,0.16))",
          }}
        />
        <div
          className="relative rounded-2xl border p-2 shadow-2xl"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(8,8,10,0.92)",
          }}
        >
          <div
            className="space-y-px overflow-hidden rounded-xl"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {insights.length === 0 && (
              <div className="space-y-3 bg-[#08080a] p-6">
                <Shimmer lines={1} />
                <Shimmer lines={1} />
                <Shimmer lines={1} />
              </div>
            )}
            {insights.map((ins, i) => (
              <div
                key={i}
                className="group relative flex gap-5 bg-[#08080a] p-6 transition-colors hover:bg-[#0c0c10]"
                style={{ animation: `discoveryIn 0.6s ease-out ${i * 0.1}s both` }}
              >
                <div
                  className="w-[3px] shrink-0 self-stretch rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${toneColor(ins.tone)}, transparent)`,
                    boxShadow: `0 0 14px ${toneColor(ins.tone)}66`,
                  }}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] tracking-[0.28em] uppercase"
                      style={{
                        color: toneColor(ins.tone),
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")} · {ins.tone}
                    </span>
                  </div>
                  <div
                    className="font-light tracking-[-0.01em]"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "18px",
                      color: "#f4f4f5",
                    }}
                  >
                    {ins.title}
                  </div>
                  <div
                    className="text-[14px] leading-relaxed"
                    style={{ color: "rgba(232,232,234,0.65)" }}
                  >
                    {ins.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes discoveryIn {
          0% { opacity: 0; transform: translateY(8px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </section>
  );
}

/* ---------- 3. Model battle ---------- */

function SectionModelBattle() {
  const { models } = useDataset();
  if (!models.length) return null;
  const max = models[0]?.accuracy ?? 1;
  return (
    <section>
      <SectionLabel n="03" label="Model Battle" meta="Heuristic Ranking" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
        <div className="md:col-span-3 space-y-3">
          {models.map((m, i) => {
            const pct = (m.accuracy / max) * 100;
            const winner = i === 0;
            return (
              <div key={m.name} className="relative">
                {winner && (
                  <div
                    className="pointer-events-none absolute -inset-0.5 rounded-xl opacity-60 blur"
                    style={{
                      background:
                        "linear-gradient(120deg, rgba(94,234,212,0.35), rgba(124,58,237,0.25))",
                    }}
                  />
                )}
                <div
                  className="relative rounded-xl border p-5"
                  style={{
                    borderColor: winner ? "rgba(94,234,212,0.4)" : "rgba(255,255,255,0.07)",
                    background: winner ? "rgba(10,10,12,0.95)" : "rgba(8,8,10,0.85)",
                    boxShadow: winner ? "0 0 40px rgba(20,184,166,0.12)" : "none",
                    opacity: winner ? 1 : 0.78,
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span
                        className="text-[10px] tracking-[0.28em]"
                        style={{
                          color: winner ? "#5eead4" : "rgba(232,232,234,0.4)",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        RANK {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <div
                          className="font-light tracking-[-0.01em]"
                          style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: winner ? "22px" : "17px",
                            color: winner ? "#ffffff" : "rgba(232,232,234,0.85)",
                          }}
                        >
                          {m.name}
                        </div>
                        {winner && (
                          <div
                            className="mt-1 text-[10px] tracking-[0.28em] uppercase"
                            style={{
                              color: "rgba(94,234,212,0.7)",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            Optimal Precision Architecture
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-light tabular-nums tracking-tight"
                        style={{
                          fontSize: winner ? "34px" : "22px",
                          color: winner ? "#5eead4" : "rgba(232,232,234,0.7)",
                          fontFamily: "'Space Grotesk', sans-serif",
                          textShadow: winner ? "0 0 24px rgba(20,184,166,0.45)" : "none",
                        }}
                      >
                        {(m.accuracy * 100).toFixed(1)}%
                      </div>
                      <div
                        className="mt-1 text-[9px] tracking-[0.28em] uppercase"
                        style={{
                          color: "rgba(232,232,234,0.4)",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        Accuracy
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-4 h-[3px] w-full overflow-hidden rounded-full"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: winner
                          ? "linear-gradient(90deg, #5eead4, #14b8a6)"
                          : "linear-gradient(90deg, rgba(167,139,250,0.7), rgba(124,58,237,0.4))",
                        transition: "width 1.2s cubic-bezier(0.2,0.7,0.2,1)",
                        boxShadow: winner ? "0 0 12px rgba(20,184,166,0.5)" : "none",
                      }}
                    />
                  </div>
                  <div
                    className="mt-4 grid grid-cols-4 gap-3 text-[10px] tracking-[0.18em] uppercase"
                    style={{
                      color: "rgba(232,232,234,0.45)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <span>Prec {(m.precision * 100).toFixed(1)}</span>
                    <span>Rec {(m.recall * 100).toFixed(1)}</span>
                    <span>F1 {(m.f1 * 100).toFixed(1)}</span>
                    <span>{m.trainMs}ms</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="md:col-span-2">
          <div
            className="sticky top-24 rounded-2xl border p-7"
            style={{
              borderColor: "rgba(94,234,212,0.25)",
              background: "rgba(10,10,12,0.85)",
              boxShadow: "0 0 60px rgba(20,184,166,0.08)",
            }}
          >
            <div
              className="text-[10px] tracking-[0.28em] uppercase"
              style={{ color: "rgba(232,232,234,0.45)", fontFamily: "'JetBrains Mono', monospace" }}
            >
              Active Model
            </div>
            <div
              className="mt-3 font-light tracking-[-0.02em]"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(26px, 2.6vw, 34px)",
                color: "#ffffff",
              }}
            >
              {models[0].name}
            </div>
            <div
              className="mt-1 font-light"
              style={{
                color: "#5eead4",
                fontSize: "30px",
                fontFamily: "'Space Grotesk', sans-serif",
                textShadow: "0 0 18px rgba(20,184,166,0.4)",
              }}
            >
              {(models[0].accuracy * 100).toFixed(1)}%
            </div>
            <div
              className="mt-5 h-px w-16"
              style={{ background: "linear-gradient(90deg, #5eead4, transparent)" }}
            />
            <div
              className="mt-5 text-[13px] leading-relaxed"
              style={{ color: "rgba(232,232,234,0.6)" }}
            >
              The Researcher selected {models[0].name} based on accuracy, F1 score, and stability
              across folds.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4. Feature Importance ---------- */

function SectionFeatureImportance() {
  const { featureImportance } = useDataset();
  const top = featureImportance.slice(0, 8);
  return (
    <section>
      <SectionLabel n="04" label="Feature Importance" />
      <div className="space-y-2.5">
        {top.map((f, i) => (
          <div
            key={f.name}
            className="flex items-center gap-4"
            style={{ animation: `featIn 0.5s ease-out ${i * 0.06}s both` }}
          >
            <div
              className="w-44 truncate text-[13px] tracking-tight"
              style={{ color: i < 3 ? "#e8e8ea" : "rgba(232,232,234,0.6)" }}
            >
              {f.name}
            </div>
            <div
              className="relative h-7 flex-1 overflow-hidden rounded-md"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${f.importance * 100}%`,
                  background:
                    i < 3
                      ? "linear-gradient(90deg, rgba(94,234,212,0.7), rgba(20,184,166,0.4))"
                      : "linear-gradient(90deg, rgba(167,139,250,0.6), rgba(124,58,237,0.3))",
                  transition: "width 1.4s cubic-bezier(0.2,0.7,0.2,1)",
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-end pr-3 text-[11px] tabular-nums"
                style={{ color: "rgba(232,232,234,0.75)" }}
              >
                {(f.importance * 100).toFixed(0)}
                <span style={{ color: "rgba(232,232,234,0.35)" }} className="ml-2">
                  r={f.correlation.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes featIn { 0% { opacity: 0; transform: translateX(-12px); } 100% { opacity: 1; transform: translateX(0); } }`}</style>
    </section>
  );
}

/* ---------- 5. Prediction Playground ---------- */

function SectionPredictionPlayground({ summary }: { summary: DatasetSummary }) {
  const { featureImportance, models } = useDataset();
  const callGroq = useServerFn(groqChat);
  const inputCols = useMemo(
    () => featureImportance.slice(0, 6).map((f) => f.name),
    [featureImportance],
  );
  const colMap = useMemo(
    () => Object.fromEntries(summary.columns.map((c) => [c.name, c])),
    [summary.columns],
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    inputCols.forEach((n) => {
      const c = colMap[n];
      v[n] = c?.mean !== undefined ? c.mean.toFixed(2) : (c?.topValues?.[0]?.value ?? "");
    });
    return v;
  });
  const [prediction, setPrediction] = useState<{
    label: string;
    confidence: number;
    explanation: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [explainBusy, setExplainBusy] = useState(false);

  const target = summary.targetCandidates[0] ?? "outcome";

  async function predict() {
    setBusy(true);
    setPrediction(null);
    // Heuristic prediction: weighted sum of normalized features → score → label
    let score = 0;
    let weight = 0;
    featureImportance.slice(0, 6).forEach((f) => {
      const c = colMap[f.name];
      const v = Number(values[f.name]);
      if (c?.type === "numeric" && !isNaN(v) && c.max !== undefined && c.min !== undefined) {
        const range = c.max - c.min || 1;
        const norm = (v - c.min) / range;
        score += norm * f.importance * Math.sign(f.correlation || 1);
        weight += f.importance;
      }
    });
    const normalized = weight ? score / weight : 0;
    const positive = normalized >= 0;
    const conf = Math.max(0.62, Math.min(0.985, 0.7 + Math.abs(normalized) * 0.3));
    const targetCol = colMap[target];
    const labels =
      targetCol?.topValues?.map((t) => t.value).slice(0, 2) ??
      (summary.taskHint === "classification" ? ["Yes", "No"] : ["High", "Low"]);
    const label = positive ? labels[0] : (labels[1] ?? labels[0]);

    setPrediction({ label, confidence: conf, explanation: "" });
    setBusy(false);
  }

  async function explain() {
    if (!prediction) return;
    setExplainBusy(true);
    try {
      const res = await callGroq({
        data: {
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are an AI Data Scientist. Given the model name, target, input features, predicted label, and confidence, explain in 2 short sentences which features drove this prediction and why. Speak directly. No headers. No bullets. Avoid using hyphens or dashes to connect clauses.",
            },
            {
              role: "user",
              content: JSON.stringify({
                model: models[0]?.name,
                target,
                label: prediction.label,
                confidence: prediction.confidence,
                inputs: values,
                top_features: featureImportance.slice(0, 5).map((f) => ({
                  name: f.name,
                  importance: f.importance,
                  correlation: f.correlation,
                })),
              }),
            },
          ],
        },
      });
      setPrediction({ ...prediction, explanation: res.content });
    } finally {
      setExplainBusy(false);
    }
  }

  return (
    <section>
      <SectionLabel n="05" label="Prediction Playground" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <div
          className="md:col-span-3 rounded-2xl border p-6"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inputCols.map((name) => {
              const c = colMap[name];
              const opts = c?.topValues?.map((t) => t.value);
              return (
                <label key={name} className="block">
                  <div
                    className="mb-1 text-[11px] tracking-[0.18em] uppercase"
                    style={{ color: "rgba(232,232,234,0.45)" }}
                  >
                    {name}
                  </div>
                  {opts && c?.type !== "numeric" ? (
                    <select
                      value={values[name] ?? ""}
                      onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                      className="w-full rounded-lg border bg-transparent px-3 py-2 text-[14px] outline-none"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: "#e8e8ea" }}
                    >
                      {opts.map((o) => (
                        <option key={o} value={o} style={{ background: "#0a0a0c" }}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={values[name] ?? ""}
                      onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                      className="w-full rounded-lg border bg-transparent px-3 py-2 text-[14px] outline-none"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: "#e8e8ea" }}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <button
            onClick={predict}
            disabled={busy}
            className="mt-5 rounded-xl px-5 py-2.5 text-[14px] font-medium transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              color: "#fff",
              boxShadow: "0 12px 30px -10px rgba(124,58,237,0.6)",
            }}
          >
            {busy ? "Predicting…" : "Run prediction"}
          </button>
        </div>

        <div
          className="md:col-span-2 rounded-2xl border p-6"
          style={{
            borderColor: prediction ? "rgba(94,234,212,0.35)" : "rgba(255,255,255,0.08)",
            background: prediction ? "rgba(20,184,166,0.05)" : "rgba(255,255,255,0.02)",
          }}
        >
          <div
            className="text-[10px] tracking-[0.22em] uppercase"
            style={{ color: "rgba(232,232,234,0.5)" }}
          >
            Prediction · {target}
          </div>
          {prediction ? (
            <>
              <div
                className="mt-3 font-semibold tracking-[-0.02em]"
                style={{ fontSize: "clamp(26px, 2.8vw, 36px)" }}
              >
                {prediction.label}
              </div>
              <div className="mt-1 text-[18px]" style={{ color: "#5eead4" }}>
                {(prediction.confidence * 100).toFixed(1)}% confidence
              </div>
              {prediction.explanation ? (
                <div
                  className="mt-4 text-[13px] leading-relaxed"
                  style={{ color: "rgba(232,232,234,0.7)" }}
                >
                  {prediction.explanation}
                </div>
              ) : (
                <button
                  onClick={explain}
                  disabled={explainBusy}
                  className="mt-4 text-[12px] underline-offset-4 hover:underline disabled:opacity-50"
                  style={{ color: "#a78bfa" }}
                >
                  {explainBusy ? "Reasoning…" : "Why? Ask the researcher →"}
                </button>
              )}
            </>
          ) : (
            <div className="mt-3 text-[14px]" style={{ color: "rgba(232,232,234,0.55)" }}>
              Enter values and run a prediction to see the model's reasoning.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- 6. Researcher Chat ---------- */

type ChatMsg = { role: "user" | "assistant"; content: string };

function SectionResearcherChat({ summary }: { summary: DatasetSummary }) {
  const callGroq = useServerFn(groqChat);
  const { models, featureImportance } = useDataset();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestions = [
    "What does this dataset mean?",
    `Why is ${models[0]?.name ?? "the top model"} best?`,
    "Which features matter most?",
    "How can I improve accuracy?",
    "Explain this to a beginner.",
    "What business decisions can I make from this?",
  ];

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await callGroq({
        data: {
          temperature: 0.5,
          messages: [
            {
              role: "system",
              content:
                "You are the AI Data Scientist in an immersive analysis session. Speak with clarity, warmth, and authority. You have full context on the user's dataset, the trained models, and feature importance, so be sure to use it. Avoid markdown and do not use hyphens or dashes to connect clauses. Keep answers short and direct. When the user asks for business decisions, translate ML findings into concrete actions.",
            },
            {
              role: "user",
              content: `Context: ${JSON.stringify({
                dataset: summaryForPrompt(summary),
                top_models: models.slice(0, 3),
                top_features: featureImportance.slice(0, 5),
              })}`,
            },
            ...next.map((m) => ({ role: m.role, content: m.content })),
          ],
        },
      });
      setMsgs([...next, { role: "assistant", content: res.content }]);
    } catch (e) {
      setMsgs([
        ...next,
        {
          role: "assistant",
          content: `Sorry, ${e instanceof Error ? e.message : "request failed"}.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionLabel n="06" label="Ask the Researcher" />
      <div
        className="rounded-2xl border p-6"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
      >
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border px-3.5 py-1.5 text-[12px] transition-colors"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  color: "rgba(232,232,234,0.75)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.length > 0 && (
          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-2">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed"
                  style={
                    m.role === "user"
                      ? {
                          background: "rgba(167,139,250,0.18)",
                          color: "#e8e8ea",
                          border: "1px solid rgba(167,139,250,0.3)",
                        }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          color: "#e8e8ea",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-2.5 text-[14px]"
                  style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,232,234,0.55)" }}
                >
                  thinking…
                </div>
              </div>
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-5 flex items-center gap-2 rounded-xl border px-4 py-2.5"
          style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your dataset…"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "#e8e8ea" }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-40"
            style={{ background: "#a78bfa", color: "#0a0a0c" }}
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

/* ---------- 7+8. Generate report & presentation ---------- */

function SectionGenerate({ summary }: { summary: DatasetSummary }) {
  const callGroq = useServerFn(groqChat);
  const { models, featureImportance } = useDataset();
  const [busy, setBusy] = useState<"report" | "deck" | null>(null);
  const [deck, setDeck] = useState<{ title: string; bullets: string[] }[] | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string> | null>(null);

  async function genReport() {
    setBusy("report");
    try {
      const res = await callGroq({
        data: {
          temperature: 0.45,
          messages: [
            {
              role: "system",
              content:
                "You are a senior AI Data Scientist preparing a report for a stakeholder. Output plain text with section headers in CAPS. Sections: SUMMARY, KEY INSIGHTS, MODEL COMPARISON, BEST MODEL, RECOMMENDATIONS, CONCLUSION. Be concise, specific, and actionable.",
            },
            {
              role: "user",
              content: JSON.stringify({
                dataset: summaryForPrompt(summary),
                models,
                top_features: featureImportance.slice(0, 6),
              }),
            },
          ],
        },
      });
      const pdf = new jsPDF({ unit: "pt", format: "letter" });
      const margin = 56;
      const width = pdf.internal.pageSize.getWidth() - margin * 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("AI Researcher Report", margin, 80);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(120);
      pdf.text(
        `Dataset: ${summary.rows} rows × ${summary.cols} columns · Quality ${summary.qualityScore}%`,
        margin,
        100,
      );
      pdf.setTextColor(20);
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(res.content, width);
      pdf.text(lines, margin, 130);
      pdf.save("ai-researcher-report.pdf");
    } finally {
      setBusy(null);
    }
  }

  async function genDeck() {
    setBusy("deck");
    try {
      const res = await callGroq({
        data: {
          json: true,
          temperature: 0.55,
          messages: [
            {
              role: "system",
              content:
                'Return JSON: {"slides":[{"title":string,"bullets":string[]}],"prompts":{"gamma":string,"canva":string,"beautifulai":string,"tome":string,"pitch":string}}. Produce 9 slides: Title, Problem, Dataset Overview, Methodology, Model Comparison, Best Model, Insights, Conclusion, Future Improvements. Each slide: 3-4 short bullets. Each prompt: one paragraph the user can paste directly into that tool. ONLY JSON.',
            },
            {
              role: "user",
              content: JSON.stringify({
                dataset: summaryForPrompt(summary),
                models,
                top_features: featureImportance.slice(0, 6),
              }),
            },
          ],
        },
      });
      const parsed = JSON.parse(res.content);
      setDeck(parsed.slides);
      setPrompts(parsed.prompts);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <SectionLabel n="07" label="Generate" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          onClick={genReport}
          disabled={!!busy}
          className="group rounded-2xl border p-6 text-left transition-all hover:border-[rgba(167,139,250,0.4)] disabled:opacity-60"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <div
            className="text-[11px] tracking-[0.22em] uppercase"
            style={{ color: "rgba(232,232,234,0.45)" }}
          >
            One click
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-tight">
            {busy === "report" ? "Composing report…" : "Generate AI Report"}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "rgba(232,232,234,0.55)" }}>
            Summary, insights, model comparison, and recommendations exported as PDF.
          </div>
        </button>
        <button
          onClick={genDeck}
          disabled={!!busy}
          className="group rounded-2xl border p-6 text-left transition-all hover:border-[rgba(94,234,212,0.4)] disabled:opacity-60"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          <div
            className="text-[11px] tracking-[0.22em] uppercase"
            style={{ color: "rgba(232,232,234,0.45)" }}
          >
            One click
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-tight">
            {busy === "deck" ? "Composing slides…" : "Generate Presentation"}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "rgba(232,232,234,0.55)" }}>
            9-slide deck plus prompts for Gamma, Canva, Beautiful.ai, Tome, and Pitch.
          </div>
        </button>
      </div>

      {deck && (
        <div className="mt-8 space-y-4">
          <div
            className="text-[11px] tracking-[0.22em] uppercase"
            style={{ color: "rgba(232,232,234,0.45)" }}
          >
            Presentation draft
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {deck.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border p-4"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  className="text-[10px] tracking-[0.22em] uppercase"
                  style={{ color: "rgba(232,232,234,0.4)" }}
                >
                  Slide {i + 1}
                </div>
                <div className="mt-1 text-[15px] font-semibold tracking-tight">{s.title}</div>
                <ul
                  className="mt-2 space-y-1 text-[13px]"
                  style={{ color: "rgba(232,232,234,0.7)" }}
                >
                  {s.bullets?.map((b, j) => (
                    <li key={j}>· {b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {prompts && (
            <div
              className="mt-6 rounded-xl border p-5"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="text-[11px] tracking-[0.22em] uppercase"
                style={{ color: "rgba(232,232,234,0.45)" }}
              >
                Paste into
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.entries(prompts).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: "rgba(0,0,0,0.25)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="text-[11px] uppercase tracking-[0.2em]"
                        style={{ color: "#a78bfa" }}
                      >
                        {k}
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(v)}
                        className="text-[11px]"
                        style={{ color: "rgba(232,232,234,0.55)" }}
                      >
                        Copy
                      </button>
                    </div>
                    <div
                      className="mt-2 text-[12px] leading-relaxed"
                      style={{ color: "rgba(232,232,234,0.65)" }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================================
   Floating co-pilot
   ========================================================================= */

function FloatingCopilot() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const callGroq = useServerFn(groqChat);
  const { summary, models, featureImportance } = useDataset();

  async function send(prompt: string) {
    if (!summary || !prompt.trim()) return;
    setBusy(true);
    setReply("");
    try {
      const res = await callGroq({
        data: {
          temperature: 0.5,
          messages: [
            {
              role: "system",
              content:
                "You are the user's dataset co-pilot. Be very brief (1 to 3 sentences). Do not use hyphens or dashes to connect clauses. No markdown. Adapt: explain, summarize, suggest chart ideas, or draft posts as asked.",
            },
            {
              role: "user",
              content: `Dataset context: ${JSON.stringify({
                dataset: summaryForPrompt(summary),
                top_models: models.slice(0, 2),
                top_features: featureImportance.slice(0, 4),
              })}\n\nRequest: ${prompt}`,
            },
          ],
        },
      });
      setReply(res.content);
    } catch (e) {
      setReply(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const quick = ["Summarize this", "Generate chart ideas", "Draft a LinkedIn post"];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div
          className="mb-3 w-[360px] overflow-hidden rounded-2xl border backdrop-blur-xl"
          style={{
            borderColor: "rgba(167,139,250,0.3)",
            background: "rgba(10,10,12,0.85)",
            boxShadow: "0 30px 80px -20px rgba(124,58,237,0.5)",
          }}
        >
          <div
            className="border-b px-4 py-3 text-[12px] tracking-tight"
            style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(232,232,234,0.75)" }}
          >
            Co-pilot · always on
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border px-2.5 py-1 text-[11px]"
                  style={{
                    borderColor: "rgba(255,255,255,0.1)",
                    color: "rgba(232,232,234,0.7)",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
            {(reply || busy) && (
              <div
                className="mt-3 rounded-lg border p-3 text-[13px] leading-relaxed"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  color: "rgba(232,232,234,0.85)",
                }}
              >
                {busy ? "thinking…" : reply}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
                setText("");
              }}
              className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)" }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask anything…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "#e8e8ea" }}
              />
              <button type="submit" className="text-[11px]" style={{ color: "#a78bfa" }}>
                ↵
              </button>
            </form>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
          boxShadow: "0 12px 30px -6px rgba(124,58,237,0.7)",
          color: "#fff",
        }}
      >
        <span className="text-[20px]">✦</span>
      </button>
    </div>
  );
}
