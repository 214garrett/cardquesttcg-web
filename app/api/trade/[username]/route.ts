import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TCG_BASE = 'https://api.pokemontcg.io/v2';
const TCG_HEADERS: Record<string, string> = process.env.TCG_API_KEY
  ? { 'X-Api-Key': process.env.TCG_API_KEY }
  : {};

// Module-level in-memory cache — survives across requests within a Vercel instance
const _tcgCache    = new Map<string, { data: any; expires: number }>();
const _csvGroups:  { data: any; ts: number } | null = null;
const _csvProducts = new Map<number, { data: any[]; ts: number }>();
const _csvPrices   = new Map<number, { data: any[]; ts: number }>();
const CSV_BASE = 'https://tcgcsv.com/tcgplayer/3'; // Category 3 = Pokémon

interface TCGCardData {
  rarity?: string;
  set?: { symbolUrl?: string; logoUrl?: string; name?: string };
  tcgplayer?: { prices?: Record<string, { market?: number; mid?: number }> };
  cardmarket?: { prices?: { avg30?: number; trendPrice?: number; averageSellPrice?: number } };
}

/** Best market price from TCGPlayer prices object */
function bestPrice(prices?: Record<string, { market?: number; mid?: number }>): number | null {
  if (!prices) return null;
  const order = [
    'specialIllustrationRare', 'illustrationRare', 'hyperRare',
    'holofoil', 'reverseHolofoil', 'normal',
    '1stEditionHolofoil', '1stEditionNormal',
  ];
  for (const key of order) {
    const p = prices[key];
    if (p?.market) return p.market;
    if (p?.mid) return p.mid;
  }
  for (const p of Object.values(prices)) {
    if (p?.market) return p.market;
  }
  return null;
}

/** Best cardmarket price (fallback when TCGPlayer has no data) */
function cardmarketPrice(cm?: { prices?: { avg30?: number; trendPrice?: number; averageSellPrice?: number } }): number | null {
  const p = cm?.prices;
  if (!p) return null;
  return p.averageSellPrice ?? p.avg30 ?? p.trendPrice ?? null;
}

/** Fetch with retry on empty/rate-limit response + in-memory cache */
async function tcgFetch(url: string, retries = 1): Promise<any | null> {
  // Check in-memory cache first (bypasses stale Next.js fetch cache)
  const now = Date.now();
  const cached = _tcgCache.get(url);
  if (cached && cached.expires > now) return cached.data;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 300 * attempt));
      const res = await fetch(url, {
        headers: TCG_HEADERS,
        cache: 'no-store', // Always fetch fresh — we control caching ourselves
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text?.trim()) {
        if (attempt < retries) await new Promise(r => setTimeout(r, 300));
        continue;
      }
      const data = JSON.parse(text);
      // Cache successful responses for 2 hours
      _tcgCache.set(url, { data, expires: now + 7200000 });
      return data;
    } catch { return null; }
  }
  return null;
}

/** Layer 1: direct card ID lookup */
async function fetchByCardId(cardId: string): Promise<TCGCardData | null> {
  const json = await tcgFetch(`${TCG_BASE}/cards/${cardId}`);
  return json?.data ?? null;
}

