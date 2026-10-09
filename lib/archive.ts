import { Supadata } from "@supadata/js";

export type Piece = { source: string; url?: string; text: string };
export type ArchiveResult = { pieces: Piece[]; notes: string[]; spent: number };

// A single reel or post carries a code after the segment; a profile or its reels tab does not.
// That distinction matters because only the former has anything to transcribe.
const INSTAGRAM_MEDIA =
  /^https?:\/\/(www\.)?instagram\.com\/(?:[^/]+\/)?(reel|reels|p|tv)\/[A-Za-z0-9_-]+/i;
const INSTAGRAM_ANY = /^https?:\/\/(www\.)?instagram\.com\/\S+/i;

// Same split for YouTube: a watch/shorts/youtu.be link is one video, while @handle, /channel/,
// /c/ and /user/ address a whole channel and have to be expanded before anything can be fetched.
const YOUTUBE_VIDEO =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/|live\/)|youtu\.be\/)\S+/i;
const YOUTUBE_CHANNEL =
  /^https?:\/\/(www\.)?youtube\.com\/(@[\w.-]+|channel\/[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i;
const YOUTUBE_ANY = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+/i;

const TIKTOK = /^https?:\/\/(www\.)?tiktok\.com\/\S+/i;
const TWITTER = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\S+/i;

// lnkd.in is LinkedIn's own shortener and is what you get when you copy a link from LinkedIn,
// so omitting it meant the most common form of LinkedIn link missed this branch entirely and
// was stored as though the URL itself were the creator's writing.
// Regional subdomains (in.linkedin.com, uk.linkedin.com) are real and appear in shared links.
const LINKEDIN_POST =
  /^https?:\/\/([a-z]{2}\.)?(www\.)?(linkedin\.com\/(posts|feed\/update|pulse)\/|lnkd\.in\/)\S+/i;
const LINKEDIN_PROFILE =
  /^https?:\/\/([a-z]{2}\.)?(www\.)?linkedin\.com\/(in|company|school)\/\S+/i;
const LINKEDIN_ANY = /^https?:\/\/([a-z]{2}\.)?(www\.)?(linkedin\.com|lnkd\.in)\/\S+/i;

const ALL_PLATFORMS = [INSTAGRAM_ANY, YOUTUBE_ANY, TIKTOK, TWITTER, LINKEDIN_ANY];

// A line that is nothing but a URL is never a piece of writing. Without this, any link whose
// domain this file does not recognise falls through to the free-text branch and gets stored as
// archive content — which is how an archive of four link lists produced a confident style read
// about URL formatting.
const URL_ONLY = /^(\s*https?:\/\/\S+\s*)+$/i;

// A channel can hold hundreds of videos and every transcript is a billed request, so an
// unbounded expansion could empty a 100-request free tier on one click.
const CHANNEL_VIDEO_CAP = 10;

// Route handlers are capped at 60s on Vercel Hobby, so polling a transcript job gets a budget
// well inside that and reports a timeout as a note rather than failing the whole batch.
const JOB_BUDGET_MS = 35_000;
const JOB_POLL_MS = 2_000;

// Supadata's free tier serves about one request at a time, so links are fetched sequentially
// with a breath between them, and a refusal gets one wait-and-retry before being believed.
const BETWEEN_FETCHES_MS = 1_200;
const RATE_LIMIT_WAIT_MS = 4_000;

function client() {
  return new Supadata({
    apiKey: process.env.SUPADATA_API_KEY ?? "",
    // The env var is set, and the SDK takes it; not passing it silently ignored the override.
    ...(process.env.SUPADATA_BASE_URL ? { baseUrl: process.env.SUPADATA_BASE_URL } : {}),
  });
}

// The placeholder in .env.local is a string, so a bare presence check would pass it through and
// surface an unhelpful Unauthorized from the API instead of saying what is wrong.
export function hasSupadataKey() {
  const key = process.env.SUPADATA_API_KEY;
  return !!key && !key.startsWith("paste-");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Supadata reports a spent quota as the bare string "Limit Exceeded", which reads like a bug in
// this app rather than an account that needs topping up. The same for an expired key.
function isRateLimited(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return /limit.?exceeded/i.test(raw);
}

function readableReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "fetch failed");

  if (/limit.?exceeded/i.test(raw)) {
    // Supadata says only "Limit Exceeded" for both a spent allowance and too many requests at
    // once, so naming one would be a guess. Both are worth acting on differently.
    return "Supadata refused this as over its limit — either the free tier's 100 requests are spent, or too many went at once. Check usage at supadata.ai and try again in a minute. Pasting the text always works and costs nothing.";
  }
  if (/unauthor|invalid.?key|forbidden/i.test(raw)) {
    return "Supadata rejected the API key. Check SUPADATA_API_KEY in .env.local, then restart the dev server.";
  }
  if (/upgrade.?required/i.test(raw)) {
    return "This needs a paid Supadata plan.";
  }
  return raw;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  // text: true asks for a plain string, but chunked transcripts are still a documented shape.
  if (Array.isArray(content)) {
    return content
      .map((chunk) => (chunk && typeof chunk === "object" && "text" in chunk ? String(chunk.text) : ""))
      .join(" ");
  }
  return "";
}

type Fetched = { piece?: Piece; note?: string; rateLimited?: boolean };

// A video too large to transcribe inline returns a job id instead of content. The previous
// version tested for "content" and fell back to an empty string, so every long video was
// reported as "no speech found" — the words were there, the app just stopped asking.
async function transcribeOne(
  supadata: ReturnType<typeof client>,
  url: string,
  source: string
): Promise<Fetched> {
  try {
    const res = await supadata.transcript({ url, text: true, mode: "auto" });

    let content: unknown = res && typeof res === "object" && "content" in res ? res.content : undefined;

    if (res && typeof res === "object" && "jobId" in res) {
      const deadline = Date.now() + JOB_BUDGET_MS;
      let status = "queued";

      while (Date.now() < deadline) {
        await sleep(JOB_POLL_MS);
        const job = await supadata.transcript.getJobStatus(res.jobId);
        status = job.status;

        if (status === "completed") {
          content = job.result?.content;
          break;
        }
        if (status === "failed") {
          return { note: `Could not transcribe ${url}: ${job.error?.message ?? "the job failed"}` };
        }
      }

      if (status !== "completed") {
        return {
          note: `${url} is still transcribing after ${JOB_BUDGET_MS / 1000}s. It is a long video — run this again in a minute and the finished transcript will be picked up.`,
        };
      }
    }

    const text = textOf(content);
    if (!text.trim()) return { note: `Could not transcribe ${url}: no speech found` };

    return { piece: { source, url, text } };
  } catch (error) {
    const reason = readableReason(error);
    return { note: `Could not transcribe ${url}: ${reason}`, rateLimited: isRateLimited(error) };
  }
}

// Markdown links carry tracking query strings that would dominate the archive and teach the
// style read nothing. The visible text is the part the creator wrote.
function stripMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`+/g, "")
    // A link that followed a full stop with no space ("person.[Alexandr Wang](...)") closes up
    // into "person.Alexandr" once the syntax goes. Requiring lowercase before the stop keeps
    // initialisms like U.S intact.
    .replace(/([a-z])\.([A-Z])/g, "$1. $2")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// A scraped LinkedIn post page is about 35,000 characters, of which roughly 2,500 are the post.
// The rest is a cookie banner, a share row, and — past the "More Relevant Posts" heading —
// other people's posts, which must never enter this creator's archive.
export function extractLinkedInPost(markdown: string): string {
  // Everything from here on is furniture and then strangers' writing.
  const boundary = markdown.search(/To view or add a comment|##\s*More Relevant Posts/i);
  const head = boundary > 0 ? markdown.slice(0, boundary) : markdown;

  // The body is the longest line by a wide margin: the cookie banner tops out near 380
  // characters and the share row near 470, against a couple of thousand for real writing.
  // Taking the longest line also discards the H1, which LinkedIn generates with its own AI
  // ("This title was summarized by AI from the post below") and which is therefore not the
  // creator's voice at all.
  const body = head
    .split("\n")
    .map((l) => l.trim())
    .reduce((best, l) => (l.length > best.length ? l : best), "");

  return stripMarkdown(body);
}

// LinkedIn has no public read API, but a post is already text, so scraping the page and pulling
// the post out of it loses nothing that transcription would have recovered.
async function scrapeOne(
  supadata: ReturnType<typeof client>,
  url: string,
  source: string
): Promise<Fetched> {
  try {
    const res = await supadata.web.scrape(url);
    const text = extractLinkedInPost(res.content ?? "");

    // A login wall scrapes successfully and returns a few thousand characters of sign-up prose,
    // so a short result means the post was not actually readable rather than that it was empty.
    if (text.length < 120) {
      return {
        note: `Could not read the post at ${url}. LinkedIn hides most posts from anyone not signed in — paste the post text instead, which works and loses nothing.`,
      };
    }
    return { piece: { source, url, text } };
  } catch (error) {
    const reason = readableReason(error);
    return { note: `Could not read ${url}: ${reason}`, rateLimited: isRateLimited(error) };
  }
}

// Turns a channel URL into individual video URLs, which is the only form the transcript endpoint
// accepts. Capped, and the cap is reported so the creator knows the archive is partial.
async function expandChannels(
  supadata: ReturnType<typeof client>,
  urls: string[]
): Promise<{ videoUrls: string[]; notes: string[]; spent: number }> {
  const videoUrls: string[] = [];
  const notes: string[] = [];
  let spent = 0;

  for (const url of urls) {
    try {
      const handle = url.replace(/^https?:\/\/(www\.)?youtube\.com\//i, "").split(/[/?#]/)[0];
      spent += 1;
      const ids = await supadata.youtube.channel.videos({
        id: handle,
        limit: CHANNEL_VIDEO_CAP,
        type: "video",
      });

      const found = [...(ids.videoIds ?? []), ...(ids.shortIds ?? [])].slice(0, CHANNEL_VIDEO_CAP);
      if (!found.length) {
        notes.push(`No videos found on ${url}.`);
        continue;
      }

      videoUrls.push(...found.map((id) => `https://www.youtube.com/watch?v=${id}`));
      notes.push(
        `${url}: taking the ${found.length} most recent video(s). Capped at ${CHANNEL_VIDEO_CAP} per run because each transcript is a billed request.`
      );
    } catch (error) {
      const reason = readableReason(error);
      notes.push(`Could not list videos for ${url}: ${reason}`);
    }
  }

  return { videoUrls, notes, spent };
}

