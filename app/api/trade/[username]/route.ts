import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Fetch the rarity string for a card directly from the Pokemon TCG API. */
async function fetchRarityFromTCGApi(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
      next: { revalidate: 86400 }, // cache 24 hours
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.rarity ?? null;
  } catch {
    return null;
  }
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

  // 2. Fetch their for_trade physical cards (exclude pack pull simulations)
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

  // 3. For cards missing raw_rarity, look them up from the TCG API in parallel
  const rarityLookups = await Promise.all(
    physical.map(async (item: any) => {
      if (item.cards?.raw_rarity) return item.cards.raw_rarity;
      if (item.cards?.id) return fetchRarityFromTCGApi(item.cards.id);
      return null;
    })
  );

  // 4. Flatten with resolved rarities and image URLs
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
