"use client";

import React from "react";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";
import {
  Smile,
  Zap,
  Activity,
  Heart,
  Sun,
  Moon,
  AlertTriangle,
  CloudRain,
  Flame,
  Waves,
  Briefcase,
  Home,
  User,
  HeartHandshake,
  DollarSign,
  Compass,
  BookOpen,
  MapPin,
  MessageCircle,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Coffee,
} from "lucide-react";

import { listEntryRecords, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { EntryPayload } from "@/lib/types";
import { listMemoryItems } from "@/lib/memory";
import { generateTrustFirstInsightsReflection } from "@/lib/ai";

type Bucket = Array<[string, number]>;

// Emotion icon mapping
const EMOTION_ICON: Record<string, React.ReactNode> = {
  calm: <Coffee className="w-5 h-5 text-teal-500" />,
  stressed: <Zap className="w-5 h-5 text-amber-500" />,
  anxious: <Activity className="w-5 h-5 text-rose-500" />,
  grateful: <Heart className="w-5 h-5 text-pink-500" />,
  hopeful: <Sun className="w-5 h-5 text-amber-400" />,
  tired: <Moon className="w-5 h-5 text-indigo-400" />,
  frustrated: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  sad: <CloudRain className="w-5 h-5 text-blue-400" />,
  angry: <Flame className="w-5 h-5 text-red-500" />,
  happy: <Smile className="w-5 h-5 text-emerald-500" />,
  overwhelmed: <Waves className="w-5 h-5 text-cyan-600" />,
};

// Default fallback icon
const DEFAULT_ICON = <MessageCircle className="w-5 h-5 text-neutral-400" />;

// Context icon mapping
const CONTEXT_ICON_MAP: Record<string, React.ReactNode> = {
  work: <Briefcase className="w-5 h-5 text-sky-600" />,
  health: <Activity className="w-5 h-5 text-emerald-500" />,
  family: <Home className="w-5 h-5 text-indigo-500" />,
  self: <User className="w-5 h-5 text-violet-500" />,
  relationships: <HeartHandshake className="w-5 h-5 text-rose-500" />,
  money: <DollarSign className="w-5 h-5 text-emerald-600" />,
  future: <Compass className="w-5 h-5 text-indigo-400" />,
  school: <BookOpen className="w-5 h-5 text-amber-600" />,
};

function getIcon(key: string, type: "emotion" | "context") {
  if (type === "emotion") return EMOTION_ICON[key] || DEFAULT_ICON;
  return CONTEXT_ICON_MAP[key] || DEFAULT_ICON;
}

function topN(map: Map<string, number>, n: number): Bucket {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function inRange(iso: string, startMs: number, endMs: number) {
  const t = Date.parse(iso);
  return t >= startMs && t < endMs;
}

export default function InsightsPage() {
  const { message, setMessage } = useToast();

  const [topEmotions, setTopEmotions] = React.useState<Bucket>([]);
  const [topContexts, setTopContexts] = React.useState<Bucket>([]);
  const [pairings, setPairings] = React.useState<Bucket>([]);
  const [totalEntries, setTotalEntries] = React.useState(0);
  const [entriesThisWeek, setEntriesThisWeek] = React.useState(0);
  const [entriesLastWeek, setEntriesLastWeek] = React.useState(0);

  // Time windows: last 7 days vs previous 7 days
  const [weekEmotions, setWeekEmotions] = React.useState<{ thisWeek: Bucket; lastWeek: Bucket }>({
    thisWeek: [],
    lastWeek: [],
  });
  const [weekContexts, setWeekContexts] = React.useState<{ thisWeek: Bucket; lastWeek: Bucket }>({
    thisWeek: [],
    lastWeek: [],
  });

  const [memories, setMemories] = React.useState<string[]>([]);
  const [reflection, setReflection] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return;

      const settings = await getSettings();
      if (!settings.insightsEnabled) {
        setMessage("Insights are off. Enable them in Settings.");
        return;
      }

      const records = await listEntryRecords();
      const entries: EntryPayload[] = [];

      for (const r of records) {
        try {
          entries.push(await decryptJson<EntryPayload>(key, r.ciphertextB64, r.ivB64));
        } catch {
          // Gracefully skip undecryptable entries to prevent crashing
          console.warn(`Skipping corrupted or locked entry: ${r.id}`);
        }
      }

      setTotalEntries(entries.length);

      // User-approved memories
      try {
        const mem = await listMemoryItems();
        setMemories(mem.slice(0, 5).map((m) => m.item.text));
      } catch {
        setMemories([]);
      }

      // Global aggregates
      const emo = new Map<string, number>();
      const ctx = new Map<string, number>();
      const pair = new Map<string, number>();

      // Weekly windows
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const thisStart = now - 7 * day;
      const lastStart = now - 14 * day;

      const emoThis = new Map<string, number>();
      const emoLast = new Map<string, number>();
      const ctxThis = new Map<string, number>();
      const ctxLast = new Map<string, number>();

      let thisWeekCount = 0;
      let lastWeekCount = 0;

      for (const e of entries) {
        const createdAt = e.createdAt ?? "";
        const eEmo = e.tags?.emotion ?? null;
        const eCtx = e.tags?.context ?? null;

        if (eEmo) emo.set(eEmo, (emo.get(eEmo) ?? 0) + 1);
        if (eCtx) ctx.set(eCtx, (ctx.get(eCtx) ?? 0) + 1);
        if (eEmo && eCtx) {
          const k = `${eEmo} + ${eCtx}`;
          pair.set(k, (pair.get(k) ?? 0) + 1);
        }

        if (inRange(createdAt, thisStart, now)) {
          thisWeekCount++;
          if (eEmo) emoThis.set(eEmo, (emoThis.get(eEmo) ?? 0) + 1);
          if (eCtx) ctxThis.set(eCtx, (ctxThis.get(eCtx) ?? 0) + 1);
        } else if (inRange(createdAt, lastStart, thisStart)) {
          lastWeekCount++;
          if (eEmo) emoLast.set(eEmo, (emoLast.get(eEmo) ?? 0) + 1);
          if (eCtx) ctxLast.set(eCtx, (ctxLast.get(eCtx) ?? 0) + 1);
        }
      }

      setEntriesThisWeek(thisWeekCount);
      setEntriesLastWeek(lastWeekCount);
      setTopEmotions(topN(emo, 6));
      setTopContexts(topN(ctx, 6));
      setPairings(topN(pair, 6));
      setWeekEmotions({ thisWeek: topN(emoThis, 6), lastWeek: topN(emoLast, 6) });
      setWeekContexts({ thisWeek: topN(ctxThis, 6), lastWeek: topN(ctxLast, 6) });
    })();
  }, [setMessage]);

  async function onGenerateReflection() {
    setBusy(true);
    try {
      const settings = await getSettings();
      if (!settings.aiEnabled) return setMessage("AI is off. Enable it in Settings.");

      const apiKey = settings.rememberAiKey
        ? (settings.aiApiKey ?? "")
        : (sessionStorage.getItem("ai_api_key") ?? "");
      if (!apiKey) return setMessage("Add an AI API key in Settings.");

      const aggregatesText = `
On-device aggregates (user-chosen labels; not interpretations):

Top emotions (all time): ${topEmotions.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Top contexts (all time): ${topContexts.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Top emotion+context pairings: ${pairings.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

Last 7 days emotions: ${weekEmotions.thisWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Previous 7 days emotions: ${weekEmotions.lastWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

Last 7 days contexts: ${weekContexts.thisWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Previous 7 days contexts: ${weekContexts.lastWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

User-approved memories (optional):
${memories.map((m) => `- ${m}`).join("\n") || "none"}

Write a gentle reflection based ONLY on these aggregates and memories.
No diagnosis, no moralizing, no certainty claims.
End with one optional question.
`.trim();

      const reply = await generateTrustFirstInsightsReflection({
        apiKey,
        aggregatesText,
      });

      setReflection(`${reply.reflection}${reply.question ? `\n\nQuestion: ${reply.question}` : ""}`);
    } catch {
      setMessage("Could not generate reflection.");
    } finally {
      setBusy(false);
    }
  }

  // Color palette for visual bars
  const BAR_COLORS = [
    "from-indigo-400 to-indigo-300",
    "from-violet-400 to-violet-300",
    "from-sky-400 to-sky-300",
    "from-teal-400 to-teal-300",
    "from-amber-400 to-amber-300",
    "from-rose-400 to-rose-300",
  ];

  const BG_COLORS = [
    "bg-indigo-50",
    "bg-violet-50",
    "bg-sky-50",
    "bg-teal-50",
    "bg-amber-50",
    "bg-rose-50",
  ];

  function StatCard({ label, value, subtext, icon }: { label: string; value: string | number; subtext?: string; icon?: React.ReactNode }) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white border border-neutral-100 px-4 py-3 shadow-sm">
        {icon && <div className="p-2 bg-neutral-50 rounded-full">{icon}</div>}
        <div>
          <div className="text-2xl font-bold text-neutral-900 leading-none">{value}</div>
          <div className="text-xs text-neutral-500 mt-1">{label}</div>
          {subtext && <div className="text-[10px] text-neutral-400 mt-0.5">{subtext}</div>}
        </div>
      </div>
    );
  }

  function TrendArrow({ current, previous }: { current: number; previous: number }) {
    if (current === previous) return <Minus className="w-3 h-3 text-neutral-400" />;
    if (current > previous)
      return (
        <span className="flex items-center text-emerald-600 text-xs font-medium">
          <TrendingUp className="w-3 h-3 mr-0.5" /> {current - previous}
        </span>
      );
    return (
      <span className="flex items-center text-amber-500 text-xs font-medium">
        <TrendingDown className="w-3 h-3 mr-0.5" /> {previous - current}
      </span>
    );
  }

  function VisualBucket({
    items,
    empty,
    showChart = false,
    type,
  }: {
    items: Bucket;
    empty: string;
    showChart?: boolean;
    type: "emotion" | "context";
  }) {
    const maxCount = items.length > 0 ? Math.max(...items.map(([, v]) => v)) : 1;
    const total = items.reduce((sum, [, v]) => sum + v, 0);

    return (
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-neutral-500 italic p-4 text-center bg-neutral-50 rounded-xl">{empty}</div>
        ) : (
          <>
            {showChart && (
              <div className="flex items-end gap-2 h-24 px-1 pb-1 pt-4">
                {items.map(([k, v], i) => (
                  <div key={k} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="text-[10px] font-bold text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity mb-auto">
                      {Math.round((v / total) * 100)}%
                    </div>
                    <div
                      className={`w-full rounded-lg bg-gradient-to-t ${BAR_COLORS[i % BAR_COLORS.length]} shadow-sm transition-all duration-500 hover:brightness-110`}
                      style={{ height: `${Math.max((v / maxCount) * 80, 10)}%` }}
                      title={`${k}: ${v}`}
                    />
                    <div className="flex flex-col items-center gap-1">
                      {getIcon(k, type)}
                      <span className="text-[10px] text-neutral-500 truncate max-w-[60px] text-center font-medium capitalize">
                        {k}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {items.map(([k, v], i) => {
                const percentage = Math.round((v / total) * 100);
                return (
                  <div
                    key={k}
                    className={`flex items-center gap-3 rounded-xl ${BG_COLORS[i % BG_COLORS.length]} px-3 py-2.5 transition-all hover:scale-[1.01]`}
                  >
                    <div className="p-1.5 bg-white/60 rounded-full shadow-sm">
                      {getIcon(k, type)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-neutral-800 capitalize">{k}</div>
                      <div className="text-[10px] text-neutral-500">{percentage}% of entries</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-neutral-700">{v}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  function ComparisonBucket({ thisWeek, lastWeek, label, type }: { thisWeek: Bucket; lastWeek: Bucket; label: string; type: "emotion" | "context" }) {
    const allKeys = new Set([...thisWeek.map(([k]) => k), ...lastWeek.map(([k]) => k)]);
    const thisMap = new Map(thisWeek);
    const lastMap = new Map(lastWeek);

    return (
      <div className="space-y-3">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{label}</div>
        {allKeys.size === 0 ? (
          <div className="text-sm text-neutral-500 italic p-2">No data yet</div>
        ) : (
          <div className="space-y-2">
            {[...allKeys].slice(0, 5).map((k) => {
              const thisVal = thisMap.get(k) ?? 0;
              const lastVal = lastMap.get(k) ?? 0;
              return (
                <div key={k} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-neutral-50 transition-colors">
                  {getIcon(k, type)}
                  <span className="flex-1 text-neutral-700 capitalize font-medium">{k}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-neutral-900">{thisVal}</span>
                    <span className="text-neutral-300 text-xs">vs {lastVal}</span>
                    <TrendArrow current={thisVal} previous={lastVal} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function PairingPill({ pairing, count, index }: { pairing: string; count: number; index: number }) {
    const [emotion, context] = pairing.split(" + ");
    return (
      <div className={`inline-flex items-center gap-2 rounded-full border border-neutral-100 bg-white px-3 py-1.5 shadow-sm hover:shadow-md transition-shadow`}>
        {getIcon(emotion, "emotion")}
        <span className="text-xs font-medium text-neutral-600 capitalize">{emotion}</span>
        <span className="text-neutral-300">|</span>
        {getIcon(context, "context")}
        <span className="text-xs font-medium text-neutral-600 capitalize">{context}</span>
        <span className="ml-1 text-[10px] font-bold text-white bg-neutral-900 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {count}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <Toast message={message} />

      <PageHeader
        title="Insights"
        subtitle="Discover patterns in your journey. Observed, not judged."
        right={
          <Button onClick={onGenerateReflection} disabled={busy} className="gap-2">
            <Sparkles className="w-4 h-4" />
            {busy ? "Thinking..." : "AI Reflection"}
          </Button>
        }
      />

      {/* Summary Stats Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total Entries" value={totalEntries} icon={<BookOpen className="w-5 h-5 text-neutral-600" />} />
        <StatCard
          label="This Week"
          value={entriesThisWeek}
          subtext={entriesLastWeek > 0 ? `vs ${entriesLastWeek} last week` : undefined}
          icon={<Calendar className="w-5 h-5 text-indigo-500" />}
        />
        <StatCard
          label="Top Emotion"
          value={topEmotions[0]?.[0] || "—"}
          subtext={topEmotions[0] ? `${topEmotions[0][1]} times` : undefined}
          icon={getIcon(topEmotions[0]?.[0] || "", "emotion")}
        />
        <StatCard
          label="Top Context"
          value={topContexts[0]?.[0] || "—"}
          subtext={topContexts[0] ? `${topContexts[0][1]} times` : undefined}
          icon={getIcon(topContexts[0]?.[0] || "", "context")}
        />
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="bg-white px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <div className="text-neutral-900 font-bold flex items-center gap-2">
                <Smile className="w-4 h-4 text-indigo-500" />
                Emotions
              </div>
              <div className="text-neutral-500 text-xs mt-0.5">How you've been feeling</div>
            </div>
          </div>
          <CardBody className="pt-0">
            <VisualBucket
              items={topEmotions}
              empty="Add emotion tags to entries to see this."
              showChart
              type="emotion"
            />
          </CardBody>
        </Card>

        <Card className="overflow-hidden border-0 shadow-md">
          <div className="bg-white px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <div className="text-neutral-900 font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-500" />
                Contexts
              </div>
              <div className="text-neutral-500 text-xs mt-0.5">What's occupying your mind</div>
            </div>
          </div>
          <CardBody className="pt-0">
            <VisualBucket
              items={topContexts}
              empty="Add context tags to entries to see this."
              showChart
              type="context"
            />
          </CardBody>
        </Card>
      </div>

      {/* Common Pairings */}
      <Card className="border-0 shadow-md">
        <CardBody>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-rose-50 rounded-lg">
              <HeartHandshake className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-900">Connections & Patterns</div>
              <div className="text-xs text-neutral-500">How emotions and contexts tend to appear together</div>
            </div>
          </div>

          {pairings.length === 0 ? (
            <div className="text-sm text-neutral-500 italic p-6 text-center bg-neutral-50 rounded-xl">
              Tag both an emotion and a context in your entries to see connections here.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {pairings.map(([pairing, count], i) => (
                <PairingPill key={pairing} pairing={pairing} count={count} index={i} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Weekly Comparison */}
      <Card className="bg-white border-0 shadow-md">
        <CardBody>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-neutral-900">Weekly Flow</div>
                <div className="text-xs text-neutral-500">Recent shifts in your patterns</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium bg-neutral-50 px-3 py-1.5 rounded-full">
              <span className="flex items-center text-emerald-600"><TrendingUp className="w-3 h-3 mr-1" /> Rising</span>
              <span className="text-neutral-300">|</span>
              <span className="flex items-center text-amber-500"><TrendingDown className="w-3 h-3 mr-1" /> Falling</span>
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <ComparisonBucket thisWeek={weekEmotions.thisWeek} lastWeek={weekEmotions.lastWeek} label="Emotions" type="emotion" />
            <ComparisonBucket thisWeek={weekContexts.thisWeek} lastWeek={weekContexts.lastWeek} label="Contexts" type="context" />
          </div>
        </CardBody>
      </Card>

      {/* Memories */}
      <Card className="border-0 shadow-sm bg-amber-50/50 border-amber-100">
        <CardBody>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <div className="text-sm font-bold text-neutral-900">Saved Memories</div>
          </div>
          <div className="text-xs text-neutral-500 mb-4">
            Key insights you've chosen to carry forward.
          </div>
          <div className="space-y-2">
            {memories.length === 0 ? (
              <div className="text-sm text-neutral-500 italic">No saved memories yet.</div>
            ) : (
              memories.map((m, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-white border border-amber-100/50 px-4 py-3 shadow-sm">
                  <div className="mt-1 min-w-[6px] h-[6px] rounded-full bg-amber-400" />
                  <span className="text-sm text-neutral-800 italic leading-relaxed">"{m}"</span>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      {/* AI Reflection */}
      {reflection ? (
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-violet-100">
          <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-4">
            <div className="text-white font-bold flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-violet-200" /> AI Reflection
            </div>
            <div className="text-violet-100 text-sm mt-1 opacity-90">A gentle mirror for your recent patterns</div>
          </div>
          <CardBody className="p-6">
            <div className="whitespace-pre-wrap text-neutral-800 leading-relaxed font-serif text-lg opacity-90">
              {reflection}
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-400">
              <Activity className="w-3 h-3" />
              Generated exclusively from your local aggregates. Private & secure.
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
