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
  symbolUrl: string | null;
  marketPrice: number | null;
  imageUrl: string | null;
}

interface TradeData {
  username: string;
  avatarId: number;
  contactInfo: string | null;
  totalValue: number;
  cards: TradeCard[];
}

function getRarityStyle(raw: string | null, fallback: string, name?: string, cardNumber?: string): { text: string; bg: string; label: string } | null {
  const r = (raw ?? fallback ?? '').toLowerCase();
  const n = (name ?? '').toLowerCase();

  const inferFromCardNumber = (): { text: string; bg: string; label: string } | null => {
    if (!cardNumber) return null;
    const match = cardNumber.match(/^(\d+)\/(\d+)$/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (num <= total) return null;
    const gap = num - total;
    if (gap > 20) return { text: '#EC4899', bg: 'rgba(236,72,153,0.15)', label: 'Special Illustration Rare' };
    return { text: '#A78BFA', bg: 'rgba(167,139,250,0.15)', label: 'Illustration Rare' };
  };

  const inferFromName = (): { text: string; bg: string; label: string } | null => {
    if (n.includes(' vmax')) return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'Rare VMAX' };
    if (n.includes(' vstar')) return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'Rare VSTAR' };
    if (n.includes(' ex') || n.endsWith(' ex')) return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'Ultra Rare' };
    if (n.includes(' gx')) return { text: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', label: 'Rare GX' };
    if (n.includes(' v ') || n.endsWith(' v')) return { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)', label: 'Rare V' };
    return null;
  };

  if (r.includes('secret') || r.includes('hyper'))
    return { text: '#EF4444', bg: 'rgba(239,68,68,0.15)', label: raw ?? 'Secret Rare' };
  if (r.includes('special illustration') || r.includes('special art'))
    return { text: '#EC4899', bg: 'rgba(236,72,153,0.15)', label: raw ?? 'Special Illustration Rare' };
  if (r.includes('illustration rare'))
    return { text: '#A78BFA', bg: 'rgba(167,139,250,0.15)', label: raw ?? 'Illustration Rare' };
  if (r.includes('vmax') || r.includes('vstar'))
    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: raw ?? 'Rare VMAX' };
  if (r.includes('ultra') || r.includes(' ex') || r.includes('rare ultra'))
    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: raw ?? 'Ultra Rare' };
  if (r.includes('legendary') || r.includes('full art'))
    return { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: raw ?? 'Legendary' };
  if (r.includes('holo') || r.includes('rare holo'))
    return { text: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', label: raw ?? 'Rare Holo' };
  if (r.includes('rare'))
    return { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)', label: raw ?? 'Rare' };
  if (r.includes('uncommon'))
    return { text: '#10B981', bg: 'rgba(16,185,129,0.15)', label: raw ?? 'Uncommon' };
  if (r.includes('common') || fallback === 'common' || !r) {
    const fromNumber = inferFromCardNumber();
    if (fromNumber) return fromNumber;
    const inferred = inferFromName();
    if (inferred) return inferred;
    if (!raw) return null;
  }
  if (r.includes('common'))
    return { text: '#9CA3AF', bg: 'rgba(156,163,175,0.15)', label: raw ?? 'Common' };

  const db: Record<string, { text: string; bg: string }> = {
    rare_secret: { text: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    legendary:   { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    rare_ultra:  { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    rare_holo:   { text: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
    rare:        { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    uncommon:    { text: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  };
  const s = db[fallback] ?? inferFromCardNumber() ?? inferFromName() ?? { text: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' };
  return { ...s, label: raw ?? fallback ?? '' };
}

const CONDITION_MAP: Record<string, { label: string; color: string; bg: string }> = {
  mint:              { label: 'Mint',  color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  near_mint:         { label: 'NM',    color: '#84CC16', bg: 'rgba(132,204,22,0.12)' },
  lightly_played:    { label: 'LP',    color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
  moderately_played: { label: 'MP',    color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  heavily_played:    { label: 'HP',    color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  damaged:           { label: 'DMG',   color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' },
};

function avatarLetter(username: string) {
  return username.replace(/^[^a-zA-Z]*/, '').charAt(0).toUpperCase() || username.charAt(0).toUpperCase();
}

function formatValue(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

export default function TradePage() {
  const params = useParams();
  const username = params.username as string;
  const [data, setData]       = useState<TradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [copied, setCopied]   = useState(false);
  const [shared, setShared]   = useState(false);

  useEffect(() => {
    fetch(`/api/trade/${username}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [username]);

  const filtered = data?.cards.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.setName?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function handleCopy() {
    if (!data) return;
    const lines = data.cards.map(c => {
      let l = `• ${c.name}`;
      if (c.setName) l += ` (${c.setName})`;
      if (c.rawRarity) l += ` — ${c.rawRarity}`;
      if (c.marketPrice) l += ` ~$${c.marketPrice.toFixed(2)}`;
      if (c.quantity > 1) l += ` ×${c.quantity}`;
      return l;
    });
    const valueStr = data.totalValue > 0 ? `\nEstimated value: ~${formatValue(data.totalValue)}` : '';
    const text = `@${data.username}'s trade list (${data.cards.length} cards${valueStr}):\n${lines.join('\n')}\n\n— CardQuest TCG\ncardquesttcg.app/trade/${data.username}`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function handleShare() {
    const url = `${window.location.origin}/trade/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `@${data?.username}'s Trade List — CardQuest TCG`,
          text: `Check out ${data?.username}'s Pokémon card trade list on CardQuest TCG!`,
          url,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {}
    } else {
      navigator.clipboard.writeText(url).then(() => { setShared(true); setTimeout(() => setShared(false), 2000); });
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F0B1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #6B4FBB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes cardHover { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.02); } }`}</style>
        <p style={{ color: '#9B7FEB', fontSize: 14 }}>Loading trade list…</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#0F0B1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🃏</div>
        <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Trainer Not Found</h1>
        <p style={{ color: '#9B7FEB' }}>No trade list found for <span style={{ color: '#F4A261' }}>@{username}</span></p>
        <a href="https://apps.apple.com/us/app/cardquest-tcg/id6789381374"
           style={{ display: 'inline-block', marginTop: 24, background: '#6B4FBB', color: '#fff', padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Get CardQuest TCG
        </a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0F0B1A', color: '#FFFFFF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .card-tile { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: default; }
        .card-tile:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 16px 40px rgba(107,79,187,0.35); }
        .card-tile:hover .card-img { filter: brightness(1.05); }
        .card-img { transition: filter 0.2s ease; }
        .share-btn:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <header style={{ background: '#1A1030', borderBottom: '1px solid #2D1F5E', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon.png" alt="CardQuest TCG" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#FFFFFF', letterSpacing: '0.04em' }}>
            CardQuest <span style={{ color: '#9B7FEB' }}>TCG</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={handleShare} className="share-btn"
              style={{ background: 'rgba(107,79,187,0.25)', border: '1px solid rgba(107,79,187,0.4)', color: '#C4B5FD', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {shared ? '✓ Copied!' : '🔗 Share'}
            </button>
            <a href="https://apps.apple.com/us/app/cardquest-tcg/id6789381374"
               style={{ background: '#6B4FBB', color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Download
            </a>
          </div>
        </div>
      </header>

      {/* Profile hero */}
      <div style={{ background: 'linear-gradient(to bottom, #1A1030, #0F0B1A)', borderBottom: '1px solid #2D1F5E' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg, #6B4FBB, #9B7FEB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, flexShrink: 0, boxShadow: '0 8px 24px rgba(107,79,187,0.4)' }}>
              {avatarLetter(data.username)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '0 0 2px' }}>@{data.username}</h1>
              <p style={{ color: '#9B7FEB', margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Personal Card Trade List</p>
              <p style={{ color: '#6B5FA0', margin: 0, fontSize: 13, fontStyle: 'italic' }}>
                {data.cards.length === 0
                  ? 'No physical cards listed for trade yet'
                  : `${data.cards.length} card${data.cards.length !== 1 ? 's' : ''} available for trade`}
              </p>
              {data.contactInfo && (
                <p style={{ color: '#C4B5FD', margin: '6px 0 0', fontSize: 13, fontWeight: 600 }}>
                  💬 {data.contactInfo}
                </p>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
              {data.cards.length > 0 && (
                <div style={{ background: 'rgba(107,79,187,0.15)', border: '1px solid rgba(107,79,187,0.3)', borderRadius: 14, padding: '12px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{data.cards.length}</div>
                  <div style={{ fontSize: 11, color: '#9B7FEB', fontWeight: 600, letterSpacing: '0.05em' }}>CARDS</div>
                </div>
              )}
              {data.totalValue > 0 && (
                <div style={{ background: 'rgba(107,79,187,0.15)', border: '1px solid rgba(107,79,187,0.3)', borderRadius: 14, padding: '12px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E' }}>{formatValue(data.totalValue)}</div>
                  <div style={{ fontSize: 11, color: '#9B7FEB', fontWeight: 600, letterSpacing: '0.05em' }}>EST. VALUE</div>
                </div>
              )}
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

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>

        {/* CTA banner */}
        <div style={{ marginBottom: 28, borderRadius: 20, background: 'linear-gradient(135deg, #1E1040 0%, #2A1560 50%, #1A0E38 100%)', border: '1px solid rgba(155,127,235,0.35)', overflow: 'hidden', position: 'relative' }}>
          {/* Subtle top glow line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(155,127,235,0.6), transparent)' }} />
          <div style={{ padding: '28px 28px 24px', position: 'relative' }}>
            {/* Eyebrow */}
            <p style={{ color: '#9B7FEB', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>🃏 Want in on this?</p>
            {/* Headline */}
            <h2 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.25 }}>
              Share your own trade list.<br />
              <span style={{ color: '#C4B5FD' }}>Start with 25 free packs.</span>
            </h2>
            {/* Sub-copy */}
            <p style={{ color: '#9B7FEB', fontSize: 14, margin: '0 0 22px', lineHeight: 1.6, maxWidth: 480 }}>
              CardQuest gives you a link just like this one — so other collectors can see exactly what you have available. No DMs, no guessing. Just deals.
            </p>
            {/* Feature pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {[
                { icon: '🔗', label: 'Your own shareable trade link' },
                { icon: '📦', label: '25 packs free on day one' },
                { icon: '📈', label: 'Live market prices on every card' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(107,79,187,0.18)', border: '1px solid rgba(107,79,187,0.3)', borderRadius: 999, padding: '7px 13px' }}>
                  <span style={{ fontSize: 13 }}>{f.icon}</span>
                  <span style={{ color: '#C4B5FD', fontSize: 12, fontWeight: 600 }}>{f.label}</span>
                </div>
              ))}
            </div>
            {/* CTA row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
              <a href="https://apps.apple.com/us/app/cardquest-tcg/id6789381374"
                 style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7C3AED, #6B4FBB)', color: '#fff', padding: '13px 26px', borderRadius: 999, fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: '0 6px 24px rgba(107,79,187,0.5)', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="white"><path d="M16.76 10.75c-.02-2.3 1.87-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.79-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.97.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.77 1.1 1.68 2.34 2.87 2.29 1.16-.05 1.59-.74 2.99-.74s1.79.74 3 .71c1.24-.02 2.03-1.12 2.78-2.23.88-1.28 1.24-2.52 1.26-2.58-.03-.01-2.44-.93-2.46-3.67zM14.28 3.8c.64-.78 1.07-1.87.95-2.95-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.02.08 2.07-.52 2.71-1.25z"/></svg>
                Download Free on iPhone
              </a>
              <p style={{ color: '#6B5FA0', fontSize: 12, margin: 0 }}>7-day free trial · Cancel anytime</p>
            </div>
          </div>
        </div>

        {data.cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📭</div>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Cards Listed Yet</h2>
            <p style={{ color: '#9B7FEB', marginBottom: 24 }}>This trainer hasn't added any cards to their trade list.</p>
            <a href="https://apps.apple.com/us/app/cardquest-tcg/id6789381374"
               style={{ display: 'inline-block', background: '#6B4FBB', color: '#fff', padding: '12px 24px', borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Get CardQuest TCG
            </a>
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#6B5FA0', fontSize: 16 }}>🔍</span>
              <input
                type="text"
                placeholder="Search by name or set…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: '#1A1030', border: '1px solid #2D1F5E', borderRadius: 12, padding: '13px 18px 13px 44px', fontSize: 14, color: '#FFFFFF', outline: 'none' }}
              />
            </div>

            {search && (
              <p style={{ fontSize: 12, color: '#9B7FEB', marginBottom: 16 }}>
                {filtered.length} of {data.cards.length} cards
              </p>
            )}

            {/* Card grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
              {filtered.map(card => {
                const rc = getRarityStyle(card.rawRarity, card.rarity, card.name, card.cardNumber);
                const cond = CONDITION_MAP[card.condition] ?? { label: card.condition ?? '', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
                return (
                  <div key={card.collectionId} className="card-tile"
                       style={{ background: '#1A1030', borderRadius: 16, overflow: 'hidden', border: '1px solid #2D1F5E' }}>
                    {/* Image */}
                    <div style={{ aspectRatio: '3/4', background: '#0F0B1A', position: 'relative', overflow: 'hidden' }}>
                      {card.imageUrl ? (
                        <img className="card-img" src={card.imageUrl} alt={card.name}
                             style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🃏</div>
                      )}
                      {card.quantity > 1 && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: '#6B4FBB', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
                          ×{card.quantity}
                        </div>
                      )}
                      {card.marketPrice && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', color: '#22C55E', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
                          ~${card.marketPrice.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.name}</p>

                      {/* Set name + symbol */}
                      {card.setName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                          {card.symbolUrl && (
                            <img src={card.symbolUrl} alt="" style={{ width: 14, height: 14, objectFit: 'contain', opacity: 0.8 }} />
                          )}
                          <p style={{ fontSize: 11, color: '#9B7FEB', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.setName}</p>
                        </div>
                      )}

                      {/* Rarity + Condition */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                        {rc && (
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: rc.bg, color: rc.text, fontWeight: 700, letterSpacing: '0.02em' }}>
                            {rc.label}
                          </span>
                        )}
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: cond.bg, color: cond.color, fontWeight: 700 }}>
                          {cond.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && search && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#9B7FEB' }}>
                No cards match "{search}"
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2D1F5E', marginTop: 48, padding: '40px 20px 32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <img src="/icon.png" alt="" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>CardQuest <span style={{ color: '#9B7FEB' }}>TCG</span></span>
        </div>
        <p style={{ color: '#6B5FA0', fontSize: 13, margin: '0 0 20px' }}>Track, grade, and trade your Pokémon card collection.</p>
        <a href="https://apps.apple.com/us/app/cardquest-tcg/id6789381374"
           style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(107,79,187,0.2)', border: '1px solid rgba(107,79,187,0.35)', color: '#C4B5FD', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M16.76 10.75c-.02-2.3 1.87-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.79-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.97.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.77 1.1 1.68 2.34 2.87 2.29 1.16-.05 1.59-.74 2.99-.74s1.79.74 3 .71c1.24-.02 2.03-1.12 2.78-2.23.88-1.28 1.24-2.52 1.26-2.58-.03-.01-2.44-.93-2.46-3.67zM14.28 3.8c.64-.78 1.07-1.87.95-2.95-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.02.08 2.07-.52 2.71-1.25z"/></svg>
          Download on the App Store
        </a>
      </footer>
    </div>
  );
}
