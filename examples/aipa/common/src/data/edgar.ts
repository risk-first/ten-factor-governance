import fs from 'node:fs';
import { fixturePath } from './paths.js';
import { FILINGS_TTL_MS, researchDataCache } from './ttlCache.js';

/** Common CIK map for demo tickers (zero-padded). */
const TICKER_CIK: Record<string, string> = {
  SHEL: '0001306965',
  XOM: '0000034088',
  CVX: '0000093410',
  NVDA: '0001045810',
  MSFT: '0000789019',
  JPM: '0000019617',
  PG: '0000080424',
  AAPL: '0000320193',
};

export type EdgarFilingSummary = {
  ticker: string;
  cik: string;
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  url: string;
  source: 'edgar' | 'fixture';
};

function userAgent(): string {
  return process.env.SEC_USER_AGENT || 'AIPA-Demo aipa-demo@example.com';
}

async function fetchRecentFilings(ticker: string): Promise<EdgarFilingSummary[]> {
  const cik = TICKER_CIK[ticker.toUpperCase()];
  if (!cik) {
    return fixtureFilings(ticker);
  }

  try {
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
    });
    if (!res.ok) return fixtureFilings(ticker);
    const body = (await res.json()) as {
      filings?: {
        recent?: {
          form: string[];
          filingDate: string[];
          accessionNumber: string[];
          primaryDocument: string[];
        };
      };
    };
    const recent = body.filings?.recent;
    if (!recent) return fixtureFilings(ticker);

    const out: EdgarFilingSummary[] = [];
    for (let i = 0; i < Math.min(5, recent.form.length); i++) {
      const form = recent.form[i];
      if (!['10-K', '10-Q', '8-K', '20-F', '6-K'].includes(form)) continue;
      const accession = recent.accessionNumber[i].replace(/-/g, '');
      const doc = recent.primaryDocument[i];
      out.push({
        ticker: ticker.toUpperCase(),
        cik,
        form,
        filingDate: recent.filingDate[i],
        accessionNumber: recent.accessionNumber[i],
        primaryDocument: doc,
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${doc}`,
        source: 'edgar',
      });
      if (out.length >= 3) break;
    }
    return out.length ? out : fixtureFilings(ticker);
  } catch {
    return fixtureFilings(ticker);
  }
}

export async function getRecentFilings(ticker: string): Promise<EdgarFilingSummary[]> {
  const key = `filings:${ticker.toUpperCase()}`;
  return researchDataCache.getOrLoad(key, () => fetchRecentFilings(ticker), FILINGS_TTL_MS);
}

function fixtureFilings(ticker: string): EdgarFilingSummary[] {
  const research = JSON.parse(fs.readFileSync(fixturePath('research.json'), 'utf-8')) as {
    findings: Array<{ title: string; sourceUrl: string; publishedAt: string; tickers?: string[] }>;
  };
  return research.findings
    .filter(f => !f.tickers || f.tickers.includes(ticker.toUpperCase()))
    .slice(0, 2)
    .map((f, i) => ({
      ticker: ticker.toUpperCase(),
      cik: TICKER_CIK[ticker.toUpperCase()] ?? '0000000000',
      form: '10-K',
      filingDate: f.publishedAt.slice(0, 10),
      accessionNumber: `0000000000-25-00000${i}`,
      primaryDocument: 'fixture.htm',
      url: f.sourceUrl,
      source: 'fixture' as const,
    }));
}
