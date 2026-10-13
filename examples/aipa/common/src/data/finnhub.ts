import fs from 'node:fs';
import { fixturePath } from './paths.js';
import { NEWS_TTL_MS, QUOTE_TTL_MS, marketDataCache } from './ttlCache.js';

export type Quote = { c: number; h: number; l: number; o: number; pc: number; t: number };

function loadFixtureQuotes(): Record<string, Quote> {
  return JSON.parse(fs.readFileSync(fixturePath('quotes.json'), 'utf-8')) as Record<string, Quote>;
}

async function fetchQuote(symbol: string): Promise<{ quote: Quote; source: 'finnhub' | 'fixture' }> {
  const key = process.env.FINNHUB_API_KEY;
  if (key) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
      const res = await fetch(url);
      if (res.ok) {
        const quote = (await res.json()) as Quote;
        if (typeof quote.c === 'number' && quote.c !== 0) {
          return { quote, source: 'finnhub' };
        }
      }
    } catch {
      /* fall through */
    }
  }
  const fixtures = loadFixtureQuotes();
  const quote = fixtures[symbol.toUpperCase()] ?? { c: 100, h: 101, l: 99, o: 100, pc: 99.5, t: 0 };
  return { quote, source: 'fixture' };
}

export async function getQuote(symbol: string): Promise<{ quote: Quote; source: 'finnhub' | 'fixture' }> {
  const ticker = symbol.toUpperCase();
  return marketDataCache.getOrLoad(`quote:${ticker}`, () => fetchQuote(ticker), QUOTE_TTL_MS);
}

export type CompanyNewsItem = {
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  source: string;
};

async function fetchCompanyNews(
  symbol: string,
  fromIsoDate: string,
  toIsoDate: string
): Promise<{ items: CompanyNewsItem[]; source: 'finnhub' | 'fixture' }> {
  const key = process.env.FINNHUB_API_KEY;
  if (key) {
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromIsoDate}&to=${toIsoDate}&token=${key}`;
      const res = await fetch(url);
      if (res.ok) {
        const items = (await res.json()) as CompanyNewsItem[];
        if (Array.isArray(items) && items.length > 0) {
          return { items: items.slice(0, 8), source: 'finnhub' };
        }
      }
    } catch {
      /* fall through */
    }
  }
  const research = JSON.parse(fs.readFileSync(fixturePath('research.json'), 'utf-8')) as {
    findings: Array<{ title: string; summary: string; sourceUrl: string; publishedAt: string; tickers?: string[] }>;
  };
  const items: CompanyNewsItem[] = research.findings
    .filter(f => !f.tickers || f.tickers.includes(symbol.toUpperCase()))
    .map(f => ({
      headline: f.title,
      summary: f.summary,
      url: f.sourceUrl,
      datetime: Math.floor(new Date(f.publishedAt).getTime() / 1000),
      source: 'fixture',
    }));
  return { items, source: 'fixture' };
}

export async function getCompanyNews(
  symbol: string,
  fromIsoDate: string,
  toIsoDate: string
): Promise<{ items: CompanyNewsItem[]; source: 'finnhub' | 'fixture' }> {
  const ticker = symbol.toUpperCase();
  const cacheKey = `news:${ticker}:${fromIsoDate}:${toIsoDate}`;
  return marketDataCache.getOrLoad(
    cacheKey,
    () => fetchCompanyNews(ticker, fromIsoDate, toIsoDate),
    NEWS_TTL_MS
  );
}
