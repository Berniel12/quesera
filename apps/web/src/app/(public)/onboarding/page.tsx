"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "quesera_onboarding_selections";

const SUBJECT_CATALOG: Record<string, Array<{ name: string; slug: string; hot?: boolean }>> = {
  world: [
    { name: "Iran-US Tensions", slug: "iran-us-tensions", hot: true },
    { name: "Russia-Ukraine War", slug: "russia-ukraine-war", hot: true },
    { name: "Lebanon War 2026", slug: "lebanon-war-2026", hot: true },
    { name: "US Cuba Relations", slug: "us-cuba-relations", hot: true },
    { name: "China-Taiwan Relations", slug: "china-taiwan-relations" },
    { name: "Israel-Palestine Conflict", slug: "israel-palestine-conflict" },
    { name: "NATO Alliance", slug: "nato-alliance" },
    { name: "Venezuela Crisis", slug: "venezuela-crisis" },
    { name: "Sudan Conflict", slug: "sudan-conflict" },
    { name: "North Korea", slug: "north-korea" },
    { name: "Climate Change", slug: "climate-change" },
    { name: "European Union", slug: "european-union" },
  ],
  money: [
    { name: "US Stock Market", slug: "us-stock-market", hot: true },
    { name: "Fed Interest Rates", slug: "us-federal-reserve-interest-rates", hot: true },
    { name: "Global Recession Risk", slug: "global-recession-risk", hot: true },
    { name: "US Inflation Rate", slug: "us-inflation-rate" },
    { name: "Housing Market", slug: "us-housing-market" },
    { name: "Gas Prices", slug: "us-gas-prices" },
    { name: "Gold Price", slug: "gold-price" },
    { name: "Oil Prices", slug: "global-oil-prices" },
    { name: "US Dollar", slug: "us-dollar-strength" },
    { name: "Unemployment", slug: "us-unemployment-rate" },
    { name: "Food Prices", slug: "global-food-prices" },
  ],
  politics: [
    { name: "2026 Midterm Elections", slug: "2026-us-midterm-elections", hot: true },
    { name: "Tariffs & Trade War", slug: "us-trade-policy", hot: true },
    { name: "TikTok Ban", slug: "tiktok-ban", hot: true },
    { name: "AI Regulation", slug: "artificial-intelligence-policy", hot: true },
    { name: "Supreme Court", slug: "us-supreme-court" },
    { name: "Immigration Policy", slug: "us-immigration-policy" },
    { name: "Debt Ceiling", slug: "us-debt-ceiling" },
    { name: "Healthcare Policy", slug: "us-healthcare-policy" },
    { name: "Congress", slug: "us-congress-legislation" },
  ],
  sports: [
    { name: "FIFA World Cup 2026", slug: "fifa-world-cup-2026", hot: true },
    { name: "NBA Playoffs", slug: "nba-season-2025-26", hot: true },
    { name: "Premier League", slug: "premier-league", hot: true },
    { name: "Champions League", slug: "champions-league" },
    { name: "NFL Season", slug: "nfl-2026-season" },
    { name: "Formula 1", slug: "formula-1-2026" },
    { name: "MLB Baseball", slug: "mlb-season-2026" },
    { name: "UFC Fights", slug: "ufc-mma" },
  ],
  crypto: [
    { name: "Bitcoin", slug: "bitcoin-price", hot: true },
    { name: "Ethereum", slug: "ethereum-price" },
    { name: "Crypto Market", slug: "crypto-market", hot: true },
  ],
  tech: [
    { name: "AI Industry", slug: "ai-industry", hot: true },
    { name: "Tesla & Elon Musk", slug: "tesla", hot: true },
    { name: "Apple", slug: "apple" },
    { name: "SpaceX Starship", slug: "spacex-starship" },
  ],
  entertainment: [
    { name: "Taylor Swift", slug: "taylor-swift", hot: true },
    { name: "Marvel MCU", slug: "marvel-cinematic-universe" },
    { name: "Oscars 2026", slug: "oscar-awards-2026" },
  ],
  safety: [
    { name: "Earthquakes", slug: "earthquake-activity" },
    { name: "Severe Weather", slug: "severe-weather-alerts" },
    { name: "Hurricane Season", slug: "hurricane-season-2026" },
    { name: "Wildfires", slug: "wildfire-season" },
  ],
};

