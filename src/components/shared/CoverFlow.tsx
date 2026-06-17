import { useState } from "react";
import type { Movie } from "@/types/movie";

export default function CoverFlow({
  movies,
  activeId,
  onSelect,
}: {
  movies: Movie[];
  activeId: string;
  onSelect: (m: Movie) => void;
}) {
  const activeIndex = Math.max(0, movies.findIndex((m) => m.id === activeId));
  const [idx, setIdx] = useState(activeIndex);

  return (
    <div className="cm-cf">
      <div className="cm-cf-track">
        {movies.map((m, i) => {
          const d = i - idx;
          const abs = Math.abs(d);
          const tx = d * 140;
          const rotY = d * -22;
          const scale = abs === 0 ? 1.15 : 1 - Math.min(0.35, abs * 0.12);
          const z = -abs * 60;
          const op = abs > 3 ? 0 : 1 - abs * 0.18;
          const blur = abs > 0 ? Math.min(6, abs * 1.5) : 0;
          return (
            <button
              key={m.id}
              className="cm-cf-card"
              data-hover
              onClick={() => {
                if (abs === 0) {
                  onSelect(m);
                } else {
                  setIdx(i);
                }
              }}
              style={{
                transform: `translate3d(${tx}px, 0, ${z}px) rotateY(${rotY}deg) scale(${scale})`,
                opacity: op,
                filter: `blur(${blur}px)`,
                zIndex: 100 - abs,
              }}
              aria-label={m.title}
            >
              <img src={m.poster} alt={m.title} draggable={false} />
              <div className="cm-cf-card-shine" />
              {abs === 0 && (
                <div className="cm-cf-card-label">
                  <span>{m.title}</span>
                  <small>{m.year} · {m.director}</small>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="cm-cf-controls">
        <button data-hover onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Previous">←</button>
        <span className="cm-eyebrow">{String(idx + 1).padStart(2, "0")} / {String(movies.length).padStart(2, "0")}</span>
        <button data-hover onClick={() => setIdx((i) => Math.min(movies.length - 1, i + 1))} aria-label="Next">→</button>
      </div>
    </div>
  );
}