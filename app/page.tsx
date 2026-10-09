"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Creator = { id: string; name: string };
type Piece = { source: string; url?: string; text: string };
type PatternRow = {
  id: string;
  ordinal: number;
  claim: string;
  evidence: string | null;
  status: "pending" | "confirmed" | "rejected";
};
type ChoiceRow = {
  id: string;
  kind: "keyword" | "niche";
  ordinal: number;
  label: string;
  rationale: string | null;
  selected: boolean;
};
type StyleRead = {
  id: string;
  niche: string | null;
  themes: string[];
  keywords: string[];
  archive_size: number | null;
  thin: boolean;
};
type IdeaRow = {
  id: string;
  idea: string;
  mechanism: string | null;
  verdict: "new" | "reframe" | "repeat";
  gate_note: string | null;
  why: string | null;
  needs_verification: boolean;
  verify_what: string | null;
  status: "banked" | "shortlisted" | "shot" | "discarded";
  would_shoot: boolean | null;
  created_at: string;
};
type Outline = {
  outlineId: string;
  hook: string | null;
  points: { point: string; bullets: string[] }[];
  close: string | null;
  experienceSlot: string | null;
  styleBasis: string[];
  needsVerification: string[];
};
type ReactionRow = {
  id: string;
  reaction: string;
  note: string | null;
  created_at: string;
  ideas: { idea: string; verdict: string } | null;
};

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

const CREATOR_KEY = "creator-os-creator";

// Mirrors the URL_ONLY guard in lib/archive.ts. New pieces like this are no longer stored, but
// archives built before that fix still hold them, and a row of bare links teaches a style read
// nothing — so it is marked rather than left looking like writing.
const URL_ONLY = /^(\s*https?:\/\/\S+\s*)+$/i;

