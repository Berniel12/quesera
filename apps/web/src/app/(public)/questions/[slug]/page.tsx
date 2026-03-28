import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseClient<any>) { return client as SupabaseClient<any>; }

interface QuestionPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Question-first route: /questions/[slug]
 *
 * This is a thin presentation layer. It loads the question object,
 * then internally redirects to the topic page (which does all the
 * actual rendering). The topic page will receive the question context
 * via the existing question_wrappers/headline system.
 *
 * Future: this page will render its own full experience without
 * redirecting to topics. For now, the redirect gives us question-first
 * URLs with zero rendering duplication.
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

  // Load the primary topic's slug for the redirect
  const { data: topic } = await supabase
    .from("topics")
    .select("slug")
    .eq("id", question.primary_topic_id)
    .single();

  if (!topic) notFound();

  const topicSlug = (topic as { slug: string }).slug;

  // Redirect to the topic page (which has the full rendering)
  // The topic page will pick up this topic's question_wrappers as the headline
  redirect(`/topics/${topicSlug}`);
}
