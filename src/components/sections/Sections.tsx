import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MOVIES } from "@/constants/movies";
import type { Movie } from "@/types/movie";
import FinalFrame from "./FinalFrame";

/* group movies for rails — no repeats across rails */
const pickByTag = (tag: string, exclude: Set<string>, n: number) => {
  const out: Movie[] = [];
  for (const m of MOVIES) {
    if (out.length >= n) break;
    if (exclude.has(m.id)) continue;
    if (m.tags.includes(tag)) {
      out.push(m);
      exclude.add(m.id);
    }
  }
  return out;
};

const used = new Set<string>();
const trending = MOVIES.slice(0, 10);
trending.forEach((m) => used.add(m.id));
const sciFi = pickByTag("Sci-Fi", used, 10);
const mindBending = pickByTag("Mind-Bending", used, 10);
const noir = pickByTag("Noir", used, 10);
const romance = pickByTag("Romance", used, 8);
const remaining = MOVIES.filter((m) => !used.has(m.id)).slice(0, 10);

function PosterImg({ movie }: { movie: Movie }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="cm-rail-poster-fallback">
        <span>{movie.title}</span>
      </div>
    );
  }
  return (
    <img
      src={movie.poster}
      alt={`${movie.title} poster`}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}

function Rail({
  eyebrow,
  title,
  movies,
  large = false,
}: {
  eyebrow: string;
  title: string;
  movies: Movie[];
  large?: boolean;
}) {
  return (
    <section className="cm-rail-section">
      <header className="cm-rail-header">
        <div className="cm-eyebrow">{eyebrow}</div>
        <h2 className="cm-rail-title">{title}</h2>
      </header>
      <div className={`cm-rail ${large ? "cm-rail--lg" : ""}`}>
        <div className="cm-rail-track">
          {movies.map((m, i) => (
            <motion.figure
              key={m.id}
              className="cm-rail-card"
              data-hover
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="cm-rail-poster">
                <PosterImg movie={m} />
                <div className="cm-rail-glow" />
                <div className="cm-rail-overlay">
                  <div className="cm-rail-overlay-tags">
                    {m.tags.slice(0, 2).map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="cm-rail-overlay-runtime">{m.runtime}</div>
                </div>
                <span className="cm-rail-rank">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <figcaption>
                <div className="cm-rail-card-title">{m.title}</div>
                <div className="cm-rail-card-meta">
                  <span>{m.year}</span>
                  <span className="cm-dot" />
                  <span>{m.director}</span>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Sections() {
  return (
    <>
      {/* Discover / CTA bridge */}
      <section id="discover" className="cm-bridge">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          className="cm-bridge-inner"
        >
          <div className="cm-eyebrow">Concierge Protocol</div>
          <h2 className="cm-bridge-title">
            Tell the AI how you<br />want to feel tonight.
          </h2>
          <p className="cm-bridge-copy">
            Pick a few signals — mood, era, atmosphere. MoviePlex AI sweeps thousands of films
            and lands on the one engineered for this exact moment.
          </p>
          <Link to="/find" data-hover>
            <button className="cm-cta" data-hover>
              <span className="cm-cta-dot" />
              Begin the match
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </Link>
        </motion.div>
      </section>

      <div id="trending" />
      <Rail eyebrow="Trending · This week" title="What the world is watching" movies={trending} />

      <div id="top-rated" />
      <Rail eyebrow="Top Rated · All time" title="Cinema's highest peaks" movies={remaining} large />

      <Rail eyebrow="Deep space · Sci-Fi" title="Beyond the stratosphere" movies={sciFi} />
      <Rail eyebrow="Mind benders · Reality optional" title="Films that rewire your brain" movies={mindBending} />
      <Rail eyebrow="Neo-Noir · After midnight" title="Shadows, smoke, consequence" movies={noir} large />
      <Rail eyebrow="Heart on sleeve · Love + loss" title="The ones that ache" movies={romance} />

      <FinalFrame />
    </>
  );
}