const LIFE_AREAS = [
  { key: "world", label: "World & Conflicts", desc: "Wars, geopolitics, global tensions" },
  { key: "money", label: "Money & Markets", desc: "Stocks, inflation, housing, gold" },
  { key: "politics", label: "US Politics", desc: "Elections, tariffs, TikTok ban" },
  { key: "sports", label: "Sports", desc: "NBA, World Cup, F1, UFC" },
  { key: "crypto", label: "Crypto", desc: "Bitcoin, Ethereum, altcoins" },
  { key: "tech", label: "Tech & AI", desc: "AI, Tesla, Apple, SpaceX" },
  { key: "entertainment", label: "Entertainment", desc: "Taylor Swift, Marvel, Oscars" },
  { key: "safety", label: "Weather & Safety", desc: "Earthquakes, storms, wildfires" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [city, setCity] = useState("");

  function toggleArea(key: string) {
    setSelectedAreas((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key],
    );
  }

  function toggleSubject(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const seen = new Set<string>();
  const subjects = selectedAreas
    .flatMap((area) => (SUBJECT_CATALOG[area] ?? []).map((s) => ({ ...s, area })))
    .filter((s) => { if (seen.has(s.slug)) return false; seen.add(s.slug); return true; })
    .sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0));

  function saveAndContinue() {
    const sels = subjects.filter((s) => selectedSlugs.has(s.slug)).map((s) => ({ slug: s.slug, name: s.name }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sels));
    setStep(step + 1);
  }

  async function finish() {
    const sels = subjects.filter((s) => selectedSlugs.has(s.slug)).map((s) => ({ slug: s.slug }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sels));
    try {
      for (const s of sels) {
        await fetch(`/api/topics/${s.slug}/follow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow" }) });
      }
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* preserve if fails */ }
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Progress */}
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1.5 rounded-full transition-all ${step === s ? "w-8 bg-navy" : step > s ? "w-2 bg-navy/40" : "w-2 bg-border"}`} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy text-center mb-1">
            What do you want to stay ahead of?
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Pick the areas that matter to you
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {LIFE_AREAS.map((area) => (
              <button
                key={area.key}
                onClick={() => toggleArea(area.key)}
                className={`rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                  selectedAreas.includes(area.key)
                    ? "border-navy bg-navy/5 shadow-sm"
                    : "border-border hover:border-navy/30"
                }`}
              >
                <p className="text-sm font-semibold">{area.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{area.desc}</p>
              </button>
            ))}
          </div>
          <div className="text-center">
            <Button onClick={() => setStep(2)} disabled={selectedAreas.length === 0} className="rounded-full px-10 h-12 text-base">
              Show me subjects
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy text-center mb-1">
            Tap to follow
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            {selectedSlugs.size} selected
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {subjects.map((s) => (
              <button
                key={s.slug}
                onClick={() => toggleSubject(s.slug)}
                className={`rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  selectedSlugs.has(s.slug)
                    ? "bg-navy text-white shadow-md"
                    : "bg-card border border-border text-foreground hover:border-navy/30"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>Back</Button>
            <Button className="rounded-full px-8 h-11" disabled={selectedSlugs.size === 0} onClick={() => setStep(3)}>
              Next ({selectedSlugs.size})
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold tracking-tight text-navy mb-2">
            Add your city
          </h1>
          <p className="text-muted-foreground mb-6">
            Get weather alerts, earthquake signals, and local events.
          </p>
          <div className="max-w-sm mx-auto mb-8">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tel Aviv, New York, London..." className="rounded-full h-12 text-center text-base" />
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="rounded-full" onClick={saveAndContinue}>Skip</Button>
            <Button className="rounded-full px-8" onClick={saveAndContinue}>Continue</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-navy mb-1">
              Your feed is ready
            </h1>
            <p className="text-muted-foreground">
              {selectedSlugs.size} subjects being tracked
            </p>
          </div>
          <div className="space-y-2 mb-8">
            {subjects.filter((s) => selectedSlugs.has(s.slug)).map((s) => (
              <Card key={s.slug} className="rounded-2xl border-border/40">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.area}</p>
                  </div>
                  <span className="text-xs text-positive font-mono">live</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="rounded-3xl border-navy/20 bg-navy/[0.03]">
            <CardContent className="p-8 text-center">
              <p className="text-xl font-semibold text-navy mb-2">You are all set.</p>
              <p className="text-sm text-muted-foreground mb-6">Sign in to save your feed and get notified when signals shift.</p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Button className="rounded-full h-12 text-base" onClick={finish}>Save My Feed</Button>
                <Button variant="ghost" className="rounded-full h-10 text-muted-foreground" onClick={() => router.push("/")}>Just browsing for now</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
