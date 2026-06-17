import { createFileRoute } from "@tanstack/react-router";
import Hero from "@/components/sections/Hero";
import Sections from "@/components/sections/Sections";

const SITE = "https://movieplex-ai.vercel.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoviePlex AI | Discover Your Next Favorite Movie" },
      {
        name: "description",
        content:
          "MoviePlex AI helps you discover personalized movie recommendations using intelligent preference matching, cinematic experiences, streaming availability, and AI-powered insights.",
      },
      { property: "og:title", content: "MoviePlex AI — Find Your Next Obsession" },
      {
        property: "og:description",
        content: "An immersive AI film concierge. Curated, cinematic, infinite.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE + "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MoviePlex AI — Find Your Next Obsession" },
      { name: "twitter:description", content: "An immersive AI film concierge." },
    ],
    links: [{ rel: "canonical", href: SITE + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "MoviePlex AI",
          url: SITE,
          description:
            "AI-powered cinematic movie discovery platform with personalized recommendations.",
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE}/find?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <Sections />
    </>
  );
}