/** Layer 2: search by name + set name */
async function fetchBySearch(
  name: string,
  setName: string | null,
  cardNumber: string | null,
): Promise<TCGCardData | null> {
  // Sanitize: escape apostrophes and quotes that break the query
  const safeName = name.replace(/"/g, '').replace(/'/g, '');
  const safeSet  = (setName ?? '').replace(/"/g, '').replace(/'/g, '');

  const q = `name:"${safeName}"${safeSet ? ` set.name:"${safeSet}"` : ''}`;
  const json = await tcgFetch(`${TCG_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=20`);
  const cards: any[] = json?.data ?? [];
  if (!cards.length) return null;

  const wantedNum = (cardNumber ?? '').split('/')[0].trim();
  return wantedNum
    ? (cards.find(c => c.number?.split('/')[0]?.trim() === wantedNum) ?? cards[0])
    : cards[0];
}

/** Layer 3: name-only search (no set restriction) — last resort */
async function fetchByNameOnly(name: string, cardNumber: string | null): Promise<TCGCardData | null> {
  const safeName = name.replace(/"/g, '').replace(/'/g, '');
  const json = await tcgFetch(`${TCG_BASE}/cards?q=${encodeURIComponent(`name:"${safeName}"`)}&pageSize=20&orderBy=-set.releaseDate`);
  const cards: any[] = json?.data ?? [];
  if (!cards.length) return null;

  const wantedNum = (cardNumber ?? '').split('/')[0].trim();
  if (wantedNum) {
    const exact = cards.find(c => c.number?.split('/')[0]?.trim() === wantedNum);
    if (exact) return exact;
  }
  return cards[0];
}

// ── tcgcsv.com Layer ─────────────────────────────────────────────
// Free daily mirror of TCGPlayer prices — no API key, covers ALL sets
let _csvGroupsCache: { data: any[]; ts: number } | null = null;

async function csvFetch(url: string): Promise<any | null> {
  const now = Date.now();
  const cached = _tcgCache.get(url);
  if (cached && cached.expires > now) return cached.data;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    _tcgCache.set(url, { data: json, expires: now + 3600000 }); // 1h
    return json;
  } catch { return null; }
}

async function csvGetGroups(): Promise<any[] | null> {
  if (_csvGroupsCache && Date.now() - _csvGroupsCache.ts < 86400000) return _csvGroupsCache.data;
  const json = await csvFetch(`${CSV_BASE}/groups`);
  const data = json?.results ?? json;
  if (Array.isArray(data)) { _csvGroupsCache = { data, ts: Date.now() }; return data; }
  return null;
}

function csvFindGroup(groups: any[], setName: string): any | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(setName);
  return groups.find(g => norm(g.name ?? '') === target)
      ?? groups.find(g => norm(g.name ?? '').includes(target) || target.includes(norm(g.name ?? '')))
      ?? null;
}

async function fetchTcgCsvPrice(name: string, setName: string | null, cardNumber: string | null): Promise<number | null> {
  if (!name || !setName) return null;
  try {
    const groups = await csvGetGroups();
    if (!groups) return null;
    const group = csvFindGroup(groups, setName);
    if (!group) return null;

    const gid = group.groupId;
    const [prodJson, priceJson] = await Promise.all([
      csvFetch(`${CSV_BASE}/${gid}/products`),
      csvFetch(`${CSV_BASE}/${gid}/prices`),
    ]);
    const products: any[] = prodJson?.results ?? prodJson ?? [];
    const prices:   any[] = priceJson?.results ?? priceJson ?? [];
    if (!products.length || !prices.length) return null;

    const numOnly = cardNumber ? String(parseInt(cardNumber.split('/')[0], 10)) : null;
    const normName = name.toLowerCase().replace(/[''`]/g, '').trim();

    let product: any = null;
    if (numOnly) {
      product = products.find(p => {
        const extNum = p.extendedData?.find((d: any) => d.name === 'Number')?.value ?? '';
        return String(parseInt(extNum, 10)) === numOnly
          || (p.name ?? '').includes(`${numOnly}/`)
          || (p.name ?? '').endsWith(`- ${numOnly}`);
      });
    }
    if (!product) {
      const key = normName.split(' ').filter((t: string) => t.length > 1).slice(0, 2).join(' ');
      product = products.find(p => (p.cleanName ?? p.name ?? '').toLowerCase().includes(key));
    }
    if (!product) return null;

    const productPrices = prices.filter(p => p.productId === product.productId);
    // Prefer market price, fall back to midpoint
    const market = productPrices.find(p => p.marketPrice != null)?.marketPrice ?? null;
    if (market != null) return market;
    const mid = productPrices.find(p => p.midPrice != null)?.midPrice ?? null;
    return mid;
  } catch { return null; }
}

function hasPrices(d: TCGCardData | null): boolean {
  if (!d) return false;
  // Only true when there's an actual non-null price value — not just keys
  if (bestPrice(d.tcgplayer?.prices) != null) return true;
  if (cardmarketPrice(d.cardmarket) != null) return true;
  return false;
}

async function resolveCardData(
  raw_rarity: string | null,
  cardId: string | null,
  name: string,
  setName: string | null,
  cardNumber: string | null,
): Promise<{ rarity: string | null; symbolUrl: string | null; marketPrice: number | null }> {
  let meta: TCGCardData | null = null;  // rarity + symbolUrl source
  let priceData: TCGCardData | null = null; // price source

  // Kick off tcgcsv.com lookup immediately in parallel — it doesn't rate limit
  // and is the most reliable source for all sets including Japanese/special.
  const csvPricePromise = fetchTcgCsvPrice(name, setName, cardNumber);

  // Layer 1: direct card ID — best source for rarity/symbol
  if (cardId) {
    const d = await fetchByCardId(cardId);
    if (d) {
      meta = d;
      if (hasPrices(d)) priceData = d;
    }
  }

  // Layer 2: name + set search — finds correct variant by card number
  if (!priceData) {
    const d = await fetchBySearch(name, setName, cardNumber);
    if (d) {
      if (!meta) meta = d;
      if (hasPrices(d)) priceData = d;
    }
  }

  // Layer 3: name-only search — last resort, set name may not match pokemontcg.io
  if (!priceData) {
    const d = await fetchByNameOnly(name, cardNumber);
    if (d) {
      if (!meta) meta = d;
      if (hasPrices(d)) priceData = d;
    }
  }

  // Await the tcgcsv price (was already running in parallel — little/no extra wait)
  const csvPrice = await csvPricePromise;

  // Prefer pokemontcg.io price when available; fall back to tcgcsv
  const price = bestPrice(priceData?.tcgplayer?.prices) ?? cardmarketPrice(priceData?.cardmarket) ?? csvPrice ?? null;

  return {
    rarity:      raw_rarity ?? meta?.rarity ?? null,
    symbolUrl:   meta?.set?.symbolUrl ?? null,
    marketPrice: price,
  };
}

/** Throttle: process cards with a small delay between each to avoid rate limits */
async function resolveSequential(items: any[]): Promise<any[]> {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) await new Promise(r => setTimeout(r, 200)); // 200ms between requests
    const r = await resolveCardData(
      item.cards?.raw_rarity ?? null,
      item.cards?.id ?? null,
      item.cards?.name ?? '',
      item.cards?.set_name ?? null,
      item.cards?.card_number ?? null,
    );
    results.push(r);
  }
  return results;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, avatar_id, contact_info')
    .ilike('username', username)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from('collection')
    .select(`
      id, quantity, condition,
      cards ( id, name, set_name, card_number, rarity, raw_rarity, image_url, source )
    `)
    .eq('user_id', profile.id)
    .eq('for_trade', true)
    .order('id', { ascending: true });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  const physical = (cards ?? []).filter((item: any) => item.cards?.source !== 'pack_pull');

  // Sequential resolution with throttle to avoid rate limiting pokemontcg.io
  const resolved = await resolveSequential(physical);

  const flat = physical.map((item: any, i: number) => {
    let imageUrl = item.cards?.image_url ?? null;
    if (!imageUrl && item.cards?.id) {
      const parts = item.cards.id.split('-');
      if (parts.length >= 2) {
        imageUrl = `https://images.pokemontcg.io/${parts[0]}/${parts.slice(1).join('-')}_hires.png`;
      }
    }
    return {
      collectionId: item.id,
      quantity:     item.quantity,
      condition:    item.condition,
      name:         item.cards?.name,
      setName:      item.cards?.set_name,
      cardNumber:   item.cards?.card_number,
      rarity:       item.cards?.rarity,
      rawRarity:    resolved[i].rarity,
      symbolUrl:    resolved[i].symbolUrl,
      marketPrice:  resolved[i].marketPrice,
      imageUrl,
    };
  });

  const totalValue = flat.reduce((sum, c) => sum + (c.marketPrice ?? 0) * (c.quantity ?? 1), 0);

  return NextResponse.json({
    username:    profile.username,
    avatarId:    profile.avatar_id,
    contactInfo: profile.contact_info ?? null,
    totalValue:  Math.round(totalValue * 100) / 100,
    cards: flat,
  });
}
