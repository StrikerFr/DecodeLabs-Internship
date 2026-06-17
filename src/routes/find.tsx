import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RecommendScene from "@/components/shared/RecommendScene";
import CoverFlow from "@/components/shared/CoverFlow";
import { ALL_TAGS, MOVIES } from "@/constants/movies";
import { deriveSignals } from "@/utils/movie-scoring";
import type { Movie } from "@/types/movie";
import { recommendMovies, type AIRecMovie } from "@/services/recommend.functions";
import { z } from "zod";

const findSearchSchema = z.object({
  genre: z.string().optional(),
});

export const Route = createFileRoute("/find")({
  head: () => ({
    meta: [
      { title: "MoviePlex AI | Find Your Perfect Match" },
      { name: "description", content: "An immersive AI cinema concierge that finds your next obsession." },
      { property: "og:title", content: "MoviePlex AI | Find Your Perfect Match" },
      { property: "og:description", content: "Step inside an AI-powered cinematic universe." },
    ],
  }),
  validateSearch: findSearchSchema,
  component: FindPage,
});

type Phase = "select" | "scan" | "converge" | "reveal" | "explore";

const SCAN_STEPS = [
  "Analyzing taste profile",
  "Matching emotional patterns",
  "Searching 10,000+ titles",
  "Calculating similarity score",
  "Finding your perfect match",
];

const CATALOG_REASONS: Record<string, string> = {
  "interstellar": "A magnificent exploration of human connection across space and time. Christopher Nolan's visual scale and Hans Zimmer's iconic organ score create an unforgettable emotional gravity.",
  "arrival": "A quiet, profound masterpiece about communication and the perception of time. Denis Villeneuve handles the sci-fi grandeur with an intimate, deeply moving emotional resonance.",
  "blade-runner-2049": "A visual and sonic triumph that builds beautifully on the original's philosophical questions. Roger Deakins' cinematography captures a breathtaking, melancholic future.",
  "dune": "A cinematic epic of unprecedented scale. Villeneuve translates Frank Herbert's desert planet with visual majesty, atmospheric tension, and a powerful, immersive score.",
  "inception": "A brilliant, high-concept puzzle that remains emotionally grounded. Christopher Nolan masterfully orchestrates multiple dream layers with clockwork precision."
};

function aiToMovie(r: AIRecMovie): Movie {
  return {
    id: r.id,
    title: r.title,
    year: r.year,
    tagline: r.tagline || "A cinematic match.",
    director: r.director || "—",
    runtime: r.runtime || "",
    poster: r.poster,
    backdrop: r.backdrop,
    tags: r.tags,
    streaming: r.streaming as Movie["streaming"],
    youtube: r.youtube,
  };
}

