import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import api from '../lib/axios';
import { categories, servers } from '../lib/servers';

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
          <p className="mt-2 truncate text-xs text-zinc-500">API: {server.apiUrl}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <span className="rounded-md bg-black px-2 py-2 text-zinc-400">
              <strong className="block text-white">{server.registrations}</strong>
              registration
            </span>
            <span className="rounded-md bg-black px-2 py-2 text-zinc-400">
              <strong className="block text-white">{server.category}</strong>
              category
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
  const [healthStatus, setHealthStatus] = useState('checking');

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

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      setHealthStatus('checking');

      try {
        await api.get('/health', { baseURL: selectedServer.apiUrl });
        if (isMounted) setHealthStatus('online');
      } catch {
        if (isMounted) setHealthStatus('offline');
      }
    }

    checkHealth();

    return () => {
      isMounted = false;
    };
  }, [selectedServer]);

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
                  <p className="text-xs text-zinc-600">{selectedServer.apiUrl}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-zinc-300">
                <div className="flex items-center justify-between rounded-lg bg-black px-3 py-3">
                  <span className="text-zinc-400">API health</span>
                  <strong
                    className={
                      healthStatus === 'online'
                        ? 'text-emerald-300'
                        : healthStatus === 'offline'
                          ? 'text-red-300'
                          : 'text-zinc-300'
                    }
                  >
                    {healthStatus}
                  </strong>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-black px-3 py-3">
                  <span className="text-zinc-400">Registration</span>
                  <strong className="text-white">{selectedServer.registrations}</strong>
                </div>
              </div>

              {selectedServer.rules.length > 0 && (
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
              )}

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
