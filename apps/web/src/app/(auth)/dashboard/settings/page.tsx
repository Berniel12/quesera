"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Preferences {
  email_enabled: boolean;
  digest_frequency: string;
  alert_sensitivity: string;
  global_mute: boolean;
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>({
    email_enabled: true,
    digest_frequency: "daily",
    alert_sensitivity: "balanced",
    global_mute: false,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => r.json())
      .then((data: { preferences: Preferences }) => {
        setPrefs(data.preferences);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
  }

  if (!loaded) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-6">
        Notification Settings
      </h1>

      <Card className="rounded-3xl border-border/40 mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-sm">Email alerts enabled</span>
            <input
              type="checkbox"
              checked={prefs.email_enabled}
              onChange={(e) => setPrefs({ ...prefs, email_enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">Global mute (silence all)</span>
            <input
              type="checkbox"
              checked={prefs.global_mute}
              onChange={(e) => setPrefs({ ...prefs, global_mute: e.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <div>
            <span className="text-sm block mb-2">Digest frequency</span>
            <select
              value={prefs.digest_frequency}
              onChange={(e) => setPrefs({ ...prefs, digest_frequency: e.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div>
            <span className="text-sm block mb-2">Default alert sensitivity</span>
            <select
              value={prefs.alert_sensitivity}
              onChange={(e) => setPrefs({ ...prefs, alert_sensitivity: e.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="all">All changes</option>
              <option value="balanced">Balanced</option>
              <option value="high_impact">High impact only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="rounded-full">
        {saving ? "Saving..." : "Save Preferences"}
      </Button>

      <PerTopicAlerts />
    </div>
  );
}

function PerTopicAlerts() {
  const [topics, setTopics] = useState<
    Array<{ topic_id: string; canonical_name: string; is_muted: boolean; sensitivity: string }>
  >([]);
  const [topicLoaded, setTopicLoaded] = useState(false);

  useEffect(() => {
    loadTopicAlerts();
  }, []);

  async function loadTopicAlerts() {
    // Load followed topics
    const followsRes = await fetch("/api/collections"); // reuse to get topic list indirectly
    // Actually load from user alerts + followed topics
    const alertsRes = await fetch("/api/user/alerts");
    const alertsData = (await alertsRes.json()) as {
      alerts: Array<{ topic_id: string; sensitivity: string; is_muted: boolean }>;
    };

    // We need topic names — fetch from search with empty query won't work
    // Instead, load from public_topic_cards for the followed topic IDs
    // For now, display what we have
    setTopics(
      alertsData.alerts.map((a) => ({
        topic_id: a.topic_id,
        canonical_name: a.topic_id.slice(0, 8) + "...", // placeholder until enriched
        is_muted: a.is_muted,
        sensitivity: a.sensitivity,
      })),
    );
    setTopicLoaded(true);
  }

  async function toggleMute(topicId: string, currentMuted: boolean) {
    await fetch(`/api/user/alerts/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_muted: !currentMuted }),
    });
    loadTopicAlerts();
  }

  async function updateSensitivity(topicId: string, sensitivity: string) {
    await fetch(`/api/user/alerts/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensitivity }),
    });
    loadTopicAlerts();
  }

  if (!topicLoaded) return null;
  if (topics.length === 0) return null;

  return (
    <Card className="rounded-3xl border-border/40 mt-8">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Per-Topic Alert Overrides
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topics.map((t) => (
          <div key={t.topic_id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
            <span className="text-sm font-medium">{t.canonical_name}</span>
            <div className="flex items-center gap-3">
              <select
                value={t.sensitivity}
                onChange={(e) => updateSensitivity(t.topic_id, e.target.value)}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="balanced">Balanced</option>
                <option value="high_impact">High impact</option>
              </select>
              <button
                onClick={() => toggleMute(t.topic_id, t.is_muted)}
                className={`text-xs px-3 py-1 rounded-full ${
                  t.is_muted
                    ? "bg-destructive/10 text-destructive"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {t.is_muted ? "Muted" : "Active"}
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
