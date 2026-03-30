import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadTopicData } from "@/lib/load-topic-data";
import { FollowButton } from "@/components/follow-button";
import { CompetitionTemplate } from "@/components/templates/competition-page";
import { ThresholdTemplate } from "@/components/templates/threshold-page";
import { BinaryEventTemplate } from "@/components/templates/binary-event-page";
import { SmartFriendTemplate } from "@/components/templates/smart-friend-page";
import type { QuestionType } from "@/lib/question-contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

interface QuestionPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Question-native route: /questions/[slug]
 *
 * This is the REAL rendered page. It loads the question, its primary topic,
 * then switches to the right template based on contract.questionType:
 *   - competition -> CompetitionTemplate (race card, leaderboard)
 *   - threshold -> ThresholdTemplate (metric card, distance to target)
 *   - binary_event -> BinaryEventTemplate (verdict, case for/against)
 *
 * Questions without an explicit question_type or without enough data
 * fall back to the binary_event template (closest to the current shared layout).
 */
export async function generateMetadata({ params }: QuestionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await db(supabase)
    .from("questions")
    .select("question_text, category, primary_topic_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const q = data as { question_text: string; category: string | null; primary_topic_id: string } | null;
  if (!q) return { title: "QUESERA" };

  // Load card data for OG description + image
  const { data: card } = await db(supabase)
    .from("public_topic_cards")
    .select("one_liner, expert_line, competition_leader, competition_leader_pct, confidence, direction")
    .eq("topic_id", q.primary_topic_id)
    .maybeSingle();
  const cardData = card as {
    one_liner: string | null; expert_line: string | null;
    competition_leader: string | null; competition_leader_pct: number | null;
    confidence: number | null; direction: string | null;
  } | null;
  const ogDescription = cardData?.one_liner ?? cardData?.expert_line ?? `See what prediction markets and data say about: ${q.question_text}`;

  // Build dynamic OG image URL
  const ogParams = new URLSearchParams({ q: q.question_text });
  if (q.category) ogParams.set("c", q.category);
  if (cardData?.expert_line) ogParams.set("v", cardData.expert_line.slice(0, 80));
  if (cardData?.competition_leader) {
    ogParams.set("l", cardData.competition_leader);
    if (cardData.competition_leader_pct) ogParams.set("n", `${Math.round(cardData.competition_leader_pct)}%`);
  } else if (cardData?.confidence !== null && cardData?.confidence !== undefined) {
    ogParams.set("n", `${Math.round(cardData.confidence * 100)}%`);
  }
  const ogImageUrl = `/api/og?${ogParams.toString()}`;

  return {
    title: `${q.question_text} -- QUESERA`,
    description: ogDescription,
    openGraph: {
      title: q.question_text,
      description: ogDescription,
      siteName: "QUESERA",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: q.question_text }],
    },
    twitter: {
      card: "summary_large_image",
      title: q.question_text,
      description: ogDescription,
      images: [ogImageUrl],
    },
  };
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Load the question
  const { data } = await db(supabase)
    .from("questions")
    .select("id, question_text, slug, question_type, status, category, primary_topic_id, is_featured")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) notFound();

  const question = data as {
    id: string;
    question_text: string;
    slug: string;
    question_type: string | null;
    status: string;
    category: string | null;
    primary_topic_id: string;
    is_featured: boolean;
  };

  // Only show published or resolved questions
  if (question.status !== "published" && question.status !== "resolved") notFound();

  // Load the primary topic
  const { data: topic } = await supabase
    .from("topics")
    .select("id, canonical_name, slug, category, description")
    .eq("id", question.primary_topic_id)
    .single();

  if (!topic) notFound();

  const t = topic as {
    id: string;
    canonical_name: string;
    slug: string;
    category: string | null;
    description: string | null;
  };

  // Load all data via shared loader
  const { props, pagePublishable } = await loadTopicData({
    topicId: t.id,
    topicSlug: t.slug,
    topicCategory: t.category,
    topicCanonicalName: t.canonical_name,
    topicDescription: t.description,
    questionId: question.id,
    questionText: question.question_text,
    questionSlug: question.slug,
    questionType: (question.question_type as QuestionType | null),
    questionCategory: question.category,
  });

  // Publication gate: if not enough signals OR quality gates blocked, show gathering state
  if (!pagePublishable || props.renderingMode === "blocked") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <section className="animate-slide-up text-center py-16">
          {props.heroImage && (
            <div className="relative -mx-6 mb-8 rounded-2xl overflow-hidden">
              <div className="relative h-40">
                <img src={props.heroImage} alt="" className="w-full h-full object-cover opacity-20 grayscale" loading="eager" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
              </div>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">{question.question_text}</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            We are gathering signals from prediction markets and other sources to answer this question. Check back soon.
          </p>
          <FollowButton topicSlug={t.slug} isAuthenticated={props.isAuthenticated} initialFollowing={props.isFollowing} />
        </section>
      </div>
    );
  }

  const sourceFamilies = [...new Set(props.signals.map((s) => s.source_family))];
  const isThinPage = sourceFamilies.length < 2 && props.signals.length < 5;
  const questionType = props.contract.questionType;

  const thinBanner = isThinPage ? (
    <div className="mx-auto max-w-3xl px-6">
      <div className="mb-6 p-3 rounded-xl bg-muted/30 dark:bg-white/5 border border-border/20 dark:border-white/10 text-center">
        <p className="text-xs text-muted-foreground">
          This question is currently tracked from {sourceFamilies.length === 1 ? "a single source" : "limited sources"}.
          We are working to add more perspectives.
        </p>
      </div>
    </div>
  ) : null;

  // Competition pages always use CompetitionTemplate (logos, leaderboard, race card)
  // SmartFriendTemplate is for threshold/binary pages where the smart-friend voice fits
  if (questionType === "competition") {
    return <>{thinBanner}<CompetitionTemplate props={props} /></>;
  }

  // Featured non-competition questions use SmartFriendTemplate
  if (question.is_featured) {
    return <SmartFriendTemplate props={props} />;
  }

  if (questionType === "threshold") {
    return <>{thinBanner}<ThresholdTemplate props={props} /></>;
  }

  // Default: binary_event (also catches any unknown types)
  return <>{thinBanner}<BinaryEventTemplate props={props} /></>;
}
