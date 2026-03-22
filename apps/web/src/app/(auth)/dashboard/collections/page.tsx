"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  slug: string | null;
  created_at: string;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  async function loadCollections() {
    const res = await fetch("/api/collections");
    const data = (await res.json()) as { collections: Collection[] };
    setCollections(data.collections);
  }

  async function createCollection() {
    if (!newTitle.trim()) return;
    setCreating(true);
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setNewTitle("");
    setCreating(false);
    loadCollections();
  }

  async function deleteCollection(id: string) {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    loadCollections();
  }

  async function togglePublish(col: Collection) {
    if (col.is_public) {
      await fetch(`/api/collections/${col.id}/unpublish`, { method: "POST" });
    } else {
      await fetch(`/api/collections/${col.id}/publish`, { method: "POST" });
    }
    loadCollections();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-6">
        My Collections
      </h1>

      <div className="flex gap-3 mb-8">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New collection name..."
          className="rounded-full"
          onKeyDown={(e) => { if (e.key === "Enter") createCollection(); }}
        />
        <Button
          onClick={createCollection}
          disabled={creating || !newTitle.trim()}
          className="rounded-full"
        >
          Create
        </Button>
      </div>

      {collections.length > 0 ? (
        <div className="space-y-3">
          {collections.map((col) => (
            <CollectionItem
              key={col.id}
              collection={col}
              onPublish={() => togglePublish(col)}
              onDelete={() => deleteCollection(col.id)}
              onChanged={loadCollections}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          Create collections to organize and share groups of topics.
        </p>
      )}
    </div>
  );
}

function CollectionItem({
  collection,
  onPublish,
  onDelete,
  onChanged,
}: {
  collection: Collection;
  onPublish: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [topicSlug, setTopicSlug] = useState("");
  const [topics, setTopics] = useState<Array<{ topic_id: string; name: string }>>([]);

  async function loadTopics() {
    // Load collection_topics via the collection's topics
    const res = await fetch(`/api/search?q=`);
    // This is a simplified approach — in production would use a dedicated endpoint
    setExpanded(!expanded);
  }

  async function addTopic() {
    if (!topicSlug.trim()) return;
    // Search for topic by slug to get ID
    const searchRes = await fetch(`/api/search?q=${encodeURIComponent(topicSlug)}`);
    const searchData = (await searchRes.json()) as { results: Array<{ id: string; slug: string; canonical_name: string }> };
    const match = searchData.results[0];
    if (!match) return;

    await fetch(`/api/collections/${collection.id}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: match.id }),
    });
    setTopicSlug("");
    onChanged();
  }

  async function removeTopic(topicId: string) {
    await fetch(`/api/collections/${collection.id}/topics/${topicId}`, {
      method: "DELETE",
    });
    setTopics(topics.filter((t) => t.topic_id !== topicId));
    onChanged();
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="cursor-pointer" onClick={loadTopics}>
            <p className="text-sm font-medium">{collection.title}</p>
            {collection.description && (
              <p className="text-xs text-muted-foreground">{collection.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={onPublish}>
              {collection.is_public ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full text-xs text-destructive" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="flex gap-2 mb-3">
              <Input
                value={topicSlug}
                onChange={(e) => setTopicSlug(e.target.value)}
                placeholder="Search topic to add..."
                className="rounded-full text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") addTopic(); }}
              />
              <Button size="sm" onClick={addTopic} className="rounded-full text-xs">
                Add
              </Button>
            </div>
            {topics.length > 0 && (
              <div className="space-y-1">
                {topics.map((t) => (
                  <div key={t.topic_id} className="flex items-center justify-between py-1">
                    <span className="text-xs">{t.name}</span>
                    <button
                      onClick={() => removeTopic(t.topic_id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
