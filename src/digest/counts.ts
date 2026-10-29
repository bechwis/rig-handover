import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import type { RunLine, RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Number of log lines per status. Pure; lines that did not parse are not in the input.
export function countByStatus(lines: RunLine[]): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const l of lines) counts[l.status] += 1;
  return counts;
}

// Counts for one night's file; null when the file is missing. Bad lines are skipped.
export function nightCounts(runsDir: string, night: string): StatusCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const lines: RunLine[] = [];
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const l = parseLine(raw);
    if (l) lines.push(l);
  }
  return countByStatus(lines);
}