/* Image with graceful fallback to a gradient title card */
function SmartImg({
  src,
  alt,
  title,
  className,
}: {
  src?: string;
  alt: string;
  title: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(!src);
  if (errored) {
    return (
      <div className={`cm-smart-fallback ${className ?? ""}`}>
        <span>{title}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}


function FindPage() {
  const { genre } = Route.useSearch();
  const [selected, setSelected] = useState<string[]>(genre ? [genre] : []);
  const [customPrompt, setCustomPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [scanStep, setScanStep] = useState(0);
  const [matchScore, setMatchScore] = useState(0);
  const [winner, setWinner] = useState<Movie | null>(null);
  const [explanation, setExplanation] = useState<string>("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [aiMovies, setAiMovies] = useState<Movie[] | null>(null);
  const [aiError, setAiError] = useState<string>("");

  const phaseRef = useRef<"scan" | "converge" | "reveal">("scan");
  const rankRef = useRef<number[]>(MOVIES.map((_, i) => i));
  const finalIndexRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);

  // Sync selected tags when genre search query changes
  useEffect(() => {
    if (genre) {
      setSelected([genre]);
    }
  }, [genre]);

  // body cinematic mode
  useEffect(() => {
    document.body.classList.add("movieplex");
    return () => document.body.classList.remove("movieplex");
  }, []);

  // mouse + cursor
  useEffect(() => {
    let cx = 0, cy = 0, tx = 0, ty = 0, raf = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX; ty = e.clientY;
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, a, [data-hover]")) cursorRef.current?.classList.add("is-hover");
      else cursorRef.current?.classList.remove("is-hover");
    };
    const loop = () => {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      if (cursorRef.current) cursorRef.current.style.transform = `translate3d(${cx}px,${cy}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);

  const toggleTag = (t: string) => {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  };

  const startMatching = async () => {
    const signals = deriveSignals(selected, customPrompt);
    if (signals.length === 0 && customPrompt.trim().length < 3) return;
    try {
      localStorage.setItem("movieplex_user_tags", JSON.stringify(signals));
    } catch (e) {
      console.warn("Failed to write user tags to localStorage", e);
    }
    setAiError("");
    setAiMovies(null);

    // Reset to scan phase with placeholder MOVIES carousel
    rankRef.current = MOVIES.map((_, i) => i);
    finalIndexRef.current = 0;
    setPhase("scan");
    phaseRef.current = "scan";
    setExplainLoading(true);

    // Call the AI in parallel with the scan animation
    const aiPromise = recommendMovies({ data: { tags: selected, customPrompt } })
      .then((r) => r.movies.map(aiToMovie))
      .catch((e) => {
        console.error(e);
        setAiError("AI is offline right now. Showing curated picks instead.");
        // graceful fallback to first 5 catalog movies
        return MOVIES.slice(0, 5);
      });

    // step through scanning messages
    for (let i = 0; i < SCAN_STEPS.length; i++) {
      setScanStep(i);
      await wait(900 + i * 120);
    }

    // wait for AI if it's still pending
    const movies = await aiPromise;
    setAiMovies(movies);
    rankRef.current = movies.map((_, i) => i);
    finalIndexRef.current = 0;
    const reasoning = (movies[0] as any).reasoning as string | undefined;
    const movieKey = movies[0].id;
    const fallbackReason = CATALOG_REASONS[movieKey] || `This cinematic masterpiece aligns perfectly with your taste. With its immersive atmosphere and themes, director ${movies[0].director} delivers a powerful storytelling experience that makes it a perfect watch for tonight.`;

    // converge
    setPhase("converge");
    phaseRef.current = "converge";
    await wait(1600);

    // reveal
    setPhase("reveal");
    phaseRef.current = "reveal";
    setWinner(movies[0]);
    setExplanation(reasoning || fallbackReason);

    // animate score counter
    const aiScore = (await aiPromise.then((m) => (m[0] as any))).matchScore ?? 95;
    const target = Math.max(40, Math.min(99, Math.round(aiScore)));
    const checkpoints = [0, 15, 37, 58, 82, Math.max(82, target - 6), target];
    for (let i = 0; i < checkpoints.length; i++) {
      const from = i === 0 ? 0 : checkpoints[i - 1];
      const to = checkpoints[i];
      await animateScore(from, to, 280 + i * 60, setMatchScore);
      await wait(80);
    }
    scoreRef.current = target;
    setExplainLoading(false);
  };

  const reset = () => {
    setPhase("select");
    setScanStep(0);
    setMatchScore(0);
    setWinner(null);
    setExplanation("");
    setAiMovies(null);
    setAiError("");
    setSelected(genre ? [genre] : []);
  };


  return (
    <>
      <div className="cm-cursor" ref={cursorRef} />
      <div className="cm-grain" />
      <div className="cm-vignette" />

      {/* 3D background scene during scan/converge/reveal */}
      {phase !== "select" && phase !== "explore" && (
        <div className="cm-3d-bg">
          <RecommendScene
            movies={aiMovies ?? MOVIES.slice(0, 5)}
            rankRef={rankRef}
            phaseRef={phaseRef}
            finalIndexRef={finalIndexRef}
            scoreRef={scoreRef}
            mouseRef={mouseRef}
          />
        </div>
      )}

      <nav className="cm-nav">
        <a href="/" data-hover>
          <span className="dot" />
          MoviePlex AI
        </a>
        <button onClick={reset} data-hover style={{ background: "none", border: "none", color: "inherit", font: "inherit", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          {phase === "select" ? "Concierge" : "Restart"}
        </button>
      </nav>

      <main style={{ position: "relative", minHeight: "100vh" }}>
        <AnimatePresence mode="wait">
          {phase === "select" && (
            <SelectScreen
              key="select"
              selected={selected}
              customPrompt={customPrompt}
              toggleTag={toggleTag}
              setCustomPrompt={setCustomPrompt}
              onStart={startMatching}
            />
          )}

          {(phase === "scan" || phase === "converge") && (
            <ScanOverlay key="scan" step={scanStep} />
          )}

          {phase === "reveal" && winner && (
            <RevealOverlay
              key="reveal"
              movie={winner}
              score={matchScore}
              selected={deriveSignals(selected, customPrompt)}
              explanation={explanation}
              explainLoading={explainLoading}
              onExplore={() => setPhase("explore")}
              onReset={reset}
            />
          )}

          {phase === "explore" && winner && (
            <ExploreScreen
              key="explore"
              movies={aiMovies ?? [winner]}
              winner={winner}
              onPick={(m) => setWinner(m)}
              onBack={() => setPhase("reveal")}
              onReset={reset}
            />
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

/* ---------- Phase: select ---------- */
function SelectScreen({
  selected,
  customPrompt,
  toggleTag,
  setCustomPrompt,
  onStart,
}: {
  selected: string[];
  customPrompt: string;
  toggleTag: (t: string) => void;
  setCustomPrompt: (value: string) => void;
  onStart: () => void;
}) {
  const canStart = selected.length > 0 || customPrompt.trim().length >= 3;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "120px 24px 60px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Floating background poster marquees */}
      <div 
        className="cm-poster-layer" 
        aria-hidden 
        style={{ 
          opacity: 0.38, 
          filter: "blur(1.5px) brightness(0.8) contrast(1.1)",
          zIndex: 1
        }}
      >
        <div className="cm-poster-row cm-poster-row--top">
          {[...MOVIES, ...MOVIES].map((m, i) => (
            <figure className="cm-poster" key={`t-${i}`} style={{ cursor: "default" }}>
              <img src={m.poster} alt={m.title} loading="lazy" />
            </figure>
          ))}
        </div>
        <div className="cm-poster-row cm-poster-row--bottom">
          {[...MOVIES.slice().reverse(), ...MOVIES.slice().reverse()].map((m, i) => (
            <figure className="cm-poster" key={`b-${i}`} style={{ cursor: "default" }}>
              <img src={m.poster} alt={m.title} loading="lazy" />
            </figure>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="cm-eyebrow">MoviePlex · Concierge Protocol 02</div>
        <h1
          className="cm-headline"
          style={{ fontSize: "clamp(40px, 7.5vw, 104px)", marginTop: 22, maxWidth: 1100 }}
        >
          Tell us how you<br />want to feel tonight.
        </h1>
        <p style={{ marginTop: 24, maxWidth: 540, color: "rgba(210,218,235,0.6)", fontSize: 14, lineHeight: 1.6 }}>
          Select the moods, atmospheres and dimensions you're drawn to. Our AI will map them against ten thousand films and find the one made for this exact moment.
        </p>

        <div className="cm-chips">
          {ALL_TAGS.map((t) => {
            const active = selected.includes(t);
            return (
              <button
                key={t}
                data-hover
                onClick={() => toggleTag(t)}
                className={`cm-chip ${active ? "is-active" : ""}`}
              >
                <span className="cm-chip-dot" />
                {t}
              </button>
            );
          })}
        </div>

        <div className="cm-custom-signal">
          <label htmlFor="custom-movie-signal" className="cm-eyebrow">Custom signal</label>
          <textarea
            id="custom-movie-signal"
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="Type anything: cozy romance, sad breakup movie, dark detective thriller, fast action with neon..."
            maxLength={220}
            data-hover
          />
        </div>

        <div className="cm-trending">
          <div className="cm-trending-label">Trending</div>
          <div className="cm-trending-row">
            {["Masters of the Universe","Off Campus","Michael","Widow's Bay","Project Hail Mary","Cape Fear","They Will Kill You","From","Dune: Part Three","Mickey 17"].map((t) => (
              <button
                key={t}
                type="button"
                data-hover
                className="cm-trending-pill"
                onClick={() => setCustomPrompt(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          className="cm-cta"
          data-hover
          onClick={onStart}
          disabled={!canStart}
          style={{ marginTop: 42, opacity: canStart ? 1 : 0.4 }}
        >
          <span className="cm-cta-dot" />
          Find my movie
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </motion.button>

        <div style={{ marginTop: 14, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(180,190,210,0.45)" }}>
          {selected.length + (customPrompt.trim() ? 1 : 0)} signal{selected.length + (customPrompt.trim() ? 1 : 0) === 1 ? "" : "s"} selected
        </div>
      </div>
    </motion.section>
  );
}

/* ---------- Phase: scan ---------- */
function ScanOverlay({ step }: { step: number }) {
  return (
    <motion.div
      key="scan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 25,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        textAlign: "center",
      }}
    >
      <div className="cm-eyebrow" style={{ marginBottom: 36 }}>MoviePlex · Searching the multiverse</div>
      <div className="cm-scan-stack">
        {SCAN_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "pending";
          return (
            <div key={s} className={`cm-scan-line is-${state}`}>
              <span className="cm-scan-marker">
                {state === "done" ? "●" : state === "active" ? "○" : "·"}
              </span>
              <span className="cm-scan-text">{s}</span>
              {state === "active" && (
                <span className="cm-scan-dots">
                  <i /><i /><i />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ---------- Phase: reveal ---------- */
function RevealOverlay({
  movie,
  score,
  selected,
  explanation,
  explainLoading,
  onExplore,
  onReset,
}: {
  movie: Movie;
  score: number;
  selected: string[];
  explanation: string;
  explainLoading: boolean;
  onExplore: () => void;
  onReset: () => void;
}) {
  const backdropSrc = movie.backdrop || movie.poster;
  return (
    <motion.section
      key="reveal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      style={{ position: "relative", zIndex: 20, padding: "120px 24px 100px", overflow: "hidden" }}
    >
      {/* Blurred backdrop hero */}
      <div className="cm-reveal-backdrop" aria-hidden="true">
        <SmartImg src={backdropSrc} alt="" title={movie.title} className="cm-reveal-backdrop-img" />
        <div className="cm-reveal-backdrop-veil" />
      </div>
      <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative" }}>

        {/* Eyebrow */}
        <motion.div
          className="cm-eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          style={{ textAlign: "center" }}
        >
          Tonight's Perfect Match
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 380px) 1fr", gap: 60, marginTop: 40, alignItems: "start" }} className="cm-reveal-grid">
          {/* Poster column */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
            className="cm-reveal-poster"
          >
            <SmartImg src={movie.poster} alt={movie.title} title={movie.title} />
            <div className="cm-reveal-poster-badge">{movie.year}</div>
            <div className="cm-reveal-poster-glow" />
          </motion.div>

          {/* Info */}
          <div>
            <motion.h1
              className="cm-headline"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ fontSize: "clamp(48px, 7vw, 108px)", letterSpacing: "-0.045em" }}
            >
              {movie.title.toUpperCase()}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              style={{ marginTop: 14, display: "flex", gap: 18, color: "rgba(200,210,230,0.6)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              <span>{movie.year}</span>
              <span>·</span>
              <span>{movie.director}</span>
              <span>·</span>
              <span>{movie.runtime}</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
              style={{ marginTop: 22, fontSize: 18, lineHeight: 1.5, color: "rgba(220,228,245,0.85)", maxWidth: 540, fontStyle: "italic" }}
            >
              "{movie.tagline}"
            </motion.p>

            {/* Match score */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="cm-match"
            >
              <div className="cm-match-num">
                <span>{score}</span>
                <small>%</small>
              </div>
              <div className="cm-match-meta">
                <div className="cm-eyebrow">Cinematic Match Score</div>
                <div className="cm-match-bar">
                  <div className="cm-match-bar-fill" style={{ width: `${score}%` }} />
                </div>
              </div>
            </motion.div>

            {/* Why we picked */}
            <div style={{ marginTop: 48 }}>
              <div className="cm-eyebrow">Why we picked this</div>
              <div className="cm-tags">
                {selected.map((t, i) => (
                  <motion.div
                    key={t}
                    className="cm-tag"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 + i * 0.15, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <span className="cm-tag-check">✓</span>
                    {t}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Groq explanation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8, duration: 1 }}
              className="cm-groq"
            >
              <div className="cm-eyebrow" style={{ marginBottom: 12 }}>Why you'll love this · MoviePlex AI</div>
              {explainLoading ? (
                <div className="cm-groq-loading">
                  <span /><span /><span />
                </div>
              ) : (
                <p>{explanation}</p>
              )}
            </motion.div>

            {/* Streaming */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, duration: 0.8 }}
              style={{ marginTop: 48 }}
            >
              <div className="cm-eyebrow">Available on</div>
              <div className="cm-streams">
                {movie.streaming.map((s) => (
                  <div key={s} className="cm-stream" data-hover>
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.6 }}
              style={{ marginTop: 48, display: "flex", gap: 18, flexWrap: "wrap" }}
            >
              <button className="cm-cta" data-hover onClick={onExplore}>
                <span className="cm-cta-dot" />
                Explore more
              </button>
              <button className="cm-ghost" data-hover onClick={onReset}>
                Try different signals
              </button>
            </motion.div>
          </div>
        </div>

        {/* YouTube companion */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4, duration: 1 }}
          style={{ marginTop: 100 }}
        >
          <div className="cm-eyebrow" style={{ textAlign: "center" }}>Companion Discovery</div>
          <h2 className="cm-headline" style={{ fontSize: "clamp(28px,3.5vw,52px)", textAlign: "center", marginTop: 8 }}>
            Explore the universe of {movie.title}.
          </h2>
          <div className="cm-yt-grid">
            {movie.youtube.map((y, i) => (
              <a
                key={i}
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(y.query)}`}
                target="_blank"
                rel="noreferrer"
                className="cm-yt"
                data-hover
              >
                <div className="cm-yt-thumb">
                  <SmartImg
                    src={movie.backdrop || movie.poster}
                    alt=""
                    title={movie.title}
                    className="cm-yt-thumb-img"
                  />
                  <div className="cm-yt-thumb-veil" />
                  <div className="cm-yt-play">▶</div>
                  <span className="cm-yt-badge">YouTube</span>
                </div>
                <div className="cm-yt-meta">
                  <span className="cm-eyebrow">YouTube · Featured</span>
                  <div className="cm-yt-title">{y.title}</div>
                </div>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

/* ---------- Phase: explore (coverflow) ---------- */
function ExploreScreen({
  movies,
  winner,
  onPick,
  onBack,
  onReset,
}: {
  movies: Movie[];
  winner: Movie;
  onPick: (m: Movie) => void;
  onBack: () => void;
  onReset: () => void;
}) {
  return (
    <motion.section
      key="explore"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      style={{
        minHeight: "100vh",
        position: "relative",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px 60px",
        background: "radial-gradient(ellipse at center, rgba(20,30,55,0.4), #04050a 70%)",
      }}
    >
      <div className="cm-eyebrow">The Vault · Continue Exploring</div>
      <h2 className="cm-headline" style={{ fontSize: "clamp(36px, 5vw, 72px)", marginTop: 16, textAlign: "center" }}>
        Drift through your dimension.
      </h2>

      <CoverFlow movies={movies} activeId={winner.id} onSelect={onPick} />

      <div style={{ marginTop: 56, display: "flex", gap: 14 }}>
        <button className="cm-cta" data-hover onClick={onBack}>
          <span className="cm-cta-dot" />
          Back to match
        </button>
        <button className="cm-ghost" data-hover onClick={onReset}>
          Restart concierge
        </button>
      </div>
    </motion.section>
  );
}

/* ---------- helpers ---------- */
function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function animateScore(from: number, to: number, ms: number, setter: (n: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setter(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}