import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Search,
  Server,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

const servers = [
  {
    id: 'fediverse.local',
    name: 'Fediverse Local',
    domain: 'fediverse.local',
    category: 'General',
    members: '12.4K',
    uptime: '99.98%',
    speed: 'Fast',
    registrations: 'Open',
    accent: 'bg-blue-500',
    description:
      'A balanced home server for general social posting, discovery, and federation testing.',
    rules: ['No harassment', 'No spam', 'Respect content warnings'],
  },
  {
    id: 'dev.social',
    name: 'Dev Social',
    domain: 'dev.social',
    category: 'Technology',
    members: '82K',
    uptime: '99.95%',
    speed: 'Fast',
    registrations: 'Open',
    accent: 'bg-cyan-500',
    description:
      'Software builders, open web discussions, project updates, and protocol experiments.',
    rules: ['Keep debates civil', 'No job spam', 'Credit open-source work'],
  },
  {
    id: 'mastodon.art',
    name: 'Mastodon Art',
    domain: 'mastodon.art',
    category: 'Creative',
    members: '234K',
    uptime: '99.91%',
    speed: 'Medium',
    registrations: 'Invite',
    accent: 'bg-fuchsia-500',
    description:
      'A visual-first community for artists, illustrators, designers, and creative process posts.',
    rules: ['Tag sensitive media', 'Credit artists', 'No AI spam'],
  },
  {
    id: 'social.coop',
    name: 'Social Coop',
    domain: 'social.coop',
    category: 'Community',
    members: '18.6K',
    uptime: '99.89%',
    speed: 'Medium',
    registrations: 'Open',
    accent: 'bg-emerald-500',
    description:
      'Community-owned social networking focused on cooperative governance and mutual aid.',
    rules: ['Community moderation', 'No extractive promotion', 'Use good-faith replies'],
  },
  {
    id: 'campus.space',
    name: 'Campus Space',
    domain: 'campus.space',
    category: 'Education',
    members: '41.2K',
    uptime: '99.94%',
    speed: 'Fast',
    registrations: 'Open',
    accent: 'bg-amber-500',
    description:
      'Students, research groups, teachers, and academic communities sharing public work.',
    rules: ['No plagiarism', 'Protect student privacy', 'Cite sources'],
  },
  {
    id: 'indieweb.social',
    name: 'IndieWeb Social',
    domain: 'indieweb.social',
    category: 'Indie Web',
    members: '29.7K',
    uptime: '99.93%',
    speed: 'Fast',
    registrations: 'Open',
    accent: 'bg-rose-500',
    description:
      'Personal sites, webmentions, RSS, portable identity, and small-web publishing.',
    rules: ['Own your content', 'No scraping', 'Respect personal boundaries'],
  },
];

const categories = ['All', 'General', 'Technology', 'Creative', 'Community', 'Education', 'Indie Web'];

function ServerAvatar({ server }) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${server.accent} text-white`}
    >
      <Server size={22} />
    </div>
  );
}

function ServerCard({ server, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(server)}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
      }`}
    >
      <div className="flex gap-4">
        <ServerAvatar server={server} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-white">{server.name}</h2>
              <p className="text-sm text-zinc-500">{server.domain}</p>
            </div>
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                selected ? 'bg-blue-500 text-white' : 'border border-zinc-700 text-transparent'
              }`}
            >
              <Check size={15} />
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{server.description}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <span className="rounded-md bg-black px-2 py-2 text-zinc-400">
              <strong className="block text-white">{server.members}</strong>
              members
            </span>
            <span className="rounded-md bg-black px-2 py-2 text-zinc-400">
              <strong className="block text-white">{server.uptime}</strong>
              uptime
            </span>
            <span className="rounded-md bg-black px-2 py-2 text-zinc-400">
              <strong className="block text-white">{server.registrations}</strong>
              signup
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ServerSelection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedServer, setSelectedServer] = useState(servers[0]);

  const filteredServers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return servers.filter((server) => {
      const matchesCategory = category === 'All' || server.category === category;
      const matchesQuery =
        !normalizedQuery ||
        server.name.toLowerCase().includes(normalizedQuery) ||
        server.domain.toLowerCase().includes(normalizedQuery) ||
        server.description.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const continueToRegister = () => {
    navigate(`/register?server=${encodeURIComponent(selectedServer.domain)}`, {
      state: { selectedServer },
    });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
        <nav className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white">
            <Globe size={24} className="text-blue-500" />
            <span className="text-xl font-bold">Fediverse</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
        </nav>

        <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="mb-7 max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400">
                <Sparkles size={14} />
                Choose where your identity lives
              </div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                Pick a server that matches your community.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-zinc-400">
                Your account belongs to one home server, but you can follow and talk
                with people across the whole federated network.
              </p>
            </div>

            <div className="mb-5 flex flex-col gap-3 md:flex-row">
              <label className="flex flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-500 focus-within:border-blue-500">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                  placeholder="Search by server, topic, or community"
                />
              </label>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    category === item
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  selected={selectedServer.id === server.id}
                  onSelect={setSelectedServer}
                />
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <div className="mb-5 flex items-center gap-3">
                <ServerAvatar server={selectedServer} />
                <div>
                  <h2 className="font-bold text-white">{selectedServer.name}</h2>
                  <p className="text-sm text-zinc-500">{selectedServer.domain}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-zinc-300">
                <div className="flex items-center justify-between rounded-lg bg-black px-3 py-3">
                  <span className="flex items-center gap-2 text-zinc-400">
                    <Users size={16} />
                    Members
                  </span>
                  <strong className="text-white">{selectedServer.members}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-black px-3 py-3">
                  <span className="flex items-center gap-2 text-zinc-400">
                    <Zap size={16} />
                    Speed
                  </span>
                  <strong className="text-white">{selectedServer.speed}</strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-black px-3 py-3">
                  <span className="flex items-center gap-2 text-zinc-400">
                    <Shield size={16} />
                    Uptime
                  </span>
                  <strong className="text-white">{selectedServer.uptime}</strong>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="mb-3 text-sm font-semibold text-white">Community rules</h3>
                <div className="space-y-2">
                  {selectedServer.rules.map((rule) => (
                    <div key={rule} className="flex items-center gap-2 text-sm text-zinc-400">
                      <Check size={15} className="text-emerald-400" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={continueToRegister}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 font-bold text-white transition hover:bg-blue-600"
              >
                Continue with this server
                <ArrowRight size={18} />
              </button>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
