import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl font-black mb-6 shadow-lg shadow-orange-500/30">
        C
      </div>
      <h1 className="text-3xl font-bold mb-2">CardQuest TCG</h1>
      <p className="text-gray-400 mb-8 max-w-sm">
        The premium Pokémon TCG collection tracker. Track, grade, and trade your cards.
      </p>
      <a
        href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
        className="bg-orange-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/25"
      >
        Download on the App Store
      </a>
    </div>
  );
}
