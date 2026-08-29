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

/** Layer 1: direct card ID lookup */
async function rarityById(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(`${TCG_BASE}/cards/${cardId}`, {
      headers: TCG_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.rarity ?? null;
  } catch { return null; }
}

/** Layer 2: search by name + set name, pick best match by card number */
async function rarityBySearch(name: string, setName: string | null, cardNumber: string | null): Promise<string | null> {
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

    // Pick the card whose number matches, or fall back to first result
    const wantedNum = (cardNumber ?? '').split('/')[0].trim();
    const match = wantedNum
      ? cards.find(c => c.number?.split('/')[0]?.trim() === wantedNum) ?? cards[0]
      : cards[0];
    return match?.rarity ?? null;
  } catch { return null; }
}

/** Resolve rarity using all available sources in order */
async function resolveRarity(
  raw_rarity: string | null,
  cardId: string | null,
  name: string,
  setName: string | null,
  cardNumber: string | null,
): Promise<string | null> {
  // Layer 1: already stored
  if (raw_rarity) return raw_rarity;
  // Layer 2: direct ID lookup
  if (cardId) {
    const byId = await rarityById(cardId);
    if (byId) return byId;
  }
  // Layer 3: search by name + set
  if (name) {
    const bySearch = await rarityBySearch(name, setName, cardNumber);
    if (bySearch) return bySearch;
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // 1. Look up the user by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, avatar_id, contact_info')
    .ilike('username', username)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 2. Fetch their for_trade physical cards
  const { data: cards, error: cardsError } = await supabase
    .from('collection')
    .select(`
      id,
      quantity,
      condition,
      cards (
        id,
        name,
        set_name,
        card_number,
        rarity,
        raw_rarity,
        image_url,
        source
      )
    `)
    .eq('user_id', profile.id)
    .eq('for_trade', true)
    .order('id', { ascending: true });

  if (cardsError) {
    return NextResponse.json({ error: cardsError.message }, { status: 500 });
  }

  const physical = (cards ?? []).filter(
    (item: any) => item.cards?.source !== 'pack_pull'
  );

  // 3. Resolve rarity for each card using 3-layer fallback (parallel)
  const rarityLookups = await Promise.all(
    physical.map((item: any) =>
      resolveRarity(
        item.cards?.raw_rarity ?? null,
        item.cards?.id ?? null,
        item.cards?.name ?? '',
        item.cards?.set_name ?? null,
        item.cards?.card_number ?? null,
      )
    )
  );

  // 4. Flatten
  const flat = physical.map((item: any, i: number) => {
    let imageUrl = item.cards?.image_url ?? null;
    if (!imageUrl && item.cards?.id) {
      const parts = item.cards.id.split('-');
      if (parts.length >= 2) {
        const setId = parts[0];
        const num = parts.slice(1).join('-');
        imageUrl = `https://images.pokemontcg.io/${setId}/${num}_hires.png`;
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
      rawRarity:    rarityLookups[i] ?? null,
      imageUrl,
    };
  });

  return NextResponse.json({
    username:    profile.username,
    avatarId:    profile.avatar_id,
    contactInfo: profile.contact_info ?? null,
    cards: flat,
  });
}
