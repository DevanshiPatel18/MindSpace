"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Field";
import { Toast, useToast } from "@/components/Toast";
import { Search, Sparkles, Quote, Calendar, ArrowRight } from "lucide-react";

import { listEntryRecords, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { EntryPayload } from "@/lib/types";
import { generateRecallReply, type RecallReply } from "@/lib/ai";
import { formatDate } from "@/lib/util";

export default function RecallPage() {
    const { message, setMessage } = useToast();
    const [query, setQuery] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState("");
    const [result, setResult] = React.useState<RecallReply | null>(null);

    async function onSearch(e?: React.FormEvent) {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setResult(null);
        setBusy(true);
        setStatus("Scanning local entries...");

        try {
            const key = getSessionKey();
            if (!key) throw new Error("App is locked. Unlock to search.");

            const settings = await getSettings();
            if (!settings.aiEnabled) throw new Error("AI is disabled in Settings.");

            const apiKey = settings.rememberAiKey
                ? (settings.aiApiKey ?? "")
                : (sessionStorage.getItem("ai_api_key") ?? "");

            if (!apiKey && !settings.useDefaultAiKey) {
                throw new Error("No AI API key found. Check Settings.");
            }

            // 1. Fetch and Decrypt Context (last 50 entries)
            const records = await listEntryRecords();
            const recent = records.slice(0, 50);
            const decrypted: Array<{ date: string; text: string }> = [];

            setStatus(`Decrypting ${recent.length} entries...`);
            for (const r of recent) {
                try {
                    const payload = await decryptJson<EntryPayload>(key, r.ciphertextB64, r.ivB64);
                    const fullText = payload.steps.map(s => `${s.prompt}\n${s.response}`).join("\n");
                    decrypted.push({
                        date: formatDate(payload.createdAt),
                        text: fullText
                    });
                } catch {
                    // skip corrupted
                }
            }

            if (decrypted.length === 0) {
                throw new Error("No readable entries found to search.");
            }

            // 2. Format Context for AI
            const contextText = decrypted
                .map(d => `[Date: ${d.date}]\n${d.text}`)
                .join("\n\n---\n\n");

            setStatus("AI is analyzing your patterns...");

            // 3. Call AI Recall
            const reply = await generateRecallReply({
                apiKey,
                question: query,
                contextText,
            });

            setResult(reply);
        } catch (err: any) {
            setMessage(err.message || "Recall failed.");
        } finally {
            setBusy(false);
            setStatus("");
        }
    }

    return (
        <div className="space-y-6">
            <Toast message={message} />

            <PageHeader
                title="Recall"
                subtitle="Search your history for patterns and memories."
                right={
                    <Link href="/">
                        <Button variant="ghost">Home</Button>
                    </Link>
                }
            />

            <Card>
                <CardBody className="py-6">
                    <form onSubmit={onSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                className="w-full rounded-xl border border-neutral-200 bg-white px-9 py-2 text-sm focus:border-neutral-900 focus:ring-neutral-900/5 outline-none placeholder:text-neutral-400"
                                placeholder="Ask your journal..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <Button type="submit" disabled={busy || !query.trim()}>
                            {busy ? "Searching..." : "Search"}
                        </Button>
                    </form>

                    {status && (
                        <div className="mt-4 text-xs text-neutral-500 italic">
                            {status}
                        </div>
                    )}
                </CardBody>
            </Card>

            {!result && !busy && (
                <div className="py-12 text-center text-sm text-neutral-400 italic">
                    What would you like to recall today?
                </div>
            )}

            {result && (
                <div className="space-y-4">
                    <Card>
                        <CardBody>
                            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                <Quote className="w-3 h-3" /> Answer
                            </div>
                            <div className="text-neutral-900 leading-relaxed whitespace-pre-wrap text-sm">
                                {result.answer}
                            </div>
                        </CardBody>
                    </Card>

                    <div className="text-[10px] text-neutral-400 uppercase tracking-widest pl-2">
                        Private & Ephemeral Session
                    </div>
                </div>
            )}
        </div>
    );
}
