'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

interface TradeCard {
  collectionId: string;
  quantity: number;
  condition: string;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  rawRarity: string | null;
  imageUrl: string | null;
}

interface TradeData {
  username: string;
  avatarId: number;
  cards: TradeCard[];
}

const RARITY_COLORS: Record<string, string> = {
  common:         '#9CA3AF',
  uncommon:       '#34D399',
  rare:           '#60A5FA',
  rare_holo:      '#818CF8',
  rare_holo_ex:   '#F472B6',
  rare_ultra:     '#F59E0B',
  rare_secret:    '#EF4444',
  legendary:      '#F59E0B',
  special:        '#A78BFA',
};

function rarityLabel(rarity: string) {
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function rarityColor(rarity: string) {
  return RARITY_COLORS[rarity?.toLowerCase()] ?? '#9CA3AF';
}

function conditionLabel(condition: string) {
  const map: Record<string, string> = {
    mint: 'Mint', near_mint: 'Near Mint', lightly_played: 'Lightly Played',
    moderately_played: 'Mod. Played', heavily_played: 'Heavily Played', damaged: 'Damaged',
  };
  return map[condition] ?? condition ?? 'Unknown';
}

export default function TradePage() {
  const params = useParams();
  const username = params.username as string;
  const [data, setData] = useState<TradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/trade/${username}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); } else { setData(d); }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [username]);

  const filtered = data?.cards.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.setName?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function handleCopy() {
    if (!data) return;
    const lines = data.cards.map((c) => {
      let l = `• ${c.name}`;
      if (c.setName) l += ` (${c.setName})`;
      if (c.rarity) l += ` — ${rarityLabel(c.rarity)}`;
      if (c.quantity > 1) l += ` ×${c.quantity}`;
      return l;
    });
    const text = `${data.username}'s trade list:\n${lines.join('\n')}\n\nSent from CardQuest TCG 🃏`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading trade list…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🃏</div>
          <h1 className="text-xl font-bold text-white mb-2">Trainer Not Found</h1>
          <p className="text-gray-400">No trade list found for <span className="text-orange-400">@{username}</span></p>
          <a href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
             className="mt-6 inline-block bg-orange-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-400 transition-colors">
            Get CardQuest TCG
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 relative flex-shrink-0">
            {/* CardQuest logo mark */}
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-sm font-black">C</div>
          </div>
          <span className="text-sm font-semibold text-gray-400 tracking-wide uppercase">CardQuest TCG</span>
          <div className="ml-auto">
            <a href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
               className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-full font-semibold hover:bg-orange-400 transition-colors">
              Download App
            </a>
          </div>
        </div>
      </header>

      {/* Profile hero */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-2xl font-black flex-shrink-0 shadow-lg shadow-orange-500/20 uppercase">
              {data.username.replace(/^[^a-zA-Z]*/, '').charAt(0).toUpperCase() || data.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">@{data.username}</h1>
              <p className="text-gray-400 mt-0.5">
                {data.cards.length === 0
                  ? 'No cards listed for trade yet'
                  : `${data.cards.length} card${data.cards.length !== 1 ? 's' : ''} available for trade`}
              </p>
            </div>
            {data.cards.length > 0 && (
              <button
                onClick={handleCopy}
                className="flex-shrink-0 flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-white px-4 py-2.5 rounded-xl transition-colors font-medium">
                {copied ? '✓ Copied!' : '📋 Copy List'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {data.cards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-400">This trainer hasn't listed any cards for trade yet.</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-5">
              <input
                type="text"
                placeholder="Search by name or set…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Count */}
            {search && (
              <p className="text-xs text-gray-500 mb-4">
                {filtered.length} of {data.cards.length} cards
              </p>
            )}

            {/* Card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((card) => (
                <div key={card.collectionId}
                     className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-colors group">
                  {/* Card image */}
                  <div className="aspect-[3/4] bg-gray-800 relative overflow-hidden">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🃏</div>
                    )}
                    {/* Quantity badge */}
                    {card.quantity > 1 && (
                      <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        ×{card.quantity}
                      </div>
                    )}
                  </div>

                  {/* Card info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white leading-tight line-clamp-2 mb-1">{card.name}</p>
                    {card.setName && (
                      <p className="text-xs text-gray-500 truncate mb-2">{card.setName}</p>
                    )}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      {card.rarity && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: rarityColor(card.rarity) + '22', color: rarityColor(card.rarity) }}>
                          {rarityLabel(card.rarity)}
                        </span>
                      )}
                      {card.condition && (
                        <span className="text-xs text-gray-500">{conditionLabel(card.condition)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && search && (
              <div className="text-center py-12 text-gray-500">No cards match "{search}"</div>
            )}
          </>
        )}

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 p-6 text-center">
          <p className="text-white font-semibold mb-1">Want to trade with {data.username}?</p>
          <p className="text-gray-400 text-sm mb-4">Download CardQuest TCG to manage your collection and share your own trade list.</p>
          <a href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
             className="inline-block bg-orange-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/25">
            Download on the App Store
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <p>© 2026 CardQuest TCG. All rights reserved.</p>
          <p>Powered by <span className="text-orange-500">cardquesttcg.app</span></p>
        </div>
      </footer>
    </div>
  );
}
