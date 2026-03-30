"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { savePendingOnboarding, clearPendingOnboarding, applyPendingOnboarding } from "@/lib/onboarding";
import { COUNTRY_LANE_BOOSTS, COUNTRY_TOPIC_SUGGESTIONS } from "@/lib/geo";
import { getCountryDisplayName } from "@/lib/countries";
import type { OnboardingQuestion } from "./page";

const LIFE_AREAS = [
  { key: "geopolitics", label: "World & Conflicts", desc: "Wars, geopolitics, global tensions" },
  { key: "macro", label: "Money & Markets", desc: "Inflation, housing, rates, recession" },
  { key: "politics", label: "Politics", desc: "Elections, tariffs, AI regulation" },
  { key: "sports", label: "Sports", desc: "World Cup, F1, NBA, Premier League" },
  { key: "crypto", label: "Crypto", desc: "Bitcoin, Ethereum, crypto market" },
  { key: "tech", label: "Tech & AI", desc: "AI, Tesla, Apple, SpaceX" },
  { key: "entertainment", label: "Entertainment", desc: "Taylor Swift, Marvel, Oscars" },
  { key: "disasters", label: "Weather & Safety", desc: "Earthquakes, storms, wildfires" },
];

// Map topic categories to life area keys
const CATEGORY_TO_AREA: Record<string, string> = {
  geopolitics: "geopolitics",
  macro: "macro",
  politics: "politics",
  sports: "sports",
  crypto: "crypto",
  tech: "tech",
  entertainment: "entertainment",
  disasters: "disasters",
};

interface Props {
  questions: OnboardingQuestion[];
}

