import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadTopicData } from "@/lib/load-topic-data";
import { FollowButton } from "@/components/follow-button";
import { CompetitionTemplate } from "@/components/templates/competition-page";
import { ThresholdTemplate } from "@/components/templates/threshold-page";
import { BinaryEventTemplate } from "@/components/templates/binary-event-page";
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
    .select("question_text, category")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const q = data as { question_text: string; category: string | null } | null;
  if (!q) return { title: "QUESERA" };

  return {
    title: `${q.question_text} -- QUESERA`,
    description: `QUESERA prediction: ${q.question_text}`,
    openGraph: {
      title: q.question_text,
      description: `See what prediction markets, forecasters, and data say about: ${q.question_text}`,
      siteName: "QUESERA",
    },
  };
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Load the question
  const { data } = await db(supabase)
    .from("questions")
    .select("id, question_text, slug, question_type, status, category, primary_topic_id")
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

  // Publication gate: if not enough signals, show gathering state
  if (!pagePublishable) {
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

  // Template switch based on question type
  const questionType = props.contract.questionType;

  if (questionType === "competition") {
    return <CompetitionTemplate props={props} />;
  }

  if (questionType === "threshold") {
    return <ThresholdTemplate props={props} />;
  }

  // Default: binary_event (also catches any unknown types)
  return <BinaryEventTemplate props={props} />;
}
