import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: events } = await supabase
    .from("notification_events")
    .select("id, topic_id, trigger_type, delivery_status, channel, sent_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Load topic names for events
  const topicIds = [
    ...new Set(
      ((events ?? []) as Array<{ topic_id: string | null }>)
        .map((e) => e.topic_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const topicNames = new Map<string, string>();
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("topics")
      .select("id, canonical_name")
      .in("id", topicIds);

    for (const t of (topics ?? []) as Array<{ id: string; canonical_name: string }>) {
      topicNames.set(t.id, t.canonical_name);
    }
  }

  const notifications = (events ?? []) as Array<{
    id: string;
    topic_id: string | null;
    trigger_type: string;
    delivery_status: string;
    channel: string;
    sent_at: string | null;
    created_at: string;
  }>;

  const statusColor: Record<string, string> = {
    sent: "bg-positive/10 text-positive",
    pending: "bg-warning/10 text-warning",
    failed: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-6">
        Alert History
      </h1>

      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className="rounded-2xl border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {n.topic_id ? topicNames.get(n.topic_id) ?? "Topic" : "Digest"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {n.trigger_type.replace(/_/g, " ")} via {n.channel}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`rounded-full text-xs ${statusColor[n.delivery_status] ?? ""}`}
                  >
                    {n.delivery_status}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          No notifications yet. Follow questions and enable alerts to get started.
        </p>
      )}
    </div>
  );
}
