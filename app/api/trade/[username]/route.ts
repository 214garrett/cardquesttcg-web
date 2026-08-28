import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // 1. Look up the user by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, avatar_id')
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

  const flat = (cards ?? [])
    .filter((item: any) => item.cards?.source !== 'pack_pull')
    .map((item: any) => {
    // Construct image URL from card ID if image_url not stored
    // TCG API card IDs look like "sv1-1" → images.pokemontcg.io/sv1/1.png
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
      rawRarity:    item.cards?.raw_rarity ?? null,
      imageUrl,
    };
  });

  return NextResponse.json({
    username: profile.username,
    avatarId: profile.avatar_id,
    cards: flat,
  });
}