export default function Home() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [hydrating, setHydrating] = useState(true);

  const [input, setInput] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [styleRead, setStyleRead] = useState<StyleRead | null>(null);
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [choices, setChoices] = useState<ChoiceRow[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [chosen, setChosen] = useState<IdeaRow | null>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [log, setLog] = useState<ReactionRow[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Wraps every API call so one error path handles loading state and messaging.
  const call = useCallback(
    async <T,>(path: string, body: unknown, label: string, method = "POST"): Promise<T | null> => {
      setBusy(label);
      setError("");
      try {
        const res = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
    },
    []
  );

  // Pulls everything back from Postgres: the archive, the latest style read and its decisions,
  // the idea bank and the run log. This is what the database bought — the bank
  // accumulates across sessions instead of dying with the tab.
  const hydrate = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/creator/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your work");

      setCreator(data.creator);
      setPieces(
        (data.pieces ?? []).map((p: { source: string; url: string | null; content: string }) => ({
          source: p.source,
          url: p.url ?? undefined,
          text: p.content,
        }))
      );
      setStyleRead(data.styleRead);
      setPatterns(data.patterns ?? []);
      setChoices(data.choices ?? []);
      setIdeas(data.ideas ?? []);
      setLog(data.reactions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your work");
      // A failed hydrate must not strand the app on a creator it cannot read.
      try {
        localStorage.removeItem(CREATOR_KEY);
      } catch {
        // Non-fatal.
      }
    }
  }, []);

  // The setState calls all land after an await, so this does not cascade renders on mount.
  useEffect(() => {
    (async () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(CREATOR_KEY);
      } catch {
        // Private browsing or blocked storage; the name form just shows instead.
      }
      if (saved) await hydrate(saved);
      setHydrating(false);
    })();
  }, [hydrate]);

  async function signIn() {
    const data = await call<{ creator: Creator }>(
      "/api/creator",
      { name: nameInput },
      "Finding your archive"
    );
    if (!data) return;
    try {
      localStorage.setItem(CREATOR_KEY, data.creator.id);
    } catch {
      // Non-fatal; this session still works.
    }
    await hydrate(data.creator.id);
  }

  // Two scopes, each confirmed separately. Clearing an archive that holds the wrong material is
  // a different intention from starting over, and the run log is the evidence this project is
  // measured on — it should never go as a side effect of re-pasting an archive.
  async function clearData(scope: "archive" | "everything") {
    if (!creator) return;

    const warning =
      scope === "archive"
        ? `Delete all ${pieces.length} archive piece(s) for ${creator.name}? Your style reads, idea bank and run log are kept.`
        : `Delete everything for ${creator.name} — archive, style reads, keyword and niche choices, ideas, outlines and the run log? This cannot be undone.`;

    if (!window.confirm(warning)) return;

    const data = await call<{ cleared: Record<string, number> }>(
      `/api/creator/${creator.id}?scope=${scope}`,
      undefined,
      scope === "archive" ? "Clearing the archive" : "Clearing everything",
      "DELETE"
    );
    if (!data) return;

    setPieces([]);
    setNotes([
      `Cleared ${Object.entries(data.cleared)
        .map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`)
        .join(", ")}.`,
    ]);

    if (scope === "everything") {
      setStyleRead(null);
      setPatterns([]);
      setChoices([]);
      setIdeas([]);
      setChosen(null);
      setOutline(null);
      setLog([]);
    }
  }

  function signOut() {
    try {
      localStorage.removeItem(CREATOR_KEY);
    } catch {
      // Non-fatal.
    }
    setCreator(null);
    setPieces([]);
    setStyleRead(null);
    setPatterns([]);
    setChoices([]);
    setIdeas([]);
    setChosen(null);
    setOutline(null);
    setLog([]);
    setNotes([]);
    setNameInput("");
  }

  const archive = useMemo(
    () =>
      pieces
        .map((p, i) => `--- piece ${i + 1} (${p.source}) ---\n${p.text}`)
        .join("\n\n"),
    [pieces]
  );

  // Rejected claims are excluded from everything generated afterwards. Pending counts as kept:
  // the creator has not objected, and requiring an explicit tick on every claim would be busywork.
  const keptPatterns = useMemo(
    () => patterns.filter((p) => p.status !== "rejected").map((p) => p.claim),
    [patterns]
  );

  const keywordChoices = useMemo(
    () => choices.filter((c) => c.kind === "keyword"),
    [choices]
  );
  const nicheChoices = useMemo(() => choices.filter((c) => c.kind === "niche"), [choices]);

  const keptKeywords = useMemo(
    () => keywordChoices.filter((c) => c.selected).map((c) => c.label),
    [keywordChoices]
  );

  // An empty niche selection means "use what you read", so the fallback lives here rather than
  // being a gate on the button: the creator can correct the read without having to ratify it.
  const chosenNiche = useMemo(() => {
    const picked = nicheChoices.filter((c) => c.selected).map((c) => c.label);
    return picked.length ? picked.join("; ") : styleRead?.niche ?? "";
  }, [nicheChoices, styleRead]);

  // Two steps behind one button: assemble the archive (transcribing any links), then read a
  // style from it. Split server-side so the app only ever profiles plain text.
  async function analyze() {
    if (!creator) return;

    const built = await call<{ pieces: Piece[]; notes: string[] }>(
      "/api/archive",
      { creatorId: creator.id, input },
      "Collecting your archive"
    );
    if (!built) return;

    setNotes(built.notes);
    setPieces(built.pieces);
    setInput("");

    const joined = built.pieces
      .map((p, i) => `--- piece ${i + 1} (${p.source}) ---\n${p.text}`)
      .join("\n\n");

    const data = await call<{
      styleReadId: string;
      niche: string | null;
      themes: string[];
      keywords: string[];
      archiveSize: number | null;
      thin: boolean;
      patterns: PatternRow[];
      choices: ChoiceRow[];
    }>("/api/profile", { creatorId: creator.id, archive: joined }, "Reading your style");

    if (data) {
      setStyleRead({
        id: data.styleReadId,
        niche: data.niche,
        themes: data.themes,
        keywords: data.keywords,
        archive_size: data.archiveSize,
        thin: data.thin,
      });
      setPatterns(data.patterns);
      setChoices(data.choices ?? []);
      setChosen(null);
      setOutline(null);
    }
  }

  // The decision is written before the UI changes, so a reload shows what the creator actually
  // decided rather than what the page happened to be showing.
  async function decide(pattern: PatternRow, status: PatternRow["status"]) {
    const data = await call<{ pattern: PatternRow }>(
      "/api/patterns",
      { id: pattern.id, status },
      "Saving your decision",
      "PATCH"
    );
    if (data) {
      setPatterns((prev) => prev.map((p) => (p.id === pattern.id ? data.pattern : p)));
    }
  }

  // Optional on both groups: untick a keyword that is not yours, tick a niche if the read was
  // off. Written before the UI changes, so a reload shows the decision rather than the default.
  async function toggleChoice(choice: ChoiceRow) {
    const data = await call<{ choice: ChoiceRow }>(
      "/api/choices",
      { id: choice.id, selected: !choice.selected },
      "Saving your choice",
      "PATCH"
    );
    if (data) setChoices((prev) => prev.map((c) => (c.id === choice.id ? data.choice : c)));
  }

  // A keyword the creator types is theirs by definition, so it comes back selected. The route
  // folds a case-insensitive duplicate into the existing row rather than adding a second.
  async function addKeyword() {
    const label = newKeyword.trim();
    if (!label || !styleRead) return;

    const data = await call<{ choice: ChoiceRow; alreadyThere: boolean }>(
      "/api/choices",
      { styleReadId: styleRead.id, label },
      "Adding your keyword"
    );
    if (!data) return;

    setChoices((prev) =>
      data.alreadyThere
        ? prev.map((c) => (c.id === data.choice.id ? data.choice : c))
        : [...prev, data.choice]
    );
    setNewKeyword("");
  }

  async function generate() {
    if (!creator) return;
    const data = await call<{ ideas: IdeaRow[] }>(
      "/api/ideas",
      {
        creatorId: creator.id,
        styleReadId: styleRead?.id,
        archive,
        patterns: keptPatterns,
        themes: styleRead?.themes,
        niche: chosenNiche,
        keywords: keptKeywords,
        topic: topic.trim() || undefined,
      },
      "Generating and gating ideas"
    );
    if (data) {
      setIdeas((prev) => [...data.ideas, ...prev]);
      setChosen(null);
      setOutline(null);
    }
  }

  async function expand(idea: IdeaRow) {
    setChosen(idea);
    setOutline(null);
    const data = await call<Outline>(
      "/api/outline",
      { ideaId: idea.id, patterns: keptPatterns, format },
      "Writing the outline"
    );
    if (data) setOutline(data);
  }

  // Captures the creator's verdict, which is both the hypothesis evidence and the record of what
  // they actually accepted.
  async function react(reaction: string) {
    if (!creator || !chosen) return;
    const note = reaction === "fix" ? prompt("What needed fixing?") ?? "" : "";
    const data = await call<{ reaction: ReactionRow }>(
      "/api/reactions",
      {
        creatorId: creator.id,
        ideaId: chosen.id,
        outlineId: outline?.outlineId,
        reaction,
        note,
      },
      "Recording your verdict"
    );
    if (data) setLog((prev) => [data.reaction, ...prev]);
  }

  async function patchIdea(idea: IdeaRow, patch: Record<string, unknown>, label: string) {
    const data = await call<{ idea: IdeaRow }>(`/api/ideas/${idea.id}`, patch, label, "PATCH");
    if (data) {
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? data.idea : i)));
    }
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

  if (hydrating) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-neutral-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Creator OS</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Ideas and outlines from your own archive, with every candidate checked against
                what you have already published.
              </p>
            </div>
            {creator && (
              <div className="text-right text-xs">
                <p className="text-neutral-300">{creator.name}</p>
                <button onClick={signOut} className="mt-1 block w-full text-right text-neutral-500 underline">
                  switch creator
                </button>
                <button
                  onClick={() => clearData("archive")}
                  disabled={!!busy || pieces.length === 0}
                  className="mt-0.5 block w-full text-right text-neutral-500 underline disabled:opacity-40"
                >
                  clear archive
                </button>
                <button
                  onClick={() => clearData("everything")}
                  disabled={!!busy}
                  className="mt-0.5 block w-full text-right text-rose-400/70 underline disabled:opacity-40"
                >
                  clear everything
                </button>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!creator ? (
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Who are you?
            </h2>
            <p className="mb-3 text-sm text-neutral-400">
              Your name is how your archive, idea bank and run log are found again. Type the same
              name next time to come back to them.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") signIn();
                }}
                placeholder="Your name"
                className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
              />
              <button
                onClick={signIn}
                disabled={!!busy || nameInput.trim().length < 2}
                className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
              >
                {busy || "Continue"}
              </button>
            </div>
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              There is no password. Anyone who opens this app and types your name reaches your
              archive and run log, so keep the link to yourself.
            </p>
          </section>
        ) : (
          <>
            {/* Step 1 */}
            <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
                Step 1 — Your archive
                {pieces.length > 0 && (
                  <span className="ml-2 font-normal text-neutral-400">
                    {pieces.length} piece(s) stored
                  </span>
                )}
              </h2>
              <p className="mb-3 text-sm text-neutral-400">
                Instagram reels, YouTube videos, TikTok and X links get transcribed, one per line.
                LinkedIn posts get read as text. Three pieces is enough to start; more is
                better. Anything already stored is reused rather than fetched again.
              </p>
              <p className="mb-3 text-xs text-neutral-500">
                A YouTube channel URL imports its 10 most recent videos. Each transcript is a
                billed Supadata request, so that is 10 of your 100 free ones in one click.
              </p>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={8}
                placeholder={`https://instagram.com/reel/...\nhttps://youtube.com/watch?v=...\n\nOr paste your written posts, separated by blank lines.`}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
              />
              <button
                onClick={analyze}
                disabled={!!busy || (input.trim().length < 10 && pieces.length === 0)}
                className="mt-3 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
              >
                {busy || (pieces.length ? "Add and re-read my style" : "Read my style")}
              </button>

              {notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-amber-400/90">
                  {notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}

              {/* What is actually stored, with the links visible. The character count and the
                  source are what tell you at a glance whether a piece is writing or a list of
                  URLs left over from before those were rejected. */}
              {pieces.length > 0 && (
                <div className="mt-4 border-t border-neutral-800 pt-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                    Your archive — {pieces.length} piece{pieces.length === 1 ? "" : "s"}
                  </p>
                  <ul className="space-y-1">
                    {pieces.map((p, i) => {
                      const linksOnly = URL_ONLY.test(p.text.trim());
                      return (
                        <li
                          key={i}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs"
                        >
                          <span className="w-16 shrink-0 text-neutral-500">{p.source}</span>
                          <span className="min-w-0 flex-1 break-all">
                            {p.url ? (
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-300 underline decoration-neutral-700"
                              >
                                {p.url}
                              </a>
                            ) : linksOnly ? (
                              <span className="text-neutral-500">{p.text.split(/\s+/)[0]}</span>
                            ) : (
                              <span className="text-neutral-400">
                                {p.text.slice(0, 70).replace(/\s+/g, " ")}
                                {p.text.length > 70 ? "…" : ""}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-neutral-500">
                            {p.text.length.toLocaleString()} chars
                          </span>
                          {linksOnly && (
                            <span
                              className="shrink-0 text-amber-400"
                              title="This piece is only links, so it teaches the style read nothing. Paste the post text, or add the link on its own line so it gets read."
                            >
                              ⚠ links only
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* Step 2 */}
            {styleRead && (
              <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
                <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
                  Step 2 — Confirm what I read
                </h2>
                <p className="mb-4 text-sm text-neutral-400">
                  {styleRead.archive_size} pieces read. Reject anything I got wrong — rejected
                  claims are excluded from everything below, and the decision is saved.
                  {styleRead.thin && (
                    <span className="mt-2 block text-amber-400">
                      This archive is thin. Treat the style read as provisional.
                    </span>
                  )}
                </p>

                <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                  {keywordChoices.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Which keywords are actually yours?
                      </p>
                      <p className="mb-2 text-xs text-neutral-500">
                        Optional — untick anything that is not you, or leave them as they are.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {keywordChoices.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => toggleChoice(c)}
                            disabled={!!busy}
                            className={`rounded border px-2 py-0.5 text-xs disabled:opacity-40 ${
                              c.selected
                                ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                                : "border-neutral-800 bg-neutral-950 text-neutral-600 line-through"
                            }`}
                          >
                            {c.label}
                            {c.rationale === "added by you" && (
                              <span className="ml-1 text-neutral-500">·you</span>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="mt-2 flex gap-1.5">
                        <input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addKeyword();
                          }}
                          placeholder="Add a keyword the model missed"
                          maxLength={60}
                          className="min-w-0 flex-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs outline-none focus:border-neutral-600"
                        />
                        <button
                          onClick={addKeyword}
                          disabled={!!busy || !newKeyword.trim()}
                          className="shrink-0 rounded border border-neutral-600 px-2 py-1 text-xs disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {nicheChoices.length > 0 ? (
                    <div className="mt-4 border-t border-neutral-800 pt-4">
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Which of these is your niche?
                      </p>
                      <p className="mb-2 text-xs text-neutral-500">
                        Optional — tick any that fit. Leave them all and I&apos;ll use what I
                        read: <span className="text-neutral-400">{styleRead.niche}</span>
                      </p>
                      <ul className="space-y-1.5">
                        {nicheChoices.map((c) => (
                          <li key={c.id}>
                            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 text-sm">
                              <input
                                type="checkbox"
                                checked={c.selected}
                                onChange={() => toggleChoice(c)}
                                disabled={!!busy}
                                className="mt-0.5 shrink-0"
                              />
                              <span>
                                {c.label}
                                {c.rationale && (
                                  <span className="mt-0.5 block text-xs text-neutral-500">
                                    {c.rationale}
                                  </span>
                                )}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    styleRead.niche && (
                      <div className={keywordChoices.length ? "mt-4 border-t border-neutral-800 pt-4" : ""}>
                        <p className="text-xs uppercase tracking-wide text-neutral-500">Niche</p>
                        <p className="mt-1 text-sm">{styleRead.niche}</p>
                      </div>
                    )
                  )}
                </div>

                <ul className="space-y-2">
                  {patterns.map((p) => {
                    const rejected = p.status === "rejected";
                    return (
                      <li
                        key={p.id}
                        className={`rounded-lg border p-3 text-sm ${
                          rejected
                            ? "border-neutral-800 bg-neutral-950 opacity-40"
                            : "border-neutral-700 bg-neutral-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={rejected ? "line-through" : ""}>{p.claim}</p>
                            <p className="mt-1 text-xs text-neutral-500">Evidence: {p.evidence}</p>
                          </div>
                          <button
                            onClick={() => decide(p, rejected ? "confirmed" : "rejected")}
                            disabled={!!busy}
                            className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 disabled:opacity-40"
                          >
                            {rejected ? "Restore" : "Not me"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
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

                  {/* A greyed-out button with no reason sends people hunting through the code.
                      Rejecting every claim is a legitimate thing to do — usually it means the
                      archive was not really your writing — so say that, and say what to do. */}
                  {keptPatterns.length === 0 && (
                    <p className="text-xs text-amber-400">
                      Every style claim above is rejected, so there is nothing left describing
                      your voice to write against. Restore at least one, or go back to step 1 and
                      add pieces of your actual writing — if the claims were all wrong, the
                      archive probably held links rather than text.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Step 3 — the bank */}
            {ideas.length > 0 && (
              <section className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
                <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
                  Step 3 — Idea bank, checked against your archive
                </h2>
                <p className="mb-4 text-sm text-neutral-400">
                  Repeats are shown rather than hidden, so you can see the check working. This
                  bank persists — add to it through the week.
                </p>
                <ul className="space-y-3">
                  {ideas.map((idea) => (
                    <li key={idea.id} className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${
                            VERDICT_STYLE[idea.verdict]
                          }`}
                        >
                          {VERDICT_LABEL[idea.verdict]}
                        </span>
                        {idea.mechanism && (
                          <span className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-500">
                            {idea.mechanism}
                          </span>
                        )}
                        {idea.needs_verification && (
                          <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                            verify before recording
                          </span>
                        )}
                        {idea.would_shoot === true && (
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                            would shoot
                          </span>
                        )}
                        {idea.would_shoot === false && (
                          <span className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-500">
                            passed
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{idea.idea}</p>
                      {idea.why && <p className="mt-1 text-xs text-neutral-400">{idea.why}</p>}
                      {idea.gate_note && (
                        <p className="mt-2 rounded bg-neutral-950 p-2 text-xs text-neutral-400">
                          <span className="text-neutral-500">Archive check: </span>
                          {idea.gate_note}
                        </p>
                      )}
                      {idea.needs_verification && idea.verify_what && (
                        <p className="mt-2 text-xs text-sky-300/80">Check: {idea.verify_what}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {idea.verdict !== "repeat" && (
                          <button
                            onClick={() => expand(idea)}
                            disabled={!!busy}
                            className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs disabled:opacity-40"
                          >
                            {busy === "Writing the outline" && chosen?.id === idea.id
                              ? "Writing..."
                              : "Outline this"}
                          </button>
                        )}
                        {idea.verdict !== "repeat" && idea.would_shoot === null && (
                          <>
                            <button
                              onClick={() => patchIdea(idea, { wouldShoot: true }, "Saving")}
                              disabled={!!busy}
                              className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs disabled:opacity-40"
                            >
                              I&apos;d shoot this
                            </button>
                            <button
                              onClick={() => patchIdea(idea, { wouldShoot: false }, "Saving")}
                              disabled={!!busy}
                              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 disabled:opacity-40"
                            >
                              Pass
                            </button>
                          </>
                        )}
                      </div>
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
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Point {i + 1}
                      </p>
                      <p className="mt-1">{p.point}</p>
                      <ul className="mt-1 list-disc pl-5 text-neutral-400">
                        {p.bullets?.map((b, j) => (
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
                    <p>Style basis: {outline.styleBasis?.join("; ")}</p>
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
                      disabled={!!busy}
                      className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs capitalize disabled:opacity-40"
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
                  {log.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex gap-2 border-b border-neutral-800 pb-2 text-neutral-400"
                    >
                      <span className="shrink-0 font-medium capitalize text-neutral-200">
                        {entry.reaction}
                      </span>
                      <span className="flex-1">{entry.ideas?.idea}</span>
                      {entry.note && <span className="text-neutral-500">({entry.note})</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
