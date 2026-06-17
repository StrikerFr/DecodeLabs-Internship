import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Hero } from "@/components/sections/Hero";
import { DiscoverySection } from "@/components/sections/DiscoverySection";
import { NeuralScene } from "@/components/sections/NeuralScene";
import { PredictionSection } from "@/components/sections/PredictionSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClassifyAI - Machine Learning Laboratory" },
      {
        name: "description",
        content:
          "Upload any dataset and watch AI explain patterns, recommend models, compare accuracy, and reveal insights.",
      },
      { property: "og:title", content: "ClassifyAI - Machine Learning Laboratory" },
      {
        property: "og:description",
        content:
          "An AI data comprehension engine. Drop a dataset, get instant patterns, models, and insights.",
      },
      { property: "og:url", content: "https://classifyai.decodelabs.io/" },
    ],
    links: [{ rel: "canonical", href: "https://classifyai.decodelabs.io/" }],
  }),
  component: Index,
});

function Index() {
  const [heroIntensity, setHeroIntensity] = useState(0);
  const [phase, setPhase] = useState(0);

  // Hero owns the neural intensity; discovery uses a soft, capped ambient level
  const ambient = phase > 0.02 ? 0.25 : 0;
  const intensity = Math.max(heroIntensity, ambient);

  return (
    <div className="relative" style={{ background: "#f7f7f5" }}>
      {/* Fixed neural background — persists across Hero and Discovery */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 45% at 50% 55%, rgba(196,181,253,0.18) 0%, rgba(20,184,166,0.04) 45%, rgba(247,247,245,0) 75%)",
          }}
        />
        <NeuralScene intensity={intensity} phase={phase} />
      </div>

      <div className="relative z-10">
        <Hero onIntensityChange={setHeroIntensity} />
        <DiscoverySection onPhaseChange={setPhase} />
        <PredictionSection />
      </div>
    </div>
  );
}
