import type { Movie } from "@/types/movie";

const KEYWORD_SIGNALS: Record<string, string[]> = {
  romance: ["Romance", "Emotional"],
  romantic: ["Romance", "Emotional"],
  love: ["Romance", "Emotional"],
  date: ["Romance"],
  breakup: ["Romance", "Emotional"],
  sad: ["Emotional", "Romance"],
  cry: ["Emotional"],
  emotional: ["Emotional"],
  action: ["Action"],
  fight: ["Action", "Thriller"],
  chase: ["Action", "Thriller"],
  fast: ["Action"],
  thriller: ["Thriller"],
  suspense: ["Thriller"],
  mystery: ["Thriller", "Noir", "Mind-Bending"],
  detective: ["Noir", "Thriller"],
  crime: ["Noir", "Thriller"],
  dark: ["Noir", "Thriller"],
  noir: ["Noir"],
  space: ["Space", "Sci-Fi"],
  alien: ["Sci-Fi", "Space"],
  sci: ["Sci-Fi"],
  science: ["Sci-Fi"],
  mind: ["Mind-Bending"],
  weird: ["Mind-Bending"],
  confusing: ["Mind-Bending"],
  dream: ["Mind-Bending"],
};

export function deriveSignals(selected: string[], customText = "") {
  const signals = new Set(selected);
  const words = customText.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
  words.forEach((word) => KEYWORD_SIGNALS[word]?.forEach((tag) => signals.add(tag)));
  return Array.from(signals);
}

export function scoreMovies(movies: Movie[], selected: string[], customText = "") {
  const signals = deriveSignals(selected, customText);
  const query = customText.toLowerCase();
  return movies
    .map((m, index) => {
      const overlap = m.tags.filter((t) => signals.includes(t)).length;
      const missing = signals.filter((t) => !m.tags.includes(t)).length;
      const titleHit = query && m.title.toLowerCase().includes(query.trim()) ? 0.35 : 0;
      const tagScore = overlap / Math.max(1, signals.length);
      const exactIntentBoost = overlap === signals.length && signals.length > 0 ? 0.12 : 0;
      const score = Math.min(0.99, Math.max(0.18, tagScore * 0.78 + exactIntentBoost + titleHit - missing * 0.025));
      return { movie: m, score, overlap, index };
    })
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap || a.index - b.index);
}
