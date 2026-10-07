"use client";

import { useEffect, useState } from "react";

type Pattern = { claim: string; evidence: string };
type Profile = { patterns: Pattern[]; themes: string[]; archiveSize: number; thin: boolean };
type Idea = {
  idea: string;
  mechanism: string;
  verdict: "new" | "reframe" | "repeat";
  gateNote: string;
  why: string;
  needsVerification: boolean;
  verifyWhat: string;
};
type Outline = {
  hook: string;
  points: { point: string; bullets: string[] }[];
  close: string;
  experienceSlot: string;
  styleBasis: string[];
  needsVerification: string[];
};
type LogEntry = { at: string; idea: string; verdict: string; reaction: string; note: string };

const FORMATS = [
  "short-form video script, 30-60 seconds",
  "long-form video outline, 8-15 minutes",
  "written post (LinkedIn, X thread, newsletter)",
];

const VERDICT_STYLE: Record<string, string> = {
  new: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  reframe: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  repeat: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const VERDICT_LABEL: Record<string, string> = {
  new: "NEW",
  reframe: "REFRAME",
  repeat: "ALREADY COVERED",
};

export default function Home() {
  const [archive, setArchive] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [chosen, setChosen] = useState<Idea | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // The run log is the evidence this project is measured on, so it survives reloads where it can
  // and is exportable regardless.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("creator-os-log");
      if (saved) setLog(JSON.parse(saved));
    } catch {
      // Private browsing or blocked storage; the log still works for this session.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("creator-os-log", JSON.stringify(log));
    } catch {
      // Non-fatal.
    }
  }, [log]);

  // Wraps every API call so one error path handles loading state and messaging.
  async function call<T>(path: string, body: unknown, label: string): Promise<T | null> {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      return data as T;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setBusy("");
    }
  }

  const keptPatterns = profile
    ? profile.patterns.filter((_, i) => !rejected.has(i)).map((p) => p.claim)
    : [];

  async function analyze() {
    const data = await call<Profile>("/api/profile", { archive }, "Reading the archive");
    if (data) {
      setProfile(data);
      setRejected(new Set());
      setIdeas(null);
      setChosen(null);
      setOutline(null);
    }
  }

  async function generate() {
    const data = await call<{ ideas: Idea[] }>(
      "/api/ideas",
      { archive, patterns: keptPatterns, themes: profile?.themes, topic: topic.trim() || undefined },
      "Generating and gating ideas"
    );
    if (data) {
      setIdeas(data.ideas);
      setChosen(null);
      setOutline(null);
    }
  }

  async function expand(idea: Idea) {
    setChosen(idea);
    setOutline(null);
    const data = await call<Outline>(
      "/api/outline",
      { idea: idea.idea, patterns: keptPatterns, format },
      "Writing the outline"
    );
    if (data) setOutline(data);
  }

  // Captures the creator's verdict, which is both the hypothesis evidence and the record of what
  // they actually accepted.
  function react(reaction: string) {
    if (!chosen) return;
    const note = reaction === "fix" ? prompt("What needed fixing?") ?? "" : "";
    setLog([
      { at: new Date().toISOString(), idea: chosen.idea, verdict: chosen.verdict, reaction, note },
      ...log,
    ]);
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "creator-os-run-log.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Creator OS</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Ideas and outlines from your own archive, with every candidate checked against what you
            have already published.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Step 1 */}
        <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Step 1 — Your archive
          </h2>
          <p className="mb-3 text-sm text-neutral-400">
            Paste your past posts, captions, or transcripts. More is better; under ten pieces is too
            thin to read a style from.
          </p>
          <textarea
            value={archive}
            onChange={(e) => setArchive(e.target.value)}
            rows={8}
            placeholder="Paste 20+ of your published pieces here, separated by blank lines..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
          />
          <button
            onClick={analyze}
            disabled={!!busy || archive.trim().length < 200}
            className="mt-3 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
          >
            {busy === "Reading the archive" ? "Reading..." : "Read my style"}
          </button>
        </section>

        {/* Step 2 */}
        {profile && (
          <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Step 2 — Confirm what I read
            </h2>
            <p className="mb-4 text-sm text-neutral-400">
              {profile.archiveSize} pieces read. Reject anything I got wrong — rejected claims are
              excluded from everything below.
              {profile.thin && (
                <span className="mt-2 block text-amber-400">
                  This archive is thin. Treat the style read as provisional.
                </span>
              )}
            </p>
            <ul className="space-y-2">
              {profile.patterns.map((p, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-3 text-sm ${
                    rejected.has(i)
                      ? "border-neutral-800 bg-neutral-950 opacity-40"
                      : "border-neutral-700 bg-neutral-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={rejected.has(i) ? "line-through" : ""}>{p.claim}</p>
                      <p className="mt-1 text-xs text-neutral-500">Evidence: {p.evidence}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = new Set(rejected);
                        next.has(i) ? next.delete(i) : next.add(i);
                        setRejected(next);
                      }}
                      className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400"
                    >
                      {rejected.has(i) ? "Restore" : "Not me"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-3 border-t border-neutral-800 pt-4">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Optional: a topic you already have in mind. Leave blank and I'll propose from your themes."
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
              />
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                onClick={generate}
                disabled={!!busy || keptPatterns.length === 0}
                className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
              >
                {busy === "Generating and gating ideas" ? "Thinking..." : "Give me ideas"}
              </button>
            </div>
          </section>
        )}

        {/* Step 3 */}
        {ideas && (
          <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Step 3 — Ideas, checked against your archive
            </h2>
            <p className="mb-4 text-sm text-neutral-400">
              Repeats are shown rather than hidden, so you can see the check working.
            </p>
            <ul className="space-y-3">
              {ideas.map((idea, i) => (
                <li key={i} className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-medium ${
                        VERDICT_STYLE[idea.verdict]
                      }`}
                    >
                      {VERDICT_LABEL[idea.verdict]}
                    </span>
                    <span className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-500">
                      {idea.mechanism}
                    </span>
                    {idea.needsVerification && (
                      <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                        verify before recording
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{idea.idea}</p>
                  <p className="mt-1 text-xs text-neutral-400">{idea.why}</p>
                  {idea.gateNote && (
                    <p className="mt-2 rounded bg-neutral-950 p-2 text-xs text-neutral-400">
                      <span className="text-neutral-500">Archive check: </span>
                      {idea.gateNote}
                    </p>
                  )}
                  {idea.needsVerification && idea.verifyWhat && (
                    <p className="mt-2 text-xs text-sky-300/80">Check: {idea.verifyWhat}</p>
                  )}
                  {idea.verdict !== "repeat" && (
                    <button
                      onClick={() => expand(idea)}
                      disabled={!!busy}
                      className="mt-3 rounded-lg border border-neutral-600 px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {busy === "Writing the outline" && chosen?.idea === idea.idea
                        ? "Writing..."
                        : "Outline this"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Step 4 */}
        {outline && chosen && (
          <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Step 4 — Outline
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Hook</p>
                <p className="mt-1">{outline.hook}</p>
              </div>
              {outline.points.map((p, i) => (
                <div key={i}>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Point {i + 1}</p>
                  <p className="mt-1">{p.point}</p>
                  <ul className="mt-1 list-disc pl-5 text-neutral-400">
                    {p.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Close</p>
                <p className="mt-1">{outline.close}</p>
              </div>
              <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Your experience goes here
                </p>
                <p className="mt-1 text-neutral-400">{outline.experienceSlot}</p>
              </div>
              <div className="border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                <p>Style basis: {outline.styleBasis.join("; ")}</p>
                {outline.needsVerification?.length > 0 && (
                  <p className="mt-1 text-sky-300/80">
                    Verify: {outline.needsVerification.join("; ")}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
              <span className="mr-1 self-center text-xs text-neutral-500">Your verdict:</span>
              {["accept", "fix", "reject"].map((r) => (
                <button
                  key={r}
                  onClick={() => react(r)}
                  className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs capitalize"
                >
                  {r}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Run log */}
        {log.length > 0 && (
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                Run log ({log.length})
              </h2>
              <button
                onClick={exportLog}
                className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400"
              >
                Export JSON
              </button>
            </div>
            <ul className="space-y-2 text-xs">
              {log.map((entry, i) => (
                <li key={i} className="flex gap-2 border-b border-neutral-800 pb-2 text-neutral-400">
                  <span className="shrink-0 font-medium capitalize text-neutral-200">
                    {entry.reaction}
                  </span>
                  <span className="flex-1">{entry.idea}</span>
                  {entry.note && <span className="text-neutral-500">({entry.note})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
