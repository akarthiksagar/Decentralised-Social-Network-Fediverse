import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Loader2,
  Plus,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import {
  getAvailableServers,
  getDefaultServer,
  mergeServers,
  normalizeServer,
  rememberServers,
  servers as configuredServers,
} from '../lib/servers';

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
  const [directoryServers, setDirectoryServers] = useState(getAvailableServers);
  const [selectedServer, setSelectedServer] = useState(getDefaultServer);
  const [healthStatus, setHealthStatus] = useState('checking');
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [newApiUrl, setNewApiUrl] = useState('');
  const [newCategory, setNewCategory] = useState('Server');
  const [isSubmittingServer, setIsSubmittingServer] = useState(false);

  const categories = useMemo(
    () => ['All', ...new Set(directoryServers.map((server) => server.category))],
    [directoryServers]
  );

  const filteredServers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return directoryServers.filter((server) => {
      const matchesCategory = category === 'All' || server.category === category;
      const matchesQuery =
        !normalizedQuery ||
        server.name.toLowerCase().includes(normalizedQuery) ||
        server.domain.toLowerCase().includes(normalizedQuery) ||
        server.description.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, directoryServers, query]);

  const continueToRegister = () => {
    if (!selectedServer) return;

    navigate(`/register?server=${encodeURIComponent(selectedServer.domain)}`, {
      state: { selectedServer },
    });
  };

  useEffect(() => {
    let isMounted = true;

    async function loadDirectory() {
      setIsLoadingDirectory(true);
      setDirectoryError('');

      try {
        const { data } = await api.get('/instances', {
          baseURL: getDefaultServer().apiUrl,
        });
        const mergedServers = rememberServers(mergeServers(data.servers || [], configuredServers));

        if (isMounted) {
          setDirectoryServers(mergedServers);
          setSelectedServer((current) =>
            current
              ? mergedServers.find((server) => server.domain === current.domain) || mergedServers[0]
              : mergedServers[0]
          );
        }
      } catch {
        if (isMounted) {
          setDirectoryServers(getAvailableServers());
          setDirectoryError('Using configured servers because the directory API is unavailable.');
        }
      } finally {
        if (isMounted) setIsLoadingDirectory(false);
      }
    }

    loadDirectory();

    return () => {
      isMounted = false;
    };
  }, []);

  const submitServer = async (event) => {
    event.preventDefault();
    const apiUrl = newApiUrl.trim();

    if (!apiUrl || isSubmittingServer) return;

    setIsSubmittingServer(true);
    setDirectoryError('');

    try {
      const { data } = await api.post(
        '/instances',
        {
          apiUrl,
          category: newCategory.trim() || 'Server',
        },
        { baseURL: getDefaultServer().apiUrl }
      );
      const submittedServer = normalizeServer(data.server);
      const mergedServers = rememberServers(mergeServers([submittedServer], directoryServers));
      setDirectoryServers(mergedServers);
      setSelectedServer(submittedServer);
      setNewApiUrl('');
      toast.success('Server added to directory');
    } catch (err) {
      setDirectoryError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to verify and add that server.'
      );
    } finally {
      setIsSubmittingServer(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      if (!selectedServer) return;
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

            {directoryError && (
              <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {directoryError}
              </div>
            )}

            <form
              onSubmit={submitServer}
              className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Plus size={18} className="text-blue-400" />
                <h2 className="font-bold text-white">Add a server</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_44px]">
                <input
                  value={newApiUrl}
                  onChange={(event) => setNewApiUrl(event.target.value)}
                  className="rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                  placeholder="https://api.your-server.com"
                />
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  className="rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
                  placeholder="Category"
                />
                <button
                  type="submit"
                  disabled={!newApiUrl.trim() || isSubmittingServer}
                  className="flex h-11 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Add server"
                >
                  {isSubmittingServer ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>
              </div>
            </form>

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
              {isLoadingDirectory ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
                  Loading server directory...
                </div>
              ) : filteredServers.length ? (
                filteredServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  selected={selectedServer?.id === server.id}
                  onSelect={setSelectedServer}
                />
                ))
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
                  No servers match your search.
                </div>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            {selectedServer && (
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
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
