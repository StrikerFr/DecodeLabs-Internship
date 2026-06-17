import { createFileRoute } from "@tanstack/react-router";
import { DecodeBot } from "@/components/DecodeBot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DecodeBot | Rule Engine → AI Evolution" },
      {
        name: "description",
        content:
          "Experience the cinematic evolution from a deterministic rule based chatbot into a modern voice AI assistant.",
      },
      { property: "og:title", content: "DecodeBot | Rule Engine → AI Evolution" },
      {
        property: "og:description",
        content: "From rigid rule lookups to a neural voice assistant. A futuristic product demo.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <DecodeBot />;
}
