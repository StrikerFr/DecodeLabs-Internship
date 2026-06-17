import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  movie: z.string(),
  tags: z.array(z.string()),
  customPrompt: z.string().optional(),
});

export const explainMatch = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      return {
        text: `Because your taste leans toward ${data.tags.join(", ").toLowerCase()}, "${data.movie}" lands inside the exact emotional frequency you're tuned to right now.`,
        cached: true,
      };
    }
    try {
      const userIntent = data.customPrompt?.trim()
        ? ` The viewer also typed this custom request: "${data.customPrompt.trim()}".`
        : "";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content:
                "You are MoviePlex, a cinematic AI concierge. Write in a calm, literary, slightly poetic voice. 2 short sentences max. No emojis. No lists. Speak directly to the viewer (you).",
            },
            {
              role: "user",
              content: `Explain in 2 sentences why the film "${data.movie}" is a perfect match for someone whose mood signals are: ${data.tags.join(", ")}.${userIntent} Make it feel intimate and curated, not generic.`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("groq error", res.status, err);
        return {
          text: `Because your taste leans toward ${data.tags.join(", ").toLowerCase()}, "${data.movie}" lands inside the exact emotional frequency you're tuned to right now.`,
          cached: true,
        };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { text, cached: false };
    } catch (e) {
      console.error("groq fetch failed", e);
      return {
        text: `Because your selections show a preference for ${data.tags.join(", ").toLowerCase()} storytelling, "${data.movie}" aligns closely with the kind of cinema you're drawn to.`,
        cached: true,
      };
    }
  });