export default function OnboardingClient({ questions }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [city, setCity] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "redirecting">("idle");
  const prevStep = useRef(1);
  const [inferredCountry, setInferredCountry] = useState<string | null>(null);
  const [inferredCountryName, setInferredCountryName] = useState<string | null>(null);
  const locationFetched = useRef(false);

  useEffect(() => {
    if (locationFetched.current) return;
    locationFetched.current = true;

    fetch("/api/geo")
      .then((res) => res.json())
      .then((data: { country: string | null; region: string | null }) => {
        if (data.country) {
          setInferredCountry(data.country);
          setInferredCountryName(getCountryDisplayName(data.country));
        }
      })
      .catch(() => { /* fail silently */ });
  }, []);

  const countrySuggestedSlugs = new Set(
    inferredCountry ? (COUNTRY_TOPIC_SUGGESTIONS[inferredCountry] ?? []) : [],
  );

  const boostedAreaKeys = new Set(
    inferredCountry
      ? (COUNTRY_LANE_BOOSTS[inferredCountry] ?? [])
          .map((cat) => CATEGORY_TO_AREA[cat])
          .filter(Boolean)
      : [],
  );

  const direction = step >= prevStep.current ? "forward" : "back";

  function goToStep(next: number) {
    prevStep.current = step;
    setStep(next);
  }

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

  // Filter questions to selected life areas
  const filteredQuestions = questions
    .filter((q) => {
      const area = q.category ? CATEGORY_TO_AREA[q.category] : null;
      return area ? selectedAreas.includes(area) : false;
    })
    .sort((a, b) => {
      // Country-relevant first, then alive, then rest
      const aRelevant = countrySuggestedSlugs.has(a.slug) ? 1 : 0;
      const bRelevant = countrySuggestedSlugs.has(b.slug) ? 1 : 0;
      if (bRelevant !== aRelevant) return bRelevant - aRelevant;
      if (a.has_snapshot !== b.has_snapshot) return a.has_snapshot ? -1 : 1;
      return 0;
    });

  function saveAndContinue() {
    goToStep(step + 1);
  }

  async function finish() {
    const slugs = filteredQuestions.filter((q) => selectedSlugs.has(q.slug)).map((q) => q.slug);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setSaveStatus("saving");
      savePendingOnboarding(slugs);
      const result = await applyPendingOnboarding();
      if (result.ok) {
        clearPendingOnboarding();
      }
      router.push("/dashboard");
    } else {
      setSaveStatus("redirecting");
      savePendingOnboarding(slugs);
      router.push("/login?redirect=/dashboard&onboarding=pending");
    }
  }

  // Track live pulse dots
  let livePulseCount = 0;
  const MAX_LIVE_PULSE = 4;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Progress bar */}
      <div className="relative mb-8">
        <div className="h-1 rounded-full bg-border mx-8" />
        <div
          className="absolute top-0 left-8 h-1 rounded-full bg-navy transition-all duration-500 ease-out"
          style={{ width: `${((step - 1) / 3) * 100}%`, maxWidth: "calc(100% - 4rem)" }}
        />
        <div className="absolute top-1/2 left-0 right-0 flex justify-between px-6 -translate-y-1/2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                step >= s ? "border-navy bg-navy" : "border-border bg-background"
              }`}
            />
          ))}
        </div>
      </div>

      <div
        key={step}
        className={direction === "forward" ? "animate-slide-up" : "animate-fade-in"}
      >
        {step === 1 && (
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-navy text-center mb-1">
              What questions keep you up at night?
            </h1>
            <p className="text-muted-foreground text-center mb-8">
              Pick the areas that matter to you
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {LIFE_AREAS.map((area) => {
                const isSelected = selectedAreas.includes(area.key);
                const isBoosted = boostedAreaKeys.has(area.key);
                return (
                  <button
                    key={area.key}
                    onClick={() => toggleArea(area.key)}
                    className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.98] ${
                      isSelected
                        ? "border-navy bg-navy/5 ring-1 ring-navy/20"
                        : isBoosted
                          ? "border-navy/30 bg-navy/[0.02]"
                          : "border-border hover:border-navy/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">{area.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{area.desc}</p>
                    {isSelected && (
                      <span className="absolute top-3 right-3 animate-scale-in">
                        <Check className="h-4 w-4 text-navy" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-center">
              <Button onClick={() => goToStep(2)} disabled={selectedAreas.length === 0} className="rounded-full px-10 h-12 text-base active:scale-[0.98]">
                Show me questions
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy text-center mb-1">
              Pick the questions you care about
            </h1>
            <p className="text-muted-foreground text-center mb-6">
              <span className="font-mono tabular-nums">{selectedSlugs.size}</span> selected
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {filteredQuestions.map((q) => {
                const isSelected = selectedSlugs.has(q.slug);
                const showPulse = q.has_snapshot && !isSelected && livePulseCount < MAX_LIVE_PULSE;
                if (showPulse) livePulseCount++;

                return (
                  <button
                    key={q.slug}
                    onClick={() => toggleSubject(q.slug)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.97] ${
                      isSelected
                        ? "bg-navy text-white shadow-sm"
                        : "bg-card border border-border text-foreground hover:border-navy/30"
                    }`}
                  >
                    {showPulse && (
                      <span className="relative h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full bg-positive animate-pulse-live" />
                        <span className="relative block h-1.5 w-1.5 rounded-full bg-positive" />
                      </span>
                    )}
                    {q.question_text}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="rounded-full active:scale-[0.98]" onClick={() => goToStep(1)}>Back</Button>
              <Button className="rounded-full px-8 h-11 active:scale-[0.98]" disabled={selectedSlugs.size === 0} onClick={() => goToStep(3)}>
                Next (<span className="font-mono tabular-nums">{selectedSlugs.size}</span>)
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-8">
            {inferredCountryName ? (
              <>
                <p className="text-xs text-muted-foreground mb-3 animate-fade-in">
                  Showing questions relevant to {inferredCountryName}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-navy mb-2">
                  Add your city for more local signals (optional)
                </h1>
              </>
            ) : (
              <h1 className="text-2xl font-bold tracking-tight text-navy mb-2">
                Where in the world are you?
              </h1>
            )}
            <p className="text-muted-foreground mb-6">
              Totally optional. If you share your city, we can highlight questions that matter most in your area. You can always skip this.
            </p>
            <div className="max-w-sm mx-auto mb-8">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tel Aviv, New York, London..." className="rounded-full h-12 text-center text-base" />
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="rounded-full active:scale-[0.98]" onClick={saveAndContinue}>Skip</Button>
              <Button className="rounded-full px-8 active:scale-[0.98]" onClick={saveAndContinue}>Continue</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-navy mb-1">
                You&apos;re now tracking these questions
              </h1>
              <p className="text-muted-foreground">
                <span className="font-mono tabular-nums">{selectedSlugs.size}</span> questions followed
              </p>
            </div>
            <div className="space-y-2 mb-8">
              {filteredQuestions.filter((q) => selectedSlugs.has(q.slug)).map((q, i) => {
                const delayClass = i === 0 ? "" : i === 1 ? "delay-75" : i === 2 ? "delay-150" : i === 3 ? "delay-225" : i === 4 ? "delay-300" : i === 5 ? "delay-375" : "delay-450";
                return (
                  <Card key={q.slug} className={`rounded-2xl border-border/40 animate-slide-up ${delayClass}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{q.question_text}</p>
                        <p className="text-xs text-muted-foreground capitalize">{q.category}</p>
                      </div>
                      {q.has_snapshot && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-positive font-mono">
                          <span className="relative h-1.5 w-1.5">
                            <span className="absolute inset-0 rounded-full bg-positive animate-pulse-live" />
                            <span className="relative block h-1.5 w-1.5 rounded-full bg-positive" />
                          </span>
                          live
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Card className="rounded-3xl border-navy/20 bg-navy/[0.03] animate-scale-in delay-150">
              <CardContent className="p-8 text-center">
                <p className="text-xl font-semibold text-navy mb-2">You are all set.</p>
                <p className="text-sm text-muted-foreground mb-6">Sign in to save your questions and get notified when answers change.</p>
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <Button
                    className="rounded-full h-12 text-base shadow-md hover:shadow-lg hover:scale-[1.02] transition-all active:scale-[0.98]"
                    onClick={finish}
                    disabled={saveStatus !== "idle"}
                  >
                    {saveStatus === "saving" ? "Saving..." : saveStatus === "redirecting" ? "Sign in to save your questions..." : "Save My Questions"}
                  </Button>
                  <Button variant="ghost" className="rounded-full h-10 text-muted-foreground" onClick={() => router.push("/")}>Just browsing for now</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
