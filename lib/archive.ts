import { Supadata } from "@supadata/js";

export type Piece = { source: string; url?: string; text: string };
export type ArchiveResult = { pieces: Piece[]; notes: string[] };

const INSTAGRAM = /^https?:\/\/(www\.)?instagram\.com\/\S+/i;
const YOUTUBE = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+/i;
const LINKEDIN = /^https?:\/\/(www\.)?linkedin\.com\/\S+/i;

// Instagram reels are video, so their words only exist as audio and have to be transcribed.
// One call per URL, failures captured individually so one bad link does not lose the batch.
async function transcribeInstagram(urls: string[]): Promise<ArchiveResult> {
  const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY ?? "" });

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await supadata.transcript({ url, text: true, mode: "auto" });
        const text = typeof res === "object" && "content" in res ? String(res.content) : "";
        if (!text.trim()) return { failed: url, reason: "no speech found" };
        return { piece: { source: "instagram", url, text } as Piece };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "fetch failed";
        return { failed: url, reason };
      }
    })
  );

  const pieces = results.flatMap((r) => ("piece" in r && r.piece ? [r.piece] : []));
  const notes = results.flatMap((r) =>
    "failed" in r && r.failed ? [`Could not transcribe ${r.failed}: ${r.reason}`] : []
  );

  return { pieces, notes };
}

// Takes whatever was pasted and turns it into labelled pieces, routing each line by platform
// because what counts as "the archive" differs: video needs transcribing, text does not.
export async function buildArchive(input: string): Promise<ArchiveResult> {
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const instagramUrls = lines.filter((l) => INSTAGRAM.test(l));
  const youtubeUrls = lines.filter((l) => YOUTUBE.test(l));
  const linkedinUrls = lines.filter((l) => LINKEDIN.test(l));

  // Everything that is not a link is treated as already-written content. Blank lines separate
  // one piece from the next, which is how people naturally paste a batch of posts.
  const freeText = input
    .split("\n")
    .filter((l) => ![INSTAGRAM, YOUTUBE, LINKEDIN].some((re) => re.test(l.trim())))
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 40);

  const notes: string[] = [];
  const pieces: Piece[] = freeText.map((text) => ({ source: "pasted", text }));

  if (instagramUrls.length) {
    if (!process.env.SUPADATA_API_KEY) {
      notes.push(
        `${instagramUrls.length} Instagram link(s) skipped: no SUPADATA_API_KEY configured.`
      );
    } else {
      const result = await transcribeInstagram(instagramUrls);
      pieces.push(...result.pieces);
      notes.push(...result.notes);
    }
  }

  if (youtubeUrls.length) {
    notes.push(
      `${youtubeUrls.length} YouTube link(s) recognised but not fetched yet — channel import is not wired up. Paste the text for now.`
    );
  }

  if (linkedinUrls.length) {
    notes.push(
      `${linkedinUrls.length} LinkedIn link(s) recognised. LinkedIn has no public read API, so paste the post text directly — it is already text, so nothing is lost.`
    );
  }

  return { pieces, notes };
}
