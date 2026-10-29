import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

// Marked in text as well as colour, so a fetch or a screenshot reads the same (ADR 0001).
function marks(row: DigestRow): string[] {
  return [
    ...(row.fails > 0 ? [`failed ${row.fails}×`] : []),
    ...(row.retries >= 3 ? [`${row.retries} retries`] : []),
  ];
}

function Row({ row }: { row: DigestRow }) {
  const m = marks(row);
  return (
    <tr class={m.length > 0 ? 'warn' : undefined}>
      <td>
        {row.job}
        {m.length > 0 ? ` (${m.join(', ')})` : null}
      </td>
      <td>{row.owner ?? dash}</td>
      <td>{row.runs}</td>
      <td>{row.retries}</td>
      <td>{row.lastStatus || dash}</td>
      <td>{row.lastError ?? dash}</td>
      <td>{row.firstAt || dash}</td>
      <td>{row.lastAt || dash}</td>
    </tr>
  );
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <Row row={row} />
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 ? (
        <p class="mute">
          {night.badLines} bad {night.badLines === 1 ? 'line' : 'lines'} skipped
        </p>
      ) : null}
    </>
  );
}
