import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const Input = z.object({
  messages: z.array(MessageSchema).min(1),
  json: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const groqChat = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Missing GROQ_API_KEY");

    const body: Record<string, unknown> = {
      model: "llama-3.3-70b-versatile",
      messages: data.messages,
      temperature: data.temperature ?? 0.5,
    };
    if (data.json) body.response_format = { type: "json_object" };

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`);
    }
    const j = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return { content: j.choices[0]?.message?.content ?? "" };
  });