// Takes whatever was pasted and turns it into labelled pieces, routing each line by platform
// because what counts as "the archive" differs: video needs transcribing, text does not.
// skipUrls holds anything already stored for this creator, so a re-run costs nothing.
export async function buildArchive(
  input: string,
  skipUrls: Set<string> = new Set()
): Promise<ArchiveResult> {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const instagramUrls = lines.filter((l) => INSTAGRAM_MEDIA.test(l));
  const instagramProfiles = lines.filter((l) => INSTAGRAM_ANY.test(l) && !INSTAGRAM_MEDIA.test(l));
  const youtubeVideos = lines.filter((l) => YOUTUBE_VIDEO.test(l));
  const youtubeChannels = lines.filter((l) => YOUTUBE_CHANNEL.test(l));
  const youtubeOther = lines.filter(
    (l) => YOUTUBE_ANY.test(l) && !YOUTUBE_VIDEO.test(l) && !YOUTUBE_CHANNEL.test(l)
  );
  const tiktokUrls = lines.filter((l) => TIKTOK.test(l));
  const twitterUrls = lines.filter((l) => TWITTER.test(l));
  const linkedinPosts = lines.filter((l) => LINKEDIN_POST.test(l));
  const linkedinProfiles = lines.filter((l) => LINKEDIN_PROFILE.test(l));
  const linkedinOther = lines.filter(
    (l) => LINKEDIN_ANY.test(l) && !LINKEDIN_POST.test(l) && !LINKEDIN_PROFILE.test(l)
  );

  // Everything that is not a link is treated as already-written content. Blank lines separate
  // one piece from the next, which is how people naturally paste a batch of posts.
  const prose = input
    .split("\n")
    .filter((l) => !ALL_PLATFORMS.some((re) => re.test(l.trim())))
    .join("\n");

  // A blank line ends a piece, which is how people naturally paste a batch of posts — but it
  // also splits a single post that has paragraphs in it. A line of five or more spaces is an
  // explicit separator: when one is present it becomes the only separator, so paragraphs inside
  // a piece survive. Absent, nothing changes for anyone who has pasted before.
  const explicit = /\n[ \t]{5,}\r?\n/;
  const separator = explicit.test(prose) ? /\n[ \t]{5,}\r?\n/ : /\n\s*\n/;

  const freeText = prose
    .split(separator)
    .map((block) => block.trim())
    // 15 rather than 40: a real piece can be one short line, and a longer floor silently
    // discarded them, so the app then complained about input the creator had in fact given.
    .filter((block) => block.length > 15)
    // A block of bare URLs is not writing, whatever domain it points at.
    .filter((block) => !URL_ONLY.test(block));

  const notes: string[] = [];
  const pieces: Piece[] = freeText.map((text) => ({ source: "pasted", text }));
  let spent = 0;

  const needsApi =
    instagramUrls.length ||
    youtubeVideos.length ||
    youtubeChannels.length ||
    tiktokUrls.length ||
    twitterUrls.length ||
    linkedinPosts.length;

  if (needsApi && !hasSupadataKey()) {
    notes.push(
      "Links skipped: SUPADATA_API_KEY is not set in .env.local. Get a free key at supadata.ai, then restart the dev server."
    );
  } else if (needsApi) {
    const supadata = client();

    const expanded = await expandChannels(supadata, youtubeChannels);
    notes.push(...expanded.notes);
    spent += expanded.spent;

    // One job per URL, failures captured individually so one bad link does not lose the batch.
    const transcribable: { url: string; source: string }[] = [
      ...instagramUrls.map((url) => ({ url, source: "instagram" })),
      ...youtubeVideos.map((url) => ({ url, source: "youtube" })),
      ...expanded.videoUrls.map((url) => ({ url, source: "youtube" })),
      ...tiktokUrls.map((url) => ({ url, source: "other" })),
      ...twitterUrls.map((url) => ({ url, source: "other" })),
    ];

    const scrapable = linkedinPosts.map((url) => ({ url, source: "linkedin" }));

    const alreadyHave = [...transcribable, ...scrapable].filter((t) => skipUrls.has(t.url));
    if (alreadyHave.length) {
      notes.push(
        `${alreadyHave.length} link(s) already in your archive — reusing the stored copy instead of fetching again.`
      );
    }

    const toTranscribe = transcribable.filter((t) => !skipUrls.has(t.url));
    const toScrape = scrapable.filter((t) => !skipUrls.has(t.url));
    spent += toTranscribe.length + toScrape.length;

    // One at a time, not Promise.all. Supadata's free tier serves roughly one request at a
    // time: three links pasted together had two refused as "Limit Exceeded" while one
    // succeeded, which reads like a spent allowance and was entirely self-inflicted. The same
    // links fetched one after another all succeed. A few seconds per link is the cost, and the
    // stored-piece cache means a re-run pays nothing.
    const jobs = [
      ...toTranscribe.map((t) => ({ ...t, run: () => transcribeOne(supadata, t.url, t.source) })),
      ...toScrape.map((t) => ({ ...t, run: () => scrapeOne(supadata, t.url, t.source) })),
    ];

    let refusedAfterRetry = 0;

    for (const [i, job] of jobs.entries()) {
      // A small gap between calls, skipped before the first one.
      if (i > 0) await sleep(BETWEEN_FETCHES_MS);

      let result = await job.run();

      // Only a rate limit is worth retrying; a missing page or a bad key will fail again.
      if (result.rateLimited) {
        await sleep(RATE_LIMIT_WAIT_MS);
        result = await job.run();
        if (result.rateLimited) refusedAfterRetry += 1;
      }

      if (result.piece) pieces.push(result.piece);
      if (result.note) notes.push(result.note);
    }

    if (refusedAfterRetry) {
      notes.push(
        `${refusedAfterRetry} link(s) were still refused after waiting. Requests are already sent one at a time, so this is the allowance rather than the pace — check your usage at supadata.ai, or paste the text for those.`
      );
    }
  }

  if (instagramProfiles.length) {
    notes.push(
      `That looks like an Instagram profile, not a reel. Instagram has no API for listing someone's posts, so paste individual reel links instead — open a reel, copy its link, one per line. They look like instagram.com/reel/ABC123.`
    );
  }

  if (linkedinProfiles.length) {
    notes.push(
      `That looks like a LinkedIn profile, not a post. LinkedIn serves a sign-up wall for profiles to anyone not logged in, so there is nothing there to read. Open an individual post, copy its link, one per line — or paste the post text, which always works.`
    );
  }

  if (linkedinOther.length) {
    notes.push(
      `${linkedinOther.length} LinkedIn link(s) were not a post and were skipped. Use a post link (linkedin.com/posts/..., /pulse/..., or an lnkd.in short link).`
    );
  }

  if (youtubeOther.length) {
    notes.push(
      `${youtubeOther.length} YouTube link(s) were not a video or a channel and were skipped. Paste a watch, shorts or youtu.be link, or a channel URL.`
    );
  }

  return { pieces, notes, spent };
}
