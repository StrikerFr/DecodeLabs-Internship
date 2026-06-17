import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";



// Rotating atmospheric cinema quotes
const FLOATING_QUOTES = [
  { text: "We'll always have Paris.", movie: "Casablanca" },
  { text: "Dreams feel real while we're in them.", movie: "Inception" },
  { text: "Do not go gentle into that good night.", movie: "Interstellar" },
  { text: "All those moments will be lost in time, like tears in rain.", movie: "Blade Runner" },
  { text: "My God, it's full of stars.", movie: "2001: A Space Odyssey" },
  { text: "The universe is so much bigger than you realize.", movie: "Everything Everywhere All at Once" }
];

// Constellation mapping of genres with relative coordinates
const CONSTELLATION_STARS = [
  { name: "Sci-Fi", x: 80, y: 70 },
  { name: "Space", x: 260, y: 50 },
  { name: "Mind-Bending", x: 180, y: 120 },
  { name: "Emotional", x: 60, y: 190 },
  { name: "Romance", x: 130, y: 220 },
  { name: "Thriller", x: 300, y: 140 },
  { name: "Noir", x: 260, y: 200 },
  { name: "Action", x: 320, y: 80 }
];

const CONSTELLATION_LINKS = [
  { from: "Sci-Fi", to: "Space" },
  { from: "Sci-Fi", to: "Mind-Bending" },
  { from: "Space", to: "Action" },
  { from: "Mind-Bending", to: "Thriller" },
  { from: "Thriller", to: "Noir" },
  { from: "Emotional", to: "Romance" },
  { from: "Emotional", to: "Mind-Bending" },
  { from: "Noir", to: "Romance" }
];

