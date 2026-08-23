"use client";

import { useMemo, useState } from "react";

type Entry = {
  id: number;
  raw: string;
  phonetic: string;
  stress: string;
  cue: string;
  category: "person" | "term" | "place" | "other";
};

type Tone = "clear" | "warm" | "formal";

const seedText = `Term 1 — TER-m wun — slow down before the final consonant
Term 2 — TER-m too — keep the vowel short
Attendee 1 — uh-TEN-dee wun — stress the middle beat
Event 1 — ee-VENT wun — lift slightly on the second word`;

const vowels = new Set(["a", "e", "i", "o", "u"]);

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function guessCategory(raw: string): Entry["category"] {
  const lower = raw.toLowerCase();
  if (lower.includes("attendee") || lower.includes("speaker") || lower.includes("guest")) return "person";
  if (lower.includes("event") || lower.includes("session")) return "other";
  if (lower.includes("room") || lower.includes("venue")) return "place";
  return "term";
}

function syllableChunks(word: string): string[] {
  const cleaned = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let current = "";
  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    const previous = cleaned[index - 1];
    current += char;
    const boundary = vowels.has(char) && previous && !vowels.has(previous) && current.length > 2;
    if (boundary && index < cleaned.length - 1) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [cleaned];
}

function autoPhonetic(raw: string): string {
  const words = raw.split(/\s+/).filter(Boolean);
  const rendered = words.map((word, wordIndex) => {
    const chunks = syllableChunks(word);
    if (!chunks.length) return word;
    return chunks
      .map((chunk, chunkIndex) => (wordIndex === 0 && chunkIndex === 0 ? chunk.toUpperCase() : chunk))
      .join("-");
  });
  return rendered.join(" ");
}

function autoCue(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 4) return "Break it into two beats; pause after the second word.";
  if (/[qxz]/i.test(raw)) return "Hit the hard consonant cleanly; do not rush the ending.";
  if (/[aeiou]{2}/i.test(raw)) return "Hold the long vowel half a beat longer.";
  return "Say it once slowly, then once at delivery speed.";
}

function parseLine(line: string, id: number): Entry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+[—-]\s+/).map((part) => part.trim());
  const raw = titleCase(parts[0] ?? "");
  if (!raw) return null;
  const phonetic = parts[1] || autoPhonetic(raw);
  const cue = parts[2] || autoCue(raw);
  return {
    id,
    raw,
    phonetic,
    stress: phonetic.replace(/[A-Z]{2,}/g, (match) => match.toLowerCase()).split(/[-\s]+/)[0] ?? raw,
    cue,
    category: guessCategory(raw),
  };
}

function useEntries(text: string): Entry[] {
  return useMemo(() => text.split("\n").map(parseLine).filter((entry): entry is Entry => Boolean(entry)), [text]);
}

function estimateSeconds(entries: Entry[], repetitions: number): number {
  const words = entries.reduce((sum, entry) => sum + entry.raw.split(/\s+/).length + entry.phonetic.split(/\s+/).length, 0);
  return Math.max(20, Math.round((words / 120) * 60 * repetitions + entries.length * 3));
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function buildScript(entries: Entry[], tone: Tone, repetitions: number): string {
  const opener = tone === "formal" ? "Pronunciation check." : tone === "warm" ? "Quick pronunciation run-through." : "Pronunciation run.";
  const lines = entries.flatMap((entry, index) => {
    const repeats = Array.from({ length: repetitions }, (_, repeatIndex) =>
      `${index + 1}.${repeatIndex + 1} ${entry.raw}. ${entry.phonetic}. ${entry.cue}`,
    );
    return repeats;
  });
  return [opener, "Pause after each line. Mark anything that still feels awkward.", ...lines].join("\n");
}

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text);
}

