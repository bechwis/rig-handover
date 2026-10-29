import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (o: object) => JSON.stringify(o);
const run = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  line({ at, job, status, owner, ...(error ? { error } : {}) });

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  // data night: jobs appear in file order zeta, alpha - the digest sorts them by name
  writeFileSync(
    join(dir, '2030-01-01.jsonl'),
    [
      run('2030-01-01T01:00:00+01:00', 'zeta', 'ok', 'jess'),
      run('2030-01-01T01:05:00+01:00', 'alpha', 'retry', 'jess', 'boom'),
      run('2030-01-01T01:10:00+01:00', 'alpha', 'ok', 'jess'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2030-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2030-01-03.jsonl'),
    [run('2030-01-03T01:00:00+01:00', 'solo', 'ok', null), 'not json at all'].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2030-01-01T00:00:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('GET /digest/:night', () => {
  it('200 with a table for a night with data', async () => {
    const res = await app.request('/digest/2030-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2030-01-01');
    expect(html).toContain('alpha');
    expect(html).toContain('zeta');
    expect(html).not.toContain('nothing ran');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2030-02-02');
    expect(res.status).toBe(404);
  });

  it('empty night says nothing ran', async () => {
    const res = await app.request('/digest/2030-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line still 200 and is shown as counted', async () => {
    const res = await app.request('/digest/2030-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('solo');
    expect(html).toContain('1 bad line skipped');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with rows for a night with data', async () => {
    const res = await app.request('/api/digest/2030-01-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2030-01-01');
    expect(body.badLines).toBe(0);
    const alpha = body.rows.find((r) => r.job === 'alpha');
    expect(alpha).toMatchObject({ runs: 2, retries: 1, lastStatus: 'ok' });
  });

  it('404 json for a night with no file', async () => {
    const res = await app.request('/api/digest/2030-02-02');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('empty night has rows []', async () => {
    const res = await app.request('/api/digest/2030-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2030-01-02', rows: [], badLines: 0 });
  });

  it('bad line still 200 with badLines 1', async () => {
    const res = await app.request('/api/digest/2030-01-03');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});

describe('page and JSON agree', () => {
  it('list jobs in the same order', async () => {
    const html = await (await app.request('/digest/2030-01-01')).text();
    const body = (await (await app.request('/api/digest/2030-01-01')).json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha', 'zeta']);
    const positions = jobs.map((j) => html.indexOf(`<td>${j}</td>`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
