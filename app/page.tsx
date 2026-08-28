import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
      <img src="/icon.png" alt="CardQuest TCG" className="w-24 h-24 rounded-2xl mb-6 shadow-lg" />
      <h1 className="text-3xl font-bold mb-2">CardQuest <span className="text-purple-400">TCG</span></h1>
      <p className="text-gray-400 mb-8 max-w-sm">
        The premium Pokémon TCG collection tracker. Track, grade, and trade your cards.
      </p>
      <a
        href="https://apps.apple.com/us/app/cardquest-tcg/id6745005042"
        className="bg-purple-700 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-600 transition-colors shadow-lg shadow-purple-700/40"
      >
        Download on the App Store
      </a>
    </div>
  );
}
