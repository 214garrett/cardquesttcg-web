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

/** Fetch with retry on empty/rate-limit response */
async function tcgFetch(url: string, retries = 2): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 600 * attempt));
      const res = await fetch(url, {
        headers: TCG_HEADERS,
        next: { revalidate: 86400 },
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text?.trim()) {
        // rate-limited or empty — wait and retry
        if (attempt < retries) await new Promise(r => setTimeout(r, 800));
        continue;
      }
      return JSON.parse(text);
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

function hasPrices(d: TCGCardData | null): boolean {
  if (!d) return false;
  const tp = d.tcgplayer?.prices;
  if (tp && Object.keys(tp).length > 0) return true;
  const cm = d.cardmarket?.prices;
  if (cm && Object.values(cm).some(v => v != null)) return true;
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

  const price = bestPrice(priceData?.tcgplayer?.prices) ?? cardmarketPrice(priceData?.cardmarket) ?? null;

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