function speak(text: string, rate: number): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export default function Home() {
  const [text, setText] = useState(seedText);
  const [tone, setTone] = useState<Tone>("clear");
  const [rate, setRate] = useState(0.86);
  const [repetitions, setRepetitions] = useState(2);
  const entries = useEntries(text);
  const script = useMemo(() => buildScript(entries, tone, repetitions), [entries, repetitions, tone]);
  const duration = estimateSeconds(entries, repetitions);
  const categoryCounts = entries.reduce<Record<Entry["category"], number>>(
    (counts, entry) => ({ ...counts, [entry.category]: counts[entry.category] + 1 }),
    { person: 0, term: 0, place: 0, other: 0 },
  );

  return (
    <main className="min-h-screen px-5 py-6 text-stone-950 sm:px-8 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-xl shadow-stone-300/30 backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-amber-700">Voice generation utility</p>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Pronounce Sheet</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-stone-700 sm:text-lg">
                Paste names, terms, or session words once. Get a print-ready pronunciation sheet, rehearsal script, browser read-aloud, and copyable host cue pack for spoken delivery.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-stone-950 px-4 py-3 text-white">
                <p className="text-2xl font-black">{entries.length}</p>
                <p className="text-xs uppercase tracking-wider text-stone-300">entries</p>
              </div>
              <div className="rounded-2xl bg-amber-200 px-4 py-3">
                <p className="text-2xl font-black">{formatDuration(duration)}</p>
                <p className="text-xs uppercase tracking-wider text-amber-900">rehearse</p>
              </div>
              <div className="rounded-2xl bg-sky-200 px-4 py-3">
                <p className="text-2xl font-black">{categoryCounts.person + categoryCounts.term}</p>
                <p className="text-xs uppercase tracking-wider text-sky-900">voice cues</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="no-print rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-xl shadow-stone-300/25 backdrop-blur">
            <label className="text-sm font-black uppercase tracking-[0.2em] text-stone-600" htmlFor="terms">
              Input list
            </label>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              One item per line. Optional format: item — phonetic spelling — cue. Generic placeholders are used by default.
            </p>
            <textarea
              id="terms"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="mt-4 min-h-[300px] w-full rounded-3xl border border-stone-200 bg-white p-4 font-mono text-sm leading-6 outline-none ring-amber-300 transition focus:ring-4"
              spellCheck={false}
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-bold text-stone-700">
                Tone
                <select
                  value={tone}
                  onChange={(event) => setTone(event.target.value as Tone)}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-3 py-3"
                >
                  <option value="clear">Clear</option>
                  <option value="warm">Warm</option>
                  <option value="formal">Formal</option>
                </select>
              </label>
              <label className="text-sm font-bold text-stone-700">
                Repeats
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={repetitions}
                  onChange={(event) => setRepetitions(Math.min(4, Math.max(1, Number(event.target.value))))}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-3 py-3"
                />
              </label>
              <label className="text-sm font-bold text-stone-700">
                Read rate
                <input
                  type="range"
                  min={0.65}
                  max={1.15}
                  step={0.01}
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  className="mt-5 w-full accent-stone-950"
                />
                <span className="text-xs text-stone-500">{rate.toFixed(2)}×</span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => speak(script, rate)} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-stone-400/30">
                Read rehearsal aloud
              </button>
              <button onClick={() => copyText(script)} className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-stone-950">
                Copy script
              </button>
              <button onClick={() => window.print()} className="rounded-full bg-white px-5 py-3 text-sm font-black text-stone-950 ring-1 ring-stone-200">
                Print cue sheet
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <section className="print-card rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-xl shadow-stone-300/25 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Delivery cue sheet</h2>
                  <p className="mt-1 text-sm text-stone-600">Print this for the lectern, producer desk, or rehearsal run.</p>
                </div>
                <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{formatDuration(duration)}</span>
              </div>
              <div className="mt-5 grid gap-3">
                {entries.map((entry) => (
                  <article key={`${entry.id}-${entry.raw}`} className="print-card rounded-3xl border border-stone-200 bg-gradient-to-br from-white to-stone-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-stone-500">{entry.category}</p>
                        <h3 className="mt-1 text-2xl font-black">{entry.raw}</h3>
                      </div>
                      <button onClick={() => speak(`${entry.raw}. ${entry.phonetic}. ${entry.cue}`, rate)} className="no-print rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-950">
                        Hear it
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.2fr]">
                      <div className="rounded-2xl bg-amber-100 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-900">Phonetic</p>
                        <p className="mt-1 text-xl font-black tracking-wide text-amber-950">{entry.phonetic}</p>
                      </div>
                      <div className="rounded-2xl bg-sky-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-sky-900">Delivery note</p>
                        <p className="mt-1 text-sm leading-6 text-sky-950">{entry.cue}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="print-card rounded-[2rem] border border-white/70 bg-stone-950 p-5 text-white shadow-xl shadow-stone-400/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Rehearsal script</h2>
                  <p className="mt-1 text-sm text-stone-300">Built for browser read-aloud or a quick producer-side run-through.</p>
                </div>
                <button onClick={() => copyText(script)} className="no-print rounded-full bg-white px-4 py-2 text-sm font-black text-stone-950">
                  Copy pack
                </button>
              </div>
              <pre className="mt-5 whitespace-pre-wrap rounded-3xl bg-white/10 p-4 text-sm leading-7 text-stone-100">{script}</pre>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
