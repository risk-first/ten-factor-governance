import fs from 'node:fs';
import { fixturePath } from './paths.js';

export type MacroPoint = { seriesId: string; value: number; unit: string; date: string; source: 'fred' | 'fixture' };

async function fetchFredLatest(seriesId: string): Promise<MacroPoint | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
    const obs = body.observations?.[0];
    if (!obs || obs.value === '.') return null;
    return {
      seriesId,
      value: Number(obs.value),
      unit: 'fred',
      date: obs.date,
      source: 'fred',
    };
  } catch {
    return null;
  }
}

export async function getMacroSnapshot(): Promise<{
  oil: MacroPoint;
  fedFunds: MacroPoint;
  tenYear: MacroPoint;
}> {
  const fixture = JSON.parse(fs.readFileSync(fixturePath('macro.json'), 'utf-8')) as {
    oil: Omit<MacroPoint, 'source'>;
    fedFunds: Omit<MacroPoint, 'source'>;
    tenYear: Omit<MacroPoint, 'source'>;
  };

  const [oilLive, ffLive, tyLive] = await Promise.all([
    fetchFredLatest('DCOILWTICO'),
    fetchFredLatest('DFF'),
    fetchFredLatest('DGS10'),
  ]);

  return {
    oil: oilLive ?? { ...fixture.oil, source: 'fixture' },
    fedFunds: ffLive ?? { ...fixture.fedFunds, source: 'fixture' },
    tenYear: tyLive ?? { ...fixture.tenYear, source: 'fixture' },
  };
}
