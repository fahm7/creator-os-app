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
const LINKEDIN = /^https?:\/\/(www\.)?linkedin\.com\/\S+/i;

const ALL_PLATFORMS = [INSTAGRAM_ANY, YOUTUBE_ANY, TIKTOK, TWITTER, LINKEDIN];

// A channel can hold hundreds of videos and every transcript is a billed request, so an
// unbounded expansion could empty a 100-request free tier on one click.
const CHANNEL_VIDEO_CAP = 10;

// Route handlers are capped at 60s on Vercel Hobby, so polling a transcript job gets a budget
// well inside that and reports a timeout as a note rather than failing the whole batch.
const JOB_BUDGET_MS = 35_000;
const JOB_POLL_MS = 2_000;

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

type Fetched = { piece?: Piece; note?: string };

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
    const reason = error instanceof Error ? error.message : "fetch failed";
    return { note: `Could not transcribe ${url}: ${reason}` };
  }
}

// LinkedIn has no public read API, but a post is already text, so scraping the page to Markdown
// loses nothing that transcription would have recovered.
async function scrapeOne(
  supadata: ReturnType<typeof client>,
  url: string,
  source: string
): Promise<Fetched> {
  try {
    const res = await supadata.web.scrape(url);
    const text = (res.content ?? "").trim();
    if (text.length < 40) {
      return {
        note: `Nothing readable at ${url}. LinkedIn hides some posts from anyone not signed in — paste the text instead.`,
      };
    }
    return { piece: { source, url, text } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fetch failed";
    return { note: `Could not read ${url}: ${reason}` };
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
      const reason = error instanceof Error ? error.message : "lookup failed";
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
  const linkedinUrls = lines.filter((l) => LINKEDIN.test(l));

  // Everything that is not a link is treated as already-written content. Blank lines separate
  // one piece from the next, which is how people naturally paste a batch of posts.
  const freeText = input
    .split("\n")
    .filter((l) => !ALL_PLATFORMS.some((re) => re.test(l.trim())))
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 40);

  const notes: string[] = [];
  const pieces: Piece[] = freeText.map((text) => ({ source: "pasted", text }));
  let spent = 0;

  const needsApi =
    instagramUrls.length ||
    youtubeVideos.length ||
    youtubeChannels.length ||
    tiktokUrls.length ||
    twitterUrls.length ||
    linkedinUrls.length;

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

    const scrapable = linkedinUrls.map((url) => ({ url, source: "linkedin" }));

    const alreadyHave = [...transcribable, ...scrapable].filter((t) => skipUrls.has(t.url));
    if (alreadyHave.length) {
      notes.push(
        `${alreadyHave.length} link(s) already in your archive — reusing the stored copy instead of fetching again.`
      );
    }

    const toTranscribe = transcribable.filter((t) => !skipUrls.has(t.url));
    const toScrape = scrapable.filter((t) => !skipUrls.has(t.url));
    spent += toTranscribe.length + toScrape.length;

    const results = await Promise.all([
      ...toTranscribe.map((t) => transcribeOne(supadata, t.url, t.source)),
      ...toScrape.map((t) => scrapeOne(supadata, t.url, t.source)),
    ]);

    for (const r of results) {
      if (r.piece) pieces.push(r.piece);
      if (r.note) notes.push(r.note);
    }
  }

  if (instagramProfiles.length) {
    notes.push(
      `That looks like an Instagram profile, not a reel. Instagram has no API for listing someone's posts, so paste individual reel links instead — open a reel, copy its link, one per line. They look like instagram.com/reel/ABC123.`
    );
  }

  if (youtubeOther.length) {
    notes.push(
      `${youtubeOther.length} YouTube link(s) were not a video or a channel and were skipped. Paste a watch, shorts or youtu.be link, or a channel URL.`
    );
  }

  return { pieces, notes, spent };
}
