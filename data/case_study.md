# Creator OS — Case Study

## The problem, in one line

A creator who batch-records eight videos at a time runs out of on-voice ideas before shoot day,
so three to four get invented on camera and some shoots get cancelled with the crew already paid.

## Who has it

Hariharan Sampathkumar makes Tamil reels on NLP and mental health, three a week, recorded in
batches of eight. A contracted cameraman and editor come to his home on a fixed date and are paid
whether or not the work gets done.

What he actually does, not what he predicts:
- Three to four of the eight ideas per batch are invented on the spot, on shoot day
- He cancels a shoot outright one to two times a month when nothing usable is ready
- His crew push him to post more, pressure that was not solicited and did not come from me

A second creator, Ram (curioussglobe, English current-affairs video, seven a week, no crew),
independently named ideation and scriptwriting rather than editing as his biggest time cost, and
volunteered unprompted that AI suggestions must be personal rather than generic, and that he would
still review everything himself. He arrived at the same constraint from a different format.

**Excluded from the evidence base:** his own estimate of two to three hours a week saved. He gave
it after hearing the idea described, so it is a prediction, not a measurement.

## What I found that changed the design

I was building a style-matching script writer. Three findings moved it.

**1. Style matching is already solved, and by my own course.** 100xEngineers published a video
showing a Claude Project with 400 past scripts uploaded and a custom instruction to adopt the
style. Four minutes of setup, no code, and one output reached 1.7 million views. Two separate
rounds of searching also found the same capability in at least three open-source tools
(write-like-me-mcp, interfluence, CloneWriter). If my product were style matching, it would be a
reimplementation of a tutorial.

**2. That baseline never solves the actual problem.** In the video, the creator finds the news
article himself and pastes it in. Every time. Ideation is one hundred percent human. The baseline
answers "write this in my voice," not "what should I post." Hariharan's shoots get cancelled
because there is no topic, not because he cannot phrase one.

**3. Nothing checks against your own archive.** Neither the baseline nor any of the three tools
asks "have I already said this." That is the gap, and it is the one thing I had evidence that a
real creator needed: his on-the-spot ideas are invented under pressure with no check against what
he already published.

Two practitioners also converged on a limit worth designing around. The 100xEngineers founder
reports only 70 to 90 percent of generated scripts ship as written, and attributes the gap to
insight from lived experience rather than voice. Ali Abdaal, across 900 videos, describes his
entire prep as three bullet points, and says a guide draws on experience rather than research.
Both say the valuable ingredient is the creator's own experience, which the model has no access to.

## The hypothesis

If Hariharan gets a running bank of ideas through the week, each checked against his published
archive before it reaches him, then his prepared-slot rate rises from roughly 50-60 percent to 75
percent or higher, holding across at least three consecutive shoots, and cancellations for lack of
ideas drop toward zero.

**It is wrong if any of these happen:**
1. Prepared-slot rate stays under 75 percent across three consecutive shoots
2. Fewer than half the banked ideas ever get marked "yes, I'd shoot this"
3. He stops responding within the first week (adoption failure, not quality failure)
4. Scripts need heavy rewriting more than half the time
5. A shoot is cancelled despite a stocked bank, meaning the bottleneck was never idea availability

## What I built

A web app with three steps and one gate.

**Read the archive into claims he can reject.** Style patterns must be citable, not impressions.
"Casual tone" is not a pattern; "opens four of the last six with a direct question" is, and it
comes with the quoted fragment it was derived from. He rejects any claim I got wrong, and rejected
claims are excluded from everything generated afterwards. This exists because a confidently wrong
style read poisons every output downstream, and it is cheaper to catch here than later.

**Generate candidates from his own themes.** Three multipliers, and the app says which produced
each idea: Kipling 5W1H for angles within a theme, reframing for new entry points to the same
substance, vertical descent for root cause. None of these need a large archive, only a theme and
domain knowledge, which matters because he has roughly 22 pieces and the baseline's author says
400 was necessary for voice matching.

**Gate every candidate against the archive.** Three verdicts, not two:
- **new** — not covered
- **reframe** — covered, but through a genuinely different door, with the prior piece named and the
  difference stated. This is a legitimate idea, not a rejection, because reframing one theme into
  many pieces is the craft rather than a cheat
- **already covered** — same subject and same framing, with the piece cited

Repeats are shown rather than hidden, so he can see the check working rather than trusting it.

**Outline, then expand.** The output is a hook, three points, and a close, not a finished script.
The approval decision sits before the expensive generation, not after it. Every outline leaves one
slot deliberately empty, where his own experience or a client example belongs, labelled with the
kind of example that fits. The app does not invent that, because it cannot.

**Verification flags.** Any claim needing checking is flagged, hard for health, medicine, mental
health, finance, law, and research. He makes mental health content, so this is a safety
requirement rather than a quality nicety: a confident unverified claim about anxiety or trauma can
harm a viewer.

**A run log.** Every verdict he gives is recorded and exportable. It is simultaneously the
evidence the hypothesis is measured on and the record of what he actually accepted.

## What I decided not to build, and why

- **No vector database or retrieval.** The baseline video shows 400 scripts filling 16 percent of
  a Claude Project's capacity. A 22-piece archive is a rounding error against a million-token
  context. Retrieval would add infrastructure and a failure mode, the retriever fetching the wrong
  pieces so the model never sees the relevant one, in exchange for nothing.
- **No fine-tuning.** Retrieval and prompting only. Nothing in the problem requires weight changes.
- **No video or image generation.** The adjacent market is thirteen-plus faceless video tools at
  $15 to $82 a month. They remove the creator instead of solving the voice problem. He performs on
  camera himself; his face is the brand.
- **No auth or database in the shipped app.** They serve many users. There is one test user and one
  deadline. Dropped when the submission deadline became tonight.
- **Full scripts are not the default output.** The practitioner with 900 videos preps three
  bullets. He performs in Tamil anyway, so a polished English script is work discarded at the
  moment of recording.

## Where the evidence actually stands

Honest status, 7 Oct 2026.

**Collected:** his reported behaviour (on-the-spot invention rate, cancellation frequency, crew
pressure), Ram's independent naming of the same constraint, and the market scan.

**Not collected:** the Mom Test interviews were sent on 7 Oct and replies have not yet landed. No
repeated-run measurement exists. The prepared-slot rate has not been measured with the system in
place, so the hypothesis is **untested, not supported**.

**What would make it credible:** three consecutive shoots with the bank running, and the
prepared-slot rate measured each time against the 50-60 percent baseline.

I would rather submit an untested hypothesis with a stated kill condition than a tested-sounding
claim built on a prediction he gave me after I described the idea.

## The one thing I would check first if I continued

Whether he logs ideas through the week at all, or only on shoot eve. The whole design assumes a
bank that accumulates. If he ignores it until the night before, the product has moved his
bottleneck by a few hours and solved nothing. That is falsification condition 3, and it is
behavioural, so it needs no code to test.
