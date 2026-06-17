import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import Scene from "../shared/Scene";

const TMDB = "https://image.tmdb.org/t/p/w500";
const HERO_POSTERS = [
  { title: "Interstellar", url: `${TMDB}/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg` },
  { title: "Dune: Part Two", url: `${TMDB}/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg` },
  { title: "Oppenheimer", url: `${TMDB}/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg` },
  { title: "The Batman", url: `${TMDB}/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg` },
  { title: "Parasite", url: `${TMDB}/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg` },
  { title: "Blade Runner 2049", url: `${TMDB}/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg` },
  { title: "Arrival", url: `${TMDB}/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg` },
  { title: "Drive", url: `${TMDB}/602vevIURmpDfzbnv5Ubi6wIkQm.jpg` },
  { title: "Tenet", url: `${TMDB}/k68nPLbIST6NP96JmTxmZijEvCA.jpg` },
];


export default function Hero() {
  const mouseRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef(0);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hideFixedFooter, setHideFixedFooter] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("movieplex");
    return () => document.body.classList.remove("movieplex");
  }, []);

  // custom cursor + parallax mouse
  useEffect(() => {
    let cx = 0, cy = 0, tx = 0, ty = 0;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX; ty = e.clientY;
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;

      // magnetic CTA
      if (ctaRef.current) {
        const r = ctaRef.current.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < 180) {
          const p = 1 - dist / 180;
          ctaRef.current.style.transform = `translate(${dx * 0.25 * p}px, ${dy * 0.25 * p}px)`;
        } else {
          ctaRef.current.style.transform = "translate(0,0)";
        }
      }
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, a, [data-hover]")) {
        cursorRef.current?.classList.add("is-hover");
      } else {
        cursorRef.current?.classList.remove("is-hover");
      }
    };
    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      }
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

  // scroll progress feeding camera dive + footer hide
  useEffect(() => {
    const onScroll = () => {
      const max = window.innerHeight * 1.4;
      scrollRef.current = Math.min(1, Math.max(0, window.scrollY / max));

      const threshold = document.documentElement.scrollHeight - window.innerHeight - 600;
      setHideFixedFooter(window.scrollY > threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="cm-cursor" ref={cursorRef} />
      <div className="cm-grain" />
      <div className="cm-vignette" />

      <nav className="cm-nav">
        <a href="#" data-hover style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="dot" />
          MoviePlex AI
        </a>
        <div style={{ display: "flex", gap: 28 }}>
          <a href="#discover" data-hover>Discover</a>
          <a href="#trending" data-hover>Trending</a>
          <a href="#top-rated" data-hover>Top Rated</a>
          <a href="#about" data-hover>About</a>
        </div>
      </nav>

      <section
        style={{
          position: "relative",
          width: "100%",
          minHeight: "100vh",
          overflow: "hidden",
          background: "radial-gradient(ellipse at 50% 40%, #0a0e1a 0%, #05070d 60%, #020306 100%)",
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          {mounted && <Scene mouseRef={mouseRef} scrollRef={scrollRef} />}
        </div>

        {/* Floating poster marquees */}
        <div className="cm-poster-layer" aria-hidden>
          <div className="cm-poster-row cm-poster-row--top">
            {[...HERO_POSTERS, ...HERO_POSTERS].map((p, i) => (
              <figure className="cm-poster" key={`t-${i}`}>
                <img src={p.url} alt={p.title} loading="lazy" />
                <figcaption>{p.title}</figcaption>
              </figure>
            ))}
          </div>
          <div className="cm-poster-row cm-poster-row--bottom">
            {[...HERO_POSTERS.slice().reverse(), ...HERO_POSTERS.slice().reverse()].map((p, i) => (
              <figure className="cm-poster" key={`b-${i}`}>
                <img src={p.url} alt={p.title} loading="lazy" />
                <figcaption>{p.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        {/* Content overlay */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
            padding: "140px 24px 120px",
          }}
        >
          <motion.div
            className="cm-eyebrow"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            MoviePlex · AI Film Concierge
          </motion.div>

          <motion.h1
            className="cm-headline"
            style={{ marginTop: 24, fontSize: "clamp(54px, 11vw, 168px)" }}
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } },
            }}
          >
            {["Find your", "next", "obsession."].map((line, i) => (
              <motion.span
                key={i}
                style={{ display: "block" }}
                variants={{
                  hidden: { y: "110%", opacity: 0 },
                  show: { y: "0%", opacity: 1, transition: { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] } },
                }}
              >
                {line}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              marginTop: 28,
              maxWidth: 520,
              color: "rgba(210,218,235,0.72)",
              fontSize: 16,
              lineHeight: 1.6,
              letterSpacing: "0.01em",
            }}
          >
            A cinematic intelligence that maps your taste across the multiverse of film. From <em style={{ fontStyle: "normal", color: "#fff" }}>Blade Runner 2049</em> to <em style={{ fontStyle: "normal", color: "#fff" }}>Parasite</em>, curated, quiet, infinite.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.7, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ marginTop: 44, display: "flex", gap: 14, pointerEvents: "auto", flexWrap: "wrap", justifyContent: "center" }}
          >
            <Link to="/find" data-hover>
              <button ref={ctaRef} className="cm-cta" data-hover>
                <span className="cm-cta-dot" />
                Start Exploring
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer
        className="cm-footer"
        style={{
          opacity: hideFixedFooter ? 0 : 0.5,
          pointerEvents: hideFixedFooter ? "none" : "auto",
          transition: "opacity 0.4s ease",
        }}
      >
        <div>© MoviePlex ’26</div>
        <div>Scroll · Explore the vault</div>
      </footer>
    </>
  );
}