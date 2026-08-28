'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

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

// Maps raw TCG API rarity strings to display colors
function getRarityStyle(raw: string | null, fallback: string): { text: string; bg: string; label: string } {
  const r = (raw ?? fallback ?? '').toLowerCase();
  if (r.includes('secret') || r.includes('hyper'))
    return { text: '#EF4444', bg: 'rgba(239,68,68,0.15)', label: raw ?? 'Secret Rare' };
  if (r.includes('special illustration') || r.includes('special art'))
    return { text: '#EC4899', bg: 'rgba(236,72,153,0.15)', label: raw ?? 'Special Illustration Rare' };
  if (r.includes('illustration rare'))
    return { text: '#A78BFA', bg: 'rgba(167,139,250,0.15)', label: raw ?? 'Illustration Rare' };
  if (r.includes('vmax') || r.includes('vstar'))
    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: raw ?? 'Rare VMAX' };
  if (r.includes('ultra') || r.includes(' ex') || r.includes('vex') || r.includes('rare ultra'))
    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: raw ?? 'Ultra Rare' };
  if (r.includes('legendary') || r.includes('full art'))
    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: raw ?? 'Legendary' };
  if (r.includes('holo') || r.includes('rare holo'))
    return { text: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', label: raw ?? 'Rare Holo' };
  if (r.includes('rare'))
    return { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)', label: raw ?? 'Rare' };
  if (r.includes('uncommon'))
    return { text: '#10B981', bg: 'rgba(16,185,129,0.15)', label: raw ?? 'Uncommon' };
  if (r.includes('common'))
    return { text: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', label: raw ?? 'Common' };
  // Fallback to the db rarity
  const db: Record<string, { text: string; bg: string }> = {
    rare_secret: { text: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    legendary:   { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    rare_ultra:  { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    rare_holo:   { text: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
    rare:        { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    uncommon:    { text: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  };
  const s = db[fallback] ?? { text: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' };
  return { ...s, label: raw ?? fallback ?? '' };
}

const CONDITION_COLORS: Record<string, string> = {
  mint:              '#22C55E',
  near_mint:         '#84CC16',
  lightly_played:    '#EAB308',
  moderately_played: '#F97316',
  heavily_played:    '#EF4444',
  damaged:           '#9CA3AF',
};

function rarityLabel(rarity: string) {
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function conditionLabel(condition: string) {
  const map: Record<string, string> = {
    mint: 'Mint', near_mint: 'NM', lightly_played: 'LP',
    moderately_played: 'MP', heavily_played: 'HP', damaged: 'DMG',
  };
  return map[condition] ?? condition ?? '';
}

function avatarLetter(username: string) {
  return username.replace(/^[^a-zA-Z]*/, '').charAt(0).toUpperCase() || username.charAt(0).toUpperCase();
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
    const text = `${data.username}'s trade list:\n${lines.join('\n')}\n\n— CardQuest TCG 🃏`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0B1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #6B4FBB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#9B7FEB', fontSize: 14 }}>Loading trade list…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0B1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🃏</div>
          <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Trainer Not Found</h1>
          <p style={{ color: '#9B7FEB' }}>No trade list found for <span style={{ color: '#F4A261' }}>@{username}</span></p>
          <a href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
             style={{ display: 'inline-block', marginTop: 24, background: '#6B4FBB', color: '#fff', padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Get CardQuest TCG
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F0B1A', color: '#FFFFFF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#1A1030', borderBottom: '1px solid #2D1F5E', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6B4FBB, #9B7FEB)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff' }}>C</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#9B7FEB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CardQuest TCG</span>
          <div style={{ marginLeft: 'auto' }}>
            <a href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
               style={{ background: '#6B4FBB', color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Download App
            </a>
          </div>
        </div>
      </header>

      {/* Profile hero */}
      <div style={{ background: 'linear-gradient(to bottom, #1A1030, #0F0B1A)', borderBottom: '1px solid #2D1F5E' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #6B4FBB, #9B7FEB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, flexShrink: 0, boxShadow: '0 8px 24px rgba(107,79,187,0.4)' }}>
              {avatarLetter(data.username)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '0 0 2px' }}>@{data.username}</h1>
              <p style={{ color: '#9B7FEB', margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Personal Card Trade List</p>
              <p style={{ color: '#6B5FA0', margin: 0, fontSize: 13, fontStyle: 'italic' }}>
                {data.cards.length === 0
                  ? 'No physical cards listed for trade yet'
                  : `Physical cards @${data.username} is looking to trade`}
              </p>
            </div>
            {data.cards.length > 0 && (
              <button onClick={handleCopy}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: copied ? '#22C55E22' : '#2D1F5E', border: `1px solid ${copied ? '#22C55E' : '#4A2F9A'}`, color: copied ? '#22C55E' : '#C4B5FD', fontSize: 14, padding: '10px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>
                {copied ? '✓ Copied!' : '📋 Copy List'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* CTA banner — always at top */}
        <div style={{ marginBottom: 24, borderRadius: 16, background: 'linear-gradient(135deg, rgba(107,79,187,0.2), rgba(107,79,187,0.05))', border: '1px solid rgba(107,79,187,0.3)', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Want to trade with {data.username}?</p>
            <p style={{ color: '#9B7FEB', fontSize: 13, margin: 0 }}>Download CardQuest TCG to manage your collection and share your own trade list.</p>
          </div>
          <a href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
             style={{ flexShrink: 0, display: 'inline-block', background: 'linear-gradient(135deg, #6B4FBB, #9B7FEB)', color: '#fff', padding: '11px 22px', borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(107,79,187,0.4)', whiteSpace: 'nowrap' }}>
            Download App
          </a>
        </div>

        {data.cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
            <p style={{ color: '#9B7FEB' }}>This trainer hasn't listed any cards for trade yet.</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <input
              type="text"
              placeholder="Search by name or set…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: '#1A1030', border: '1px solid #2D1F5E', borderRadius: 12, padding: '13px 18px', fontSize: 14, color: '#FFFFFF', outline: 'none', marginBottom: 20 }}
            />

            {search && (
              <p style={{ fontSize: 12, color: '#9B7FEB', marginBottom: 16 }}>
                {filtered.length} of {data.cards.length} cards
              </p>
            )}

            {/* Card grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {filtered.map((card) => {
                const rc = getRarityStyle(card.rawRarity, card.rarity);
                const cc = CONDITION_COLORS[card.condition] ?? '#9CA3AF';
                return (
                  <div key={card.collectionId}
                       style={{ background: '#1A1030', borderRadius: 16, overflow: 'hidden', border: '1px solid #2D1F5E' }}>
                    {/* Card image */}
                    <div style={{ aspectRatio: '3/4', background: '#0F0B1A', position: 'relative', overflow: 'hidden' }}>
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🃏</div>
                      )}
                      {card.quantity > 1 && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: '#6B4FBB', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
                          ×{card.quantity}
                        </div>
                      )}
                    </div>

                    {/* Card info */}
                    <div style={{ padding: '12px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.name}</p>
                      {card.setName && (
                        <p style={{ fontSize: 11, color: '#9B7FEB', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.setName}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                        {card.rarity && (
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: rc.bg, color: rc.text, fontWeight: 600 }}>
                            {rc.label}
                          </span>
                        )}
                        {card.condition && (
                          <span style={{ fontSize: 11, color: cc, fontWeight: 600 }}>{conditionLabel(card.condition)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && search && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9B7FEB' }}>No cards match "{search}"</div>
            )}
          </>
        )}

      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2D1F5E', marginTop: 32 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#4A3A7A' }}>
          <p style={{ margin: 0 }}>© 2026 CardQuest TCG. All rights reserved.</p>
          <p style={{ margin: 0 }}>Powered by <span style={{ color: '#9B7FEB' }}>cardquesttcg.app</span></p>
        </div>
      </footer>
    </div>
  );
}