export default function FinalFrame() {
  const navigate = useNavigate();
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [searchedTags, setSearchedTags] = useState<string[]>([]);
  const [constellationHovered, setConstellationHovered] = useState<string | null>(null);

  // Rotating quotes timer
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % FLOATING_QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Retrieve user tag history safely on client side
  useEffect(() => {
    try {
      const stored = localStorage.getItem("movieplex_user_tags");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSearchedTags(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to read tags from localStorage", e);
    }
  }, []);

  // Removed canvas background animation hook to ensure a clean gradient background

  // Compute profile statistics based on user history or default values
  const hasHistory = searchedTags.length > 0;
  const computedMetrics = hasHistory
    ? [
        { name: "Sci-Fi Universe", pct: searchedTags.includes("Sci-Fi") || searchedTags.includes("Space") ? 88 : 35 },
        { name: "Mind-Bending Dimensions", pct: searchedTags.includes("Mind-Bending") ? 82 : 45 },
        { name: "Emotional Stories", pct: searchedTags.includes("Emotional") || searchedTags.includes("Romance") ? 76 : 50 },
        { name: "Noir & Thriller Atmospheres", pct: searchedTags.includes("Noir") || searchedTags.includes("Thriller") ? 85 : 40 }
      ].sort((a, b) => b.pct - a.pct)
    : [
        { name: "Sci-Fi Universe", pct: 85 },
        { name: "Mind-Bending Dimensions", pct: 75 },
        { name: "Emotional Masterpieces", pct: 60 },
        { name: "Space Exploration", pct: 55 }
      ];

  return (
    <footer id="about" className="cm-site-footer cm-final-frame-container">

      {/* Giant Shimmering Background Typography */}
      <div className="cm-footer-giant-wordmark" aria-hidden="true">
        THE FINAL FRAME
      </div>

      <div className="cm-final-frame-layout">
        {/* TOP ROW: Atmospheric Floating Quote */}
        <div className="cm-final-frame-quote-section">
          <AnimatePresence mode="wait">
            <motion.div
              key={quoteIdx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 0.65, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 1.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="cm-final-frame-quote"
            >
              "{FLOATING_QUOTES[quoteIdx].text}"
              <span className="cm-final-frame-quote-author">
                — {FLOATING_QUOTES[quoteIdx].movie}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* MIDDLE GRID: Interactive Constellation & Profile Wrapped */}
        <div className="cm-final-frame-grid">
          
          {/* Column A: Interactive Genre Constellation */}
          <div className="cm-final-frame-col">
            <div className="cm-eyebrow" style={{ marginBottom: 20 }}>
              Taste Constellation
            </div>
            <div className="cm-constellation-box">
              <div className="cm-constellation-bg-glow" />
              <svg viewBox="0 0 400 300" className="cm-constellation-svg">
                {/* Connecting Lines */}
                {CONSTELLATION_LINKS.map((link, idx) => {
                  const fromStar = CONSTELLATION_STARS.find((s) => s.name === link.from);
                  const toStar = CONSTELLATION_STARS.find((s) => s.name === link.to);
                  if (!fromStar || !toStar) return null;

                  const isActive =
                    (searchedTags.includes(fromStar.name) ||
                      (fromStar.name === "Space" && searchedTags.includes("Space")) ||
                      (fromStar.name === "Noir" && searchedTags.includes("Noir"))) &&
                    (searchedTags.includes(toStar.name) ||
                      (toStar.name === "Space" && searchedTags.includes("Space")) ||
                      (toStar.name === "Noir" && searchedTags.includes("Noir")));

                  return (
                    <g key={idx}>
                      <line
                        x1={fromStar.x}
                        y1={fromStar.y}
                        x2={toStar.x}
                        y2={toStar.y}
                        className={`cm-constellation-line ${isActive ? "is-active" : ""}`}
                      />
                      {isActive && (
                        <motion.line
                          x1={fromStar.x}
                          y1={fromStar.y}
                          x2={toStar.x}
                          y2={toStar.y}
                          stroke="rgba(180, 210, 255, 0.7)"
                          strokeWidth={2}
                          strokeDasharray="6 14"
                          animate={{ strokeDashoffset: [-20, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Stars (Nodes) */}
                {CONSTELLATION_STARS.map((star, idx) => {
                  const tagLookup = star.name === "Space" ? "Space" : star.name === "Noir" ? "Noir" : star.name;
                  const isExplored = searchedTags.includes(tagLookup);

                  return (
                    <g
                      key={idx}
                      className="cm-constellation-node"
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate({ to: "/find", search: { genre: tagLookup } })}
                      onMouseEnter={() => setConstellationHovered(star.name)}
                      onMouseLeave={() => setConstellationHovered(null)}
                    >
                      {/* slow breathing glow behind unexplored/explored stars */}
                      <motion.circle
                        cx={star.x}
                        cy={star.y}
                        r={isExplored ? 12 : 7}
                        fill="none"
                        stroke={isExplored ? "rgba(184, 208, 255, 0.3)" : "rgba(255, 255, 255, 0.05)"}
                        strokeWidth={1}
                        animate={isExplored ? { scale: [0.9, 1.3, 0.9] } : { scale: [0.9, 1.1, 0.9] }}
                        transition={{ repeat: Infinity, duration: 3 + (idx % 3), ease: "easeInOut" }}
                      />
                      
                      {isExplored && (
                        <motion.circle
                          cx={star.x}
                          cy={star.y}
                          r={18}
                          fill="none"
                          stroke="rgba(180, 210, 255, 0.2)"
                          strokeWidth={1}
                          animate={{ scale: [0.7, 1.5, 0.7], opacity: [0.3, 0.8, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2.5 + (idx % 2), ease: "easeInOut" }}
                        />
                      )}

                      <motion.circle
                        cx={star.x}
                        cy={star.y}
                        r={isExplored ? 7 : 4.5}
                        className={`cm-constellation-star ${isExplored ? "is-active" : ""}`}
                        whileHover={{ scale: 1.5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 12 }}
                      />
                      
                      <text
                        x={star.x}
                        y={star.y - 14}
                        textAnchor="middle"
                        className="cm-constellation-text"
                      >
                        {star.name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Constellation Tooltip */}
              <div className="cm-constellation-tooltip">
                <AnimatePresence>
                  {constellationHovered && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="cm-constellation-tooltip-inner"
                    >
                      {searchedTags.includes(constellationHovered) ? (
                        <span>✨ Explored today • {constellationHovered}</span>
                      ) : (
                        <span>Click to explore {constellationHovered}</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Column B: Cinematic Taste Profile (Wrapped style) */}
          <div className="cm-final-frame-col">
            <div className="cm-eyebrow" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="cm-neural-beacon" />
              Cinematic Profile
            </div>
            <div className="cm-taste-profile">
              <p className="cm-taste-profile-desc">
                {hasHistory
                  ? "Based on your neural concierge queries today, we mapped your taste dimensions:"
                  : "Start exploring to map your tastes. Here is how MoviePlex matches overall catalog dimensions:"}
              </p>
              <div className="cm-taste-bars">
                {computedMetrics.map((metric, idx) => (
                  <div key={metric.name} className="cm-taste-bar-row">
                    <div className="cm-taste-bar-labels">
                      <span>{metric.name}</span>
                      <span>{metric.pct}%</span>
                    </div>
                    <div className="cm-taste-bar-track">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${metric.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.4, delay: idx * 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                        className="cm-taste-bar-fill"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {hasHistory && (
                <div style={{ marginTop: 24 }} className="cm-footer-status">
                  <span className="cm-footer-status-dot" />
                  Profile Synced Successfully
                </div>
              )}
            </div>
          </div>
        </div>



        {/* BOTTOM ROW: EXIT CTA (Emotional redirection) */}
        <div className="cm-footer-exit-section">
          <p className="cm-footer-exit-tagline">
            Your next favorite movie is waiting.
          </p>
          <Link to="/find" data-hover>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="cm-cta cm-footer-exit-btn"
              data-hover
            >
              <span className="cm-cta-dot" />
              ENTER ANOTHER UNIVERSE
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </motion.button>
          </Link>
        </div>

        {/* INFINITE MARQUEE */}
        <div className="cm-footer-marquee-container" aria-hidden="true">
          <div className="cm-footer-marquee-inner">
            {Array(4)
              .fill("DISCOVER • WATCH • EXPLORE • RECOMMEND • CINEMA • STORIES • FILM")
              .map((text, idx) => (
                <span key={idx}>{text} • </span>
              ))}
          </div>
        </div>

        {/* Footer base metadata */}
        <div className="cm-footer-base">
          <span>© MoviePlex ’26 — All frames reserved.</span>
          <a href="#" style={{ textDecoration: "none", color: "inherit" }} data-hover>
            RETURN TO START ▲
          </a>
        </div>
      </div>
    </footer>
  );
}
