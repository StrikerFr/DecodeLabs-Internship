import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voiceId } = (await request.json()) as {
            text?: string;
            voiceId?: string;
          };
          if (!text || typeof text !== "string" || text.length > 2000) {
            return new Response("Invalid text", { status: 400 });
          }
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) return new Response("ElevenLabs not configured", { status: 500 });

          const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || "yIqeesBBd5tdVotHqIzJ";

          const res = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text,
                model_id: "eleven_turbo_v2_5",
                voice_settings: {
                  stability: 0.45,
                  similarity_boost: 0.8,
                  style: 0.35,
                  use_speaker_boost: true,
                },
              }),
            },
          );

          if (!res.ok) {
            const err = await res.text();
            return new Response(err || "TTS failed", { status: res.status });
          }

          return new Response(res.body, {
            headers: { "Content-Type": "audio/mpeg" },
          });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Error", { status: 500 });
        }
      },
    },
  },
});
