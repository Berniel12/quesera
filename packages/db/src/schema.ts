import { z } from "zod";

export const TopicSchema = z.object({
  id: z.string().uuid(),
  canonical_name: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived", "draft", "merged"]),
  is_seeded: z.boolean(),
  is_public: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicAliasSchema = z.object({
  id: z.string().uuid(),
  topic_id: z.string().uuid(),
  alias: z.string().min(1),
  is_primary: z.boolean(),
  created_at: z.string().datetime(),
});
export type TopicAlias = z.infer<typeof TopicAliasSchema>;

export const TopicSeedSchema = z.object({
  canonical_name: z.string().min(1),
  slug: z.string().min(1),
  category: z.string(),
  description: z.string().optional(),
  aliases: z.array(z.string()).min(1),
});
export type TopicSeed = z.infer<typeof TopicSeedSchema>;

export const SearchResultSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  canonical_name: z.string(),
  category: z.string().nullable(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
