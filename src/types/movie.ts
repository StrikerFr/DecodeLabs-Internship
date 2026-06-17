export type Movie = {
  id: string;
  title: string;
  year: string;
  tagline: string;
  director: string;
  runtime: string;
  poster: string; // remote URL
  backdrop?: string;
  tags: string[]; // categories
  streaming: ("Netflix" | "Prime Video" | "Disney+" | "Apple TV")[];
  youtube: { title: string; query: string }[];
};
