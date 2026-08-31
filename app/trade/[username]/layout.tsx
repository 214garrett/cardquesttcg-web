import { Metadata } from 'next';

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cardquesttcg-web.vercel.app'}/api/trade/${username}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const count = data.cards?.length ?? 0;
    const value = data.totalValue > 0 ? ` • ~$${data.totalValue.toFixed(0)} value` : '';
    const description = count > 0
      ? `${count} card${count !== 1 ? 's' : ''} available for trade${value}`
      : 'No cards listed for trade yet';

    return {
      title: `@${data.username}'s Trade List — CardQuest TCG`,
      description,
      openGraph: {
        title: `@${data.username}'s Trade List`,
        description,
        siteName: 'CardQuest TCG',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: `@${data.username}'s Trade List — CardQuest TCG`,
        description,
      },
    };
  } catch {
    return {
      title: 'Trade List — CardQuest TCG',
      description: 'View and trade Pokémon cards on CardQuest TCG',
    };
  }
}

export default function TradeLayout({ children }: Props) {
  return <>{children}</>;
}
