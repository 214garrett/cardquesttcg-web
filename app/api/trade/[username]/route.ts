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
}

/** Best market price from TCGPlayer prices object */
function bestPrice(prices?: Record<string, { market?: number; mid?: number }>): number | null {
  if (!prices) return null;
  // Prefer: special illustration > holofoil > normal > 1st edition
  const order = ['specialIllustrationRare', 'illustrationRare', 'hyperRare', 'holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', '1stEditionNormal'];
  for (const key of order) {
    const p = prices[key];
    if (p?.market) return p.market;
    if (p?.mid) return p.mid;
  }
  // fallback: first available
  for (const p of Object.values(prices)) {
    if (p?.market) return p.market;
  }
  return null;
}

/** Layer 1: direct card ID lookup — returns rarity, symbolUrl, price */
async function fetchByCardId(cardId: string): Promise<TCGCardData | null> {
  try {
    const res = await fetch(`${TCG_BASE}/cards/${cardId}`, {
      headers: TCG_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch { return null; }
}

/** Layer 2: search by name + set name */
async function fetchBySearch(name: string, setName: string | null, cardNumber: string | null): Promise<TCGCardData | null> {
  try {
    const q = `name:"${name}"${setName ? ` set.name:"${setName}"` : ''}`;
    const res = await fetch(`${TCG_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=20`, {
      headers: TCG_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const cards: any[] = json?.data ?? [];
    if (!cards.length) return null;
    const wantedNum = (cardNumber ?? '').split('/')[0].trim();
    return wantedNum
      ? (cards.find(c => c.number?.split('/')[0]?.trim() === wantedNum) ?? cards[0])
      : cards[0];
  } catch { return null; }
}

async function resolveCardData(
  raw_rarity: string | null,
  cardId: string | null,
  name: string,
  setName: string | null,
  cardNumber: string | null,
): Promise<{ rarity: string | null; symbolUrl: string | null; marketPrice: number | null }> {
  let data: TCGCardData | null = null;

  if (cardId) data = await fetchByCardId(cardId);
  if (!data && name) data = await fetchBySearch(name, setName, cardNumber);

  return {
    rarity:      raw_rarity ?? data?.rarity ?? null,
    symbolUrl:   data?.set?.symbolUrl ?? null,
    marketPrice: bestPrice(data?.tcgplayer?.prices) ?? null,
  };
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

  // Resolve rarity + price + set symbol in parallel
  const resolved = await Promise.all(
    physical.map((item: any) =>
      resolveCardData(
        item.cards?.raw_rarity ?? null,
        item.cards?.id ?? null,
        item.cards?.name ?? '',
        item.cards?.set_name ?? null,
        item.cards?.card_number ?? null,
      )
    )
  );

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
