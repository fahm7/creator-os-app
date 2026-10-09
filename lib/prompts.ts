// Craft knowledge encoded from three practitioner sources, applied to every draft so the app
// enforces real structure rather than a vague "sound like me" instruction.
const CRAFT = `
Script craft rules (these are not suggestions, they are the standard a draft must meet):

- A hook is a promise, not a gimmick. For educational content the hook can simply state what the
  viewer gets. Do not manufacture false urgency.
- Three points maximum per piece. If there are four, one of them belongs in a different piece.
- Every point must link to the next: either raise a question the next point answers, or state
  something the next point contradicts. Abrupt transitions lose the viewer.
- Depth follows relevance, not completeness. Going deeper is only correct while it stays
  surprising. Stop descending when you reach something nobody asked about.
- Structure: hook (the promise), optional intro (who you are and why you can speak to this),
  value (the three points), close (point at the next thing, never "like and subscribe").
- Guide, not guru. "Here is what I learned" beats "here is what you should do." Having struggled
  with the thing is a sufficient credential.
`;

// Turns a creator's raw archive into style claims that each cite specific pieces, because an
// uncited style claim cannot be confirmed or rejected by the creator.
export function profilePrompt(archive: string) {
  return `You are analysing a content creator's own published archive to extract their style.

ARCHIVE:
${archive}

Extract style patterns that are CITABLE, not impressions. "Casual tone" is not a pattern.
"Opens 4 of the last 6 pieces with a direct question" is a pattern.

For each pattern, cite the specific piece(s) it came from, quoting a short fragment so the creator
can verify you read it correctly.

Also extract:
- NICHE: the domain they operate in, one line. Be specific ("NLP and practical mental health for a
  general audience", not "self-improvement").
- THEMES: the recurring subjects they return to. Name the underlying subject, not the piece. These
  drive idea generation later.
- KEYWORDS: terms and phrases they actually reuse. Include signature phrasings, not just topic
  words. Give AT LEAST 3 even from a small archive — if the archive is thin, widen to the words
  that carry their meaning rather than returning one. These matter twice: they are part of the
  voice, and a reused signature phrase is a different thing from a reused idea.
  Every keyword must carry meaning on its own — a subject the creator talks about ("anxiety",
  "self-worth") or an image they reach for ("smoke alarm", "soil not trophy"). Never return bare
  function words or sentence connectives ("is a", "not a", "never a"); a template they reuse is a
  style pattern, which belongs in patterns, not a keyword. If you would not recognise the creator
  from the word, it is not a keyword.
- NICHE OPTIONS: 5 to 7 candidate niches the creator picks from, ordered narrow to broad. Each
  must be a genuinely different reading of what they do, not seven rewordings of one — vary the
  audience, the subject and the angle. Name the keywords or themes that produced each one, so
  the creator can see why it was offered.

Return ONLY valid JSON, no prose before or after:
{
  "niche": "one line — your single best guess, used when the creator picks nothing",
  "nicheOptions": [
    { "label": "the candidate niche, one line", "rationale": "the keywords or themes behind it" }
  ],
  "patterns": [
    { "claim": "the pattern, stated specifically", "evidence": "short quoted fragment or piece reference" }
  ],
  "themes": ["theme 1", "theme 2"],
  "keywords": ["term or phrase they reuse — at least 3"],
  "archiveSize": <number of distinct pieces you could identify>,
  "thin": <true if fewer than 10 distinct pieces, else false>
}`;
}

// Generates candidate ideas from the creator's own themes and gates each one against the archive,
// because the whole premise is that an idea they have already covered is worse than no idea.
// An options object rather than six positional arguments: four of them are strings or string
// arrays, so a transposed pair would type-check and silently produce the wrong prompt.
export function ideasPrompt(opts: {
  archive: string;
  patterns: string[];
  themes: string[];
  niche: string;
  keywords: string[];
  topic?: string;
}) {
  const { archive, patterns, themes, niche, keywords, topic } = opts;

  const ask = topic
    ? `The creator has brought their own topic: "${topic}". Build candidate angles on THAT topic.`
    : `The creator has arrived with nothing. Generate candidates from their own themes below.`;

  return `You are generating content ideas for a creator, then checking each one against their own
published archive before it reaches them.

${ask}

THEIR CONFIRMED STYLE PATTERNS (the creator has verified these, treat as ground truth):
${patterns.map((p) => `- ${p}`).join("\n")}

THEIR NICHE (the creator confirmed this, or accepted the read):
${niche}

THE KEYWORDS THEY KEPT (their words, use them; a dropped keyword was not theirs):
${keywords.map((k) => `- ${k}`).join("\n")}

THEIR RECURRING THEMES:
${themes.map((t) => `- ${t}`).join("\n")}

THEIR FULL ARCHIVE (check every candidate against this):
${archive}

Generate candidates using these three multipliers, and say which one produced each idea:
1. KIPLING — run who/what/when/where/why/how against a theme. Weight by what the theme actually
   demands; not all six matter every time.
2. REFRAME — the same substance entered through a different door (self-worth -> confidence ->
   not caring what others think). The subject is unchanged; the framing is new.
3. VERTICAL — take one angle and keep asking why until you reach a root cause that is still
   relevant to the audience.

Then GATE each candidate against the archive. Assign exactly one verdict:
- "new" — they have not covered this subject
- "reframe" — they HAVE covered this subject, but this is a genuinely different framing. State what
  the earlier piece did and how this differs. This is a legitimate idea, not a rejection.
- "repeat" — same subject AND same framing as something they already published. Cite the piece.

Produce 8 candidates. Do not drop the repeats; include them marked as repeats, because the creator
needs to see that the check is working.

Flag any claim that needs verification before they record it. Flag HARD (needsVerification true)
for anything touching health, medicine, mental health, finance, law, or research findings.

Return ONLY valid JSON, no prose:
{
  "ideas": [
    {
      "idea": "the idea, one sentence",
      "mechanism": "kipling" | "reframe" | "vertical",
      "verdict": "new" | "reframe" | "repeat",
      "gateNote": "for reframe/repeat: which prior piece, and how this differs or does not",
      "why": "one line on why this is worth their time",
      "needsVerification": true | false,
      "verifyWhat": "what specifically they must check, or empty string"
    }
  ]
}`;
}

// Expands an approved idea into an outline rather than a full script, because practitioners who
// ship at volume prep three bullets, not finished prose.
export function outlinePrompt(
  idea: string,
  patterns: string[],
  format: string
) {
  return `Write an OUTLINE (not a finished script) for this approved idea.

IDEA: ${idea}
FORMAT: ${format}

THE CREATOR'S CONFIRMED STYLE PATTERNS (match these; they are verified, not guessed):
${patterns.map((p) => `- ${p}`).join("\n")}

${CRAFT}

The outline is what they take into the room: a hook, three points with a bullet or two each, and a
close. Not prose. They will perform it in their own words.

Leave one slot explicitly empty: where their own lived experience or a client example belongs. You
do not have access to their experience and must not invent it. Name what kind of example would fit
and let them fill it.

Return ONLY valid JSON, no prose:
{
  "hook": "the promise, one line",
  "points": [
    { "point": "the point", "bullets": ["supporting bullet", "supporting bullet"] }
  ],
  "close": "what to point the viewer at next",
  "experienceSlot": "the kind of personal example that belongs here, and roughly where",
  "styleBasis": ["which confirmed pattern this draws on"],
  "needsVerification": ["any claim they must check before recording"]
}`;
}
