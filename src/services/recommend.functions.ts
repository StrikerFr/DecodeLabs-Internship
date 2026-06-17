import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  tags: z.array(z.string()).default([]),
  customPrompt: z.string().optional().default(""),
});

export type AIRecMovie = {
  id: string;
  title: string;
  year: string;
  tagline: string;
  director: string;
  runtime: string;
  poster: string;
  backdrop?: string;
  tags: string[];
  streaming: string[];
  reasoning: string;
  matchScore: number;
  youtube: { title: string; query: string }[];
};

// Free, no-key poster lookup: iTunes Search API (Apple).
// Returns high-res movie artwork; falls back to Wikipedia thumbnail if iTunes misses.
async function lookupPoster(title: string, year: string): Promise<{ poster: string; backdrop: string }> {
  // 1. iTunes Search
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", `${title} ${year}`.trim());
    url.searchParams.set("media", "movie");
    url.searchParams.set("entity", "movie");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString());
    if (res.ok) {
      const json = (await res.json()) as { results?: { artworkUrl100?: string }[] };
      const art = json.results?.[0]?.artworkUrl100;
      if (art) {
        const hi = art.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/1000x1000bb.$1");
        return { poster: hi, backdrop: hi };
      }
    }
  } catch (e) {
    console.error("iTunes lookup failed", e);
  }

  // 2. Wikipedia REST summary thumbnail
  try {
    const slug = encodeURIComponent(title.replace(/\s+/g, "_") + "_(film)");
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`);
    if (res.ok) {
      const j = (await res.json()) as { thumbnail?: { source?: string }; originalimage?: { source?: string } };
      const src = j.originalimage?.source || j.thumbnail?.source;
      if (src) return { poster: src, backdrop: src };
    }
  } catch (e) {
    console.error("wiki lookup failed", e);
  }

  // 3. Final placeholder
  const ph = `https://placehold.co/780x1170/04050a/9bb4ff?text=${encodeURIComponent(title)}`;
  return { poster: ph, backdrop: ph };
}

export const recommendMovies = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY is not configured");

    const signals = [...data.tags];
    const intent = data.customPrompt?.trim() ?? "";

    const sys = `You are MoviePlex, an elite cinema curator. Given a viewer's mood signals and free-form intent, recommend exactly 5 real, well-known films (any era, any country). Return ONLY valid JSON, no prose, no markdown. Schema:
{
  "recommendations": [
    {
      "title": "exact official title",
      "year": "YYYY",
      "director": "Director Name",
      "runtime": "Xh YYm",
      "tagline": "the film's actual tagline or a short evocative one-line description",
      "genres": ["Genre1","Genre2","Genre3"],
      "streaming": ["Netflix","Prime Video","Apple TV"],
      "matchScore": 0-100 integer (top pick 92-99),
      "reasoning": "2 sentences, intimate, literary, no emojis, speak to the viewer (you)",
      "youtube": [
        {"title":"Official Trailer","query":"<title> <year> trailer"},
        {"title":"Ending Explained","query":"<title> ending explained"},
        {"title":"Behind the Scenes","query":"<title> behind the scenes"},
        {"title":"Director Interview","query":"<director> <title> interview"}
      ]
    }
  ]
}
Sort by matchScore descending. First item is the perfect match. Streaming should reflect plausible current availability (Netflix, Prime Video, Disney+, Apple TV, Max, Hulu, Paramount+).`;

    const userMsg = `Mood signals: ${signals.length ? signals.join(", ") : "(none)"}
Custom intent: ${intent || "(none)"}

Recommend 5 films and return the JSON.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.85,
        max_tokens: 2200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("groq error", groqRes.status, err);
      throw new Error(`Groq error ${groqRes.status}`);
    }

    const groqJson = (await groqRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = groqJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { recommendations?: any[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }
    const recs = (parsed.recommendations ?? []).slice(0, 5);
    if (recs.length === 0) throw new Error("No recommendations returned");

    const hydrated: AIRecMovie[] = await Promise.all(
      recs.map(async (r: any, idx: number): Promise<AIRecMovie> => {
        const { poster, backdrop } = await lookupPoster(
          String(r.title ?? ""),
          String(r.year ?? ""),
        );
        return {
          id: `${r.title}-${r.year}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title: r.title ?? "Untitled",
          year: String(r.year ?? ""),
          tagline: r.tagline ?? "",
          director: r.director ?? "",
          runtime: r.runtime ?? "",
          poster,
          backdrop,
          tags: Array.isArray(r.genres) && r.genres.length ? r.genres : signals,
          streaming: Array.isArray(r.streaming) && r.streaming.length ? r.streaming : ["Search providers"],
          reasoning: r.reasoning ?? "",
          matchScore:
            typeof r.matchScore === "number"
              ? Math.max(40, Math.min(99, r.matchScore))
              : 95 - idx * 6,
          youtube: Array.isArray(r.youtube) && r.youtube.length
            ? r.youtube.slice(0, 4).map((y: any) => ({
                title: String(y.title ?? ""),
                query: String(y.query ?? `${r.title} ${r.year} trailer`),
              }))
            : [
                { title: "Official Trailer", query: `${r.title} ${r.year} trailer` },
                { title: "Ending Explained", query: `${r.title} ending explained` },
                { title: "Behind the Scenes", query: `${r.title} behind the scenes` },
                { title: "Director Interview", query: `${r.title} director interview` },
              ],
        };
      }),
    );

    return { movies: hydrated };
  });
