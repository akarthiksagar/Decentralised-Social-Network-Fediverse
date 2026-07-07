import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  AtSign,
  Bell,
  Bookmark,
  Compass,
  Globe,
  Heart,
  Home as HomeIcon,
  Image,
  Loader2,
  Lock,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Search,
  Send,
  Settings,
  Share,
  Shield,
  Sparkles,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

const initialPosts = [
  {
    id: 1,
    author: 'Maya Chen',
    username: 'maya',
    server: 'social.dev',
    time: '12m',
    accent: 'bg-cyan-500',
    body:
      'Moved our moderation queue to a shared inbox today. Reports from remote instances now arrive with enough context to act quickly.',
    tags: ['ActivityPub', 'moderation'],
    replies: 18,
    reposts: 42,
    likes: 184,
  },
  {
    id: 2,
    author: 'Arun Patel',
    username: 'arun',
    server: 'indieweb.social',
    time: '37m',
    accent: 'bg-emerald-500',
    body:
      'Federation feels less abstract once you follow one person from a tiny art server and another from a huge tech server in the same feed.',
    tags: ['fediverse'],
    replies: 9,
    reposts: 21,
    likes: 96,
  },
  {
    id: 3,
    author: 'Nora Kim',
    username: 'nora',
    server: 'pixel.town',
    time: '1h',
    accent: 'bg-fuchsia-500',
    body:
      'Shipping a small profile polish pass tonight: better preview cards, softer media borders, and a cleaner remote-follow prompt.',
    tags: ['design', 'release'],
    replies: 31,
    reposts: 65,
    likes: 302,
  },
];

const navItems = [
  { label: 'Home', icon: HomeIcon, path: '/home' },
  { label: 'Explore', icon: Compass, path: '/explore' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Communities', icon: Users, path: '/communities' },
  { label: 'Bookmarks', icon: Bookmark, path: '/bookmarks' },
  { label: 'Profile', icon: User, path: '/profile' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

const trends = [
  { topic: 'ActivityPub', posts: '18.2K posts', change: '+12%' },
  { topic: 'Open source', posts: '11.7K posts', change: '+8%' },
  { topic: 'Self hosting', posts: '7.4K posts', change: '+5%' },
  { topic: 'Digital gardens', posts: '4.9K posts', change: '+3%' },
];

const suggestions = [
  { name: 'Elena Ross', handle: '@elena@mastodon.art', accent: 'bg-rose-500' },
  { name: 'Sam Rivera', handle: '@sam@fosstodon.org', accent: 'bg-amber-500' },
  { name: 'Ishan Mehta', handle: '@ishan@social.coop', accent: 'bg-indigo-500' },
];

const fallbackNotifications = [
  {
    id: 1,
    icon: Heart,
    accent: 'text-rose-400',
    title: 'Maya Chen liked your post',
    detail: 'Shipping federation without losing the small-community feel.',
    time: '8m',
  },
  {
    id: 2,
    icon: Repeat2,
    accent: 'text-emerald-400',
    title: 'Arun Patel boosted your post',
    detail: 'Remote follows are now working across test instances.',
    time: '24m',
  },
  {
    id: 3,
    icon: UserPlus,
    accent: 'text-blue-400',
    title: 'Nora Kim followed you',
    detail: '@nora@pixel.town can now see your public posts.',
    time: '1h',
  },
];

const communities = [
  {
    name: 'Fediverse Builders',
    handle: '@builders@social.dev',
    members: '24.8K',
    description: 'Protocol design, instance operations, and open social tooling.',
    accent: 'bg-cyan-500',
  },
  {
    name: 'Indie Web',
    handle: '@indieweb@indieweb.social',
    members: '18.1K',
    description: 'Personal sites, webmentions, identity, and portable publishing.',
    accent: 'bg-emerald-500',
  },
  {
    name: 'Digital Artists',
    handle: '@artists@mastodon.art',
    members: '42.5K',
    description: 'Illustration, pixel art, generative art, and creative process.',
    accent: 'bg-fuchsia-500',
  },
];

const serverDirectory = [
  { name: 'social.dev', focus: 'Software and open web', users: '82K users' },
  { name: 'mastodon.art', focus: 'Artists and visual culture', users: '234K users' },
  { name: 'fosstodon.org', focus: 'Free software community', users: '76K users' },
];

function getInitials(name = 'Guest User') {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatPostTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
}

function useCurrentUser() {
  const user = useAuthStore((state) => state.user);

  return useMemo(
    () => ({
      name: user?.name || user?.username || 'Karthik',
      username: user?.username || 'karthik',
      server: user?.server || 'fediverse.local',
      bio:
        user?.bio ||
        'Building a decentralized social network with portable identity and calmer timelines.',
    }),
    [user]
  );
}

function Avatar({ name, accent = 'bg-blue-500', size = 'h-11 w-11' }) {
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full ${accent} text-sm font-bold text-white`}
    >
      {getInitials(name)}
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

function RemoteAccountSearch({ compact = false }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const normalizedQuery = query.trim();
  const canSearch = normalizedQuery.includes('@') && normalizedQuery.length > 3;

  const searchRemoteAccount = async (event) => {
    event.preventDefault();
    if (!canSearch || isSearching) return;

    setIsSearching(true);
    setResult(null);

    try {
      const { data } = await api.get('/follows/remote/lookup', {
        params: { handle: normalizedQuery },
      });
      setResult(data.actor);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to find that remote account.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const followRemoteAccount = async () => {
    if (!result || isUpdating) return;

    setIsUpdating(true);
    try {
      const { data } = await api.post('/follows/remote', {
        actorUrl: result.actorUrl,
      });
      setResult(data.actor);
      toast.success(`Following ${data.actor.handle}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to follow that remote account.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const unfollowRemoteAccount = async () => {
    if (!result || isUpdating) return;

    setIsUpdating(true);
    try {
      await api.delete(`/follows/remote/${result.id}`);
      setResult((current) =>
        current
          ? {
              ...current,
              followingStatus: null,
            }
          : current
      );
      toast.success(`Unfollowed ${result.handle}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to unfollow that remote account.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const isFollowing = result?.followingStatus === 'PENDING' || result?.followingStatus === 'ACCEPTED';

  return (
    <section
      className={
        compact
          ? 'rounded-lg border border-zinc-800 bg-zinc-950 p-4'
          : 'border-b border-zinc-800 p-4'
      }
    >
      {!compact && <h2 className="mb-3 font-bold text-white">Remote people</h2>}
      <form onSubmit={searchRemoteAccount} className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-black px-4 py-3 text-zinc-500 focus-within:border-blue-500">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            placeholder="@username@server"
          />
        </label>
        <button
          type="submit"
          disabled={!canSearch || isSearching}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Search remote account"
        >
          {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </button>
      </form>

      {result && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-zinc-800 bg-black p-3">
          <Avatar name={result.name || result.username} accent="bg-cyan-500" size="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {result.name || result.username}
            </p>
            <p className="truncate text-xs text-zinc-500">{result.handle}</p>
            {result.followingStatus && (
              <p className="mt-1 text-xs text-blue-300">{result.followingStatus.toLowerCase()}</p>
            )}
          </div>
          <button
            type="button"
            onClick={isFollowing ? unfollowRemoteAccount : followRemoteAccount}
            disabled={isUpdating}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isFollowing
                ? 'border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-300'
                : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
            }`}
            aria-label={isFollowing ? `Unfollow ${result.handle}` : `Follow ${result.handle}`}
          >
            {isUpdating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isFollowing ? (
              <UserMinus size={16} />
            ) : (
              <UserPlus size={16} />
            )}
          </button>
        </div>
      )}
    </section>
  );
}

function FederatedSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], remoteActors: [], posts: [] });
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [updatingKey, setUpdatingKey] = useState('');

  const search = async (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data } = await api.get('/search', {
        params: { q: value, limit: 12 },
      });
      setResults({
        users: data.users || [],
        remoteActors: data.remoteActors || [],
        posts: data.posts || [],
      });

      if (data.remoteLookupError) {
        toast.error(data.remoteLookupError);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to search right now.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const followLocalUser = async (person) => {
    setUpdatingKey(`local-${person.id}`);

    try {
      await api.post(`/follows/${person.id}`);
      setResults((current) => ({
        ...current,
        users: current.users.map((item) =>
          item.id === person.id ? { ...item, followingStatus: 'ACCEPTED' } : item
        ),
      }));
      toast.success(`Following ${person.handle}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to follow that account.'
      );
    } finally {
      setUpdatingKey('');
    }
  };

  const followRemoteActor = async (person) => {
    setUpdatingKey(`remote-${person.id}`);

    try {
      const { data } = await api.post('/follows/remote', {
        actorUrl: person.actorUrl,
      });
      setResults((current) => ({
        ...current,
        remoteActors: current.remoteActors.map((item) =>
          item.id === person.id ? data.actor : item
        ),
      }));
      toast.success(`Following ${data.actor.handle}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to follow that remote account.'
      );
    } finally {
      setUpdatingKey('');
    }
  };

  const unfollowRemoteActor = async (person) => {
    setUpdatingKey(`remote-${person.id}`);

    try {
      await api.delete(`/follows/remote/${person.id}`);
      setResults((current) => ({
        ...current,
        remoteActors: current.remoteActors.map((item) =>
          item.id === person.id ? { ...item, followingStatus: null } : item
        ),
      }));
      toast.success(`Unfollowed ${person.handle}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to unfollow that remote account.'
      );
    } finally {
      setUpdatingKey('');
    }
  };

  const totalResults =
    results.users.length + results.remoteActors.length + results.posts.length;

  return (
    <section className="border-b border-zinc-800 p-4">
      <form onSubmit={search} className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-500 focus-within:border-blue-500">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
            placeholder="Search people, posts, #tags, or @user@server"
          />
        </label>
        <button
          type="submit"
          disabled={!query.trim() || isSearching}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Search"
        >
          {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </button>
      </form>

      {hasSearched && (
        <div className="mt-4 space-y-4">
          <div className="text-sm text-zinc-500">
            {isSearching ? 'Searching...' : `${totalResults} result${totalResults === 1 ? '' : 's'}`}
          </div>

          {results.users.length > 0 && (
            <SearchSection title="Local people">
              {results.users.map((person) => (
                <PersonSearchRow
                  key={person.id}
                  person={person}
                  kind="local"
                  isUpdating={updatingKey === `local-${person.id}`}
                  onAction={() => followLocalUser(person)}
                />
              ))}
            </SearchSection>
          )}

          {results.remoteActors.length > 0 && (
            <SearchSection title="Remote people">
              {results.remoteActors.map((person) => {
                const isFollowing =
                  person.followingStatus === 'PENDING' || person.followingStatus === 'ACCEPTED';
                return (
                  <PersonSearchRow
                    key={person.id}
                    person={person}
                    kind="remote"
                    isFollowing={isFollowing}
                    isUpdating={updatingKey === `remote-${person.id}`}
                    onAction={() =>
                      isFollowing ? unfollowRemoteActor(person) : followRemoteActor(person)
                    }
                  />
                );
              })}
            </SearchSection>
          )}

          {results.posts.length > 0 && (
            <SearchSection title="Posts">
              {results.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </SearchSection>
          )}
        </div>
      )}
    </section>
  );
}

function SearchSection({ title, children }) {
  return (
    <section>
      <h2 className="mb-3 font-bold text-white">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">{children}</div>
    </section>
  );
}

function PersonSearchRow({
  person,
  kind,
  isFollowing = false,
  isUpdating = false,
  onAction,
}) {
  const canFollow = kind === 'remote' || !person.followingStatus;
  const buttonLabel = isFollowing || person.followingStatus === 'ACCEPTED' ? 'Unfollow' : 'Follow';

  return (
    <div className="flex items-center gap-3 border-b border-zinc-900 p-3 last:border-b-0">
      <Avatar
        name={person.name || person.username}
        accent={kind === 'remote' ? 'bg-cyan-500' : 'bg-blue-500'}
        size="h-10 w-10"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {person.name || person.username}
        </p>
        <p className="truncate text-xs text-zinc-500">{person.handle}</p>
      </div>
      <span className="rounded-full border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
        {kind}
      </span>
      <button
        type="button"
        onClick={onAction}
        disabled={!canFollow || isUpdating}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isFollowing
            ? 'border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-300'
            : 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
        }`}
        aria-label={`${buttonLabel} ${person.handle}`}
      >
        {isUpdating ? (
          <Loader2 size={15} className="animate-spin" />
        ) : isFollowing ? (
          <UserMinus size={15} />
        ) : (
          <UserPlus size={15} />
        )}
      </button>
    </div>
  );
}

function RightRail() {
  const [people, setPeople] = useState(suggestions);

  useEffect(() => {
    let isMounted = true;

    async function loadSuggestions() {
      try {
        const { data } = await api.get('/users/suggestions');
        const users = (data.users || []).map((user, index) => ({
          ...user,
          accent: ['bg-rose-500', 'bg-amber-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500'][
            index % 5
          ],
        }));
        if (isMounted && users.length) setPeople(users);
      } catch {
        if (isMounted) setPeople(suggestions);
      }
    }

    loadSuggestions();

    return () => {
      isMounted = false;
    };
  }, []);

  const followUser = async (person) => {
    try {
      if (person.id) {
        await api.post(`/follows/${person.id}`);
      } else {
        await api.post('/follows/remote', { handle: person.handle });
      }

      setPeople((current) =>
        current.filter((item) => (person.id ? item.id !== person.id : item.handle !== person.handle))
      );
      toast.success(`Following ${person.name}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.response?.data?.error || 'Unable to follow this user.'
      );
    }
  };

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-0 space-y-4 py-4">
        <RemoteAccountSearch compact />

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-white">Trending</h2>
            <Sparkles size={18} className="text-blue-400" />
          </div>
          <div className="divide-y divide-zinc-900">
            {trends.map((trend) => (
              <button
                key={trend.topic}
                type="button"
                className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:text-blue-300"
              >
                <span>
                  <span className="block text-sm font-semibold text-white">#{trend.topic}</span>
                  <span className="text-xs text-zinc-500">{trend.posts}</span>
                </span>
                <span className="text-xs font-semibold text-emerald-400">{trend.change}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-3 font-bold text-white">Who to follow</h2>
          <div className="space-y-4">
            {people.map((person) => (
              <div key={person.handle || person.id} className="flex items-center gap-3">
                <Avatar name={person.name} accent={person.accent} size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{person.name}</p>
                  <p className="truncate text-xs text-zinc-500">{person.handle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => followUser(person)}
                  className="rounded-full border border-zinc-700 p-2 text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
                  aria-label={`Follow ${person.name}`}
                >
                  <UserPlus size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function AppShell({ children }) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useCurrentUser();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,640px)_340px]">
        <aside className="hidden border-r border-zinc-800 px-4 lg:block">
          <div className="sticky top-0 flex h-screen flex-col py-4">
            <Link to="/" className="mb-6 flex items-center gap-2 px-3 text-white">
              <Globe size={26} className="text-blue-500" />
              <span className="text-xl font-bold">Fediverse</span>
            </Link>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <NavLink
              to="/home"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-blue-500 px-5 py-3 font-bold text-white transition hover:bg-blue-600"
            >
              <Send size={17} />
              New post
            </NavLink>

            <div className="mt-auto flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <Avatar name={currentUser.name} accent="bg-blue-500" size="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{currentUser.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  @{currentUser.username}@{currentUser.server}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        <section className="min-h-screen border-x border-zinc-800 pb-16 lg:pb-0">{children}</section>

        <RightRail />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-zinc-800 bg-black/95 px-2 py-2 backdrop-blur lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex h-11 items-center justify-center rounded-lg ${
                  isActive ? 'text-blue-400' : 'text-zinc-500'
                }`
              }
              aria-label={item.label}
            >
              <Icon size={21} />
            </NavLink>
          );
        })}
      </nav>
    </main>
  );
}

function Composer({ currentUser, onPublish }) {
  const [text, setText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const remaining = 280 - text.length;

  const publish = async () => {
    const body = text.trim();
    if (!body) return;
    setIsPublishing(true);
    try {
      const didPublish = await onPublish(body);
      if (didPublish !== false) setText('');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="border-b border-zinc-800 bg-black p-4">
      <div className="flex gap-3">
        <Avatar name={currentUser.name} accent="bg-blue-500" />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 280))}
            rows={4}
            className="min-h-28 w-full resize-none bg-transparent text-lg text-white outline-none placeholder:text-zinc-600"
            placeholder="What is happening across your network?"
          />
          <div className="flex items-center justify-between border-t border-zinc-900 pt-3">
            <div className="flex items-center gap-2 text-zinc-500">
              <button
                type="button"
                className="rounded-full p-2 transition hover:bg-zinc-900 hover:text-blue-400"
                aria-label="Add image"
              >
                <Image size={19} />
              </button>
              <button
                type="button"
                className="rounded-full p-2 transition hover:bg-zinc-900 hover:text-blue-400"
                aria-label="Federation options"
              >
                <Globe size={19} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${remaining < 30 ? 'text-amber-400' : 'text-zinc-500'}`}>
                {remaining}
              </span>
              <button
                type="button"
                onClick={publish}
                disabled={!text.trim() || isPublishing}
                className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />
                {isPublishing ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PostCard({ post, initiallyBookmarked = false }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);

  return (
    <article className="border-b border-zinc-800 bg-black p-4 transition hover:bg-zinc-950">
      <div className="flex gap-3">
        <Avatar name={post.author} accent={post.accent} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="font-bold text-white">{post.author}</h2>
                <span className="truncate text-sm text-zinc-500">
                  @{post.username}@{post.server}
                </span>
                <span className="text-sm text-zinc-600">{formatPostTime(post.time)}</span>
              </div>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
              aria-label="Post options"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          <p className="mt-2 leading-relaxed text-zinc-200">{post.body}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-blue-300 transition hover:bg-zinc-800"
              >
                #{tag}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-5 text-zinc-500">
            <button
              type="button"
              className="flex items-center gap-2 text-sm transition hover:text-blue-400"
              aria-label="Reply"
            >
              <MessageCircle size={18} />
              <span>{post.replies}</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 text-sm transition hover:text-emerald-400"
              aria-label="Repost"
            >
              <Repeat2 size={18} />
              <span>{post.reposts}</span>
            </button>
            <button
              type="button"
              onClick={() => setLiked((value) => !value)}
              className={`flex items-center gap-2 text-sm transition ${
                liked ? 'text-rose-400' : 'hover:text-rose-400'
              }`}
              aria-label="Like"
            >
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
              <span>{post.likes + (liked ? 1 : 0)}</span>
            </button>
            <button
              type="button"
              onClick={() => setBookmarked((value) => !value)}
              className={`flex items-center gap-2 text-sm transition ${
                bookmarked ? 'text-blue-400' : 'hover:text-blue-400'
              }`}
              aria-label="Bookmark"
            >
              <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 text-sm transition hover:text-blue-400"
              aria-label="Share"
            >
              <Share size={18} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const currentUser = useCurrentUser();
  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [feedError, setFeedError] = useState('');
  const [feedSource, setFeedSource] = useState('home');
  const { ref: loadMoreRef, inView } = useInView({
    rootMargin: '320px 0px',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadPosts() {
      setIsLoadingPosts(true);
      setFeedError('');

      try {
        const { data } = await api.get('/timeline/home?limit=20');
        if (isMounted) {
          setPosts(data.posts || []);
          setNextCursor(data.nextCursor || null);
          setFeedSource('home');
        }
      } catch (timelineError) {
        try {
          const { data } = await api.get('/posts?limit=20');
          if (isMounted) {
            setPosts(data.posts || []);
            setNextCursor(data.nextCursor || null);
            setFeedSource('public');
            if (timelineError.response?.status === 401) {
              setFeedError('Showing the public feed because you are not logged in.');
            }
          }
        } catch {
          if (isMounted) {
            setPosts(initialPosts);
            setNextCursor(null);
            setFeedSource('sample');
            setFeedError('Showing sample posts because the feed API is unavailable.');
          }
        }
      } finally {
        if (isMounted) setIsLoadingPosts(false);
      }
    }

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!nextCursor || isLoadingMore || isLoadingPosts) return;

    setIsLoadingMore(true);

    try {
      const endpoint = feedSource === 'public' ? '/posts' : '/timeline/home';
      const { data } = await api.get(endpoint, {
        params: {
          limit: 20,
          cursor: nextCursor,
        },
      });

      setPosts((current) => {
        const seenIds = new Set(current.map((post) => post.id));
        const freshPosts = (data.posts || []).filter((post) => !seenIds.has(post.id));
        return [...current, ...freshPosts];
      });
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to load more posts right now.'
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [feedSource, isLoadingMore, isLoadingPosts, nextCursor]);

  useEffect(() => {
    if (inView) {
      loadMorePosts();
    }
  }, [inView, loadMorePosts]);

  const publishPost = async (body) => {
    try {
      const { data } = await api.post('/posts', {
        content: body,
        visibility: 'PUBLIC',
      });
      setPosts((current) => [data.post, ...current]);
      toast.success('Post published');
      return true;
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to publish post right now.'
      );
      return false;
    }
  };

  return (
    <AppShell>
      <PageHeader title="Home" subtitle="Local and federated posts" />
      <Composer currentUser={currentUser} onPublish={publishPost} />
      {feedError && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {feedError}
        </div>
      )}
      {isLoadingPosts ? (
        <div className="p-6 text-center text-sm text-zinc-500">Loading posts...</div>
      ) : posts.length ? (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <div ref={loadMoreRef} className="p-6 text-center text-sm text-zinc-500">
            {isLoadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Loading more posts...
              </span>
            ) : nextCursor ? (
              'Scroll for more posts'
            ) : (
              'You are caught up'
            )}
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <p className="font-semibold text-white">No posts yet</p>
          <p className="mt-2 text-sm text-zinc-500">Publish the first local post for this server.</p>
        </div>
      )}
    </AppShell>
  );
}

export function ExplorePage() {
  return (
    <AppShell>
      <PageHeader title="Explore" subtitle="Trends, people, and public servers" />
      <FederatedSearch />

      <section className="border-b border-zinc-800 p-4">
        <h2 className="mb-3 font-bold">Trending tags</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {trends.map((trend) => (
            <button
              key={trend.topic}
              type="button"
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-blue-500"
            >
              <span className="block font-semibold text-white">#{trend.topic}</span>
              <span className="mt-1 block text-sm text-zinc-500">{trend.posts}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="p-4">
        <h2 className="mb-3 font-bold">Server directory</h2>
        <div className="divide-y divide-zinc-900 rounded-lg border border-zinc-800 bg-zinc-950">
          {serverDirectory.map((server) => (
            <div key={server.name} className="flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                <Globe size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{server.name}</p>
                <p className="text-sm text-zinc-500">{server.focus}</p>
              </div>
              <span className="text-sm text-zinc-500">{server.users}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

export function NotificationsPage() {
  const token = useAuthStore((state) => state.token);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      setIsLoading(true);

      try {
        const { data } = await api.get('/notifications?limit=40');
        if (isMounted) {
          setItems(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        if (isMounted) {
          setItems(fallbackNotifications);
          setUnreadCount(0);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    const baseUrl = (api.defaults.baseURL || 'http://localhost:3000').replace(/\/$/, '');
    const stream = new EventSource(
      `${baseUrl}/notifications/stream?token=${encodeURIComponent(token)}`
    );

    stream.addEventListener('connected', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Ignore malformed stream metadata.
      }
    });

    stream.addEventListener('notification', (event) => {
      try {
        const notification = JSON.parse(event.data);
        setItems((current) => {
          if (current.some((item) => item.id === notification.id)) return current;
          return [notification, ...current];
        });
        setUnreadCount((current) => current + 1);
        toast.success(notification.title);
      } catch {
        // Ignore malformed notification events.
      }
    });

    return () => {
      stream.close();
    };
  }, [token]);

  const markRead = async (notification) => {
    if (notification.readAt || !notification.id) return;

    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await api.patch(`/notifications/${notification.id}/read`);
    } catch {
      toast.error('Unable to mark notification read.');
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt })));
    setUnreadCount(0);

    try {
      await api.post('/notifications/read-all');
    } catch {
      toast.error('Unable to mark notifications read.');
    }
  };

  const notificationIcon = (item) => {
    if (item.icon) return item.icon;
    if (item.type === 'FOLLOW') return UserPlus;
    if (item.type === 'ACCEPT') return User;
    if (item.type === 'POST') return MessageCircle;
    return Bell;
  };

  const notificationAccent = (item) => {
    if (item.accent) return item.accent;
    if (item.type === 'FOLLOW') return 'text-blue-400';
    if (item.type === 'ACCEPT') return 'text-emerald-400';
    if (item.type === 'POST') return 'text-cyan-400';
    return 'text-zinc-400';
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread`}
        action={
          <button
            type="button"
            onClick={markAllRead}
            disabled={!unreadCount}
            className="rounded-full border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark read
          </button>
        }
      />
      <div className="divide-y divide-zinc-800">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-zinc-500">Loading notifications...</div>
        ) : items.length ? (
          items.map((item) => {
          const Icon = notificationIcon(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => markRead(item)}
              className={`flex w-full gap-3 p-4 text-left transition hover:bg-zinc-950 ${
                item.readAt ? 'opacity-70' : ''
              }`}
            >
              <div className={`mt-1 ${notificationAccent(item)}`}>
                <Icon size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-white">{item.title}</h2>
                  <span className="text-sm text-zinc-600">
                    {formatPostTime(item.createdAt || item.time)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{item.body || item.detail}</p>
              </div>
              {!item.readAt && <span className="mt-2 h-2 w-2 rounded-full bg-blue-400" />}
            </button>
          );
        })
        ) : (
          <div className="p-8 text-center text-sm text-zinc-500">No notifications yet.</div>
        )}
      </div>
    </AppShell>
  );
}

export function CommunitiesPage() {
  return (
    <AppShell>
      <PageHeader title="Communities" subtitle="Groups and instances you may want to join" />
      <div className="divide-y divide-zinc-800">
        {communities.map((community) => (
          <article key={community.handle} className="flex gap-4 p-4 transition hover:bg-zinc-950">
            <Avatar name={community.name} accent={community.accent} size="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white">{community.name}</h2>
                  <p className="text-sm text-zinc-500">{community.handle}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-blue-500 hover:text-blue-300"
                >
                  Join
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{community.description}</p>
              <p className="mt-2 text-xs text-zinc-500">{community.members} members</p>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

export function BookmarksPage() {
  return (
    <AppShell>
      <PageHeader title="Bookmarks" subtitle="Posts saved for later" />
      {initialPosts.slice(0, 2).map((post) => (
        <PostCard key={post.id} post={post} initiallyBookmarked />
      ))}
    </AppShell>
  );
}

function FollowingPanel({ onCountChange }) {
  const [localUsers, setLocalUsers] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadFollowing() {
      setIsLoading(true);

      try {
        const { data } = await api.get('/follows/following/list');
        if (isMounted) {
          setLocalUsers(data.users || []);
          setRemoteUsers(data.remoteUsers || []);
        }
      } catch (err) {
        if (isMounted) {
          toast.error(
            err.response?.data?.message ||
              err.response?.data?.error ||
              'Unable to load following list.'
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadFollowing();

    return () => {
      isMounted = false;
    };
  }, []);

  const unfollowRemote = async (person) => {
    setRemovingId(person.id);

    try {
      await api.delete(`/follows/remote/${person.id}`);
      setRemoteUsers((current) => current.filter((item) => item.id !== person.id));
      toast.success(`Unfollowed ${person.handle}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to unfollow that account.'
      );
    } finally {
      setRemovingId('');
    }
  };

  const unfollowLocal = async (person) => {
    setRemovingId(person.id);

    try {
      await api.delete(`/follows/${person.id}`);
      setLocalUsers((current) => current.filter((item) => item.id !== person.id));
      toast.success(`Unfollowed @${person.username}@${person.server}`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Unable to unfollow that account.'
      );
    } finally {
      setRemovingId('');
    }
  };

  const rows = useMemo(
    () => [
      ...remoteUsers.map((person) => ({ ...person, kind: 'remote' })),
      ...localUsers.map((person) => ({
        ...person,
        kind: 'local',
        handle: `@${person.username}@${person.server}`,
      })),
    ],
    [localUsers, remoteUsers]
  );

  useEffect(() => {
    onCountChange?.(rows.length);
  }, [onCountChange, rows.length]);

  return (
    <section className="border-b border-zinc-800 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-white">Following</h2>
        <span className="text-sm text-zinc-500">{rows.length} accounts</span>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
          Loading follows...
        </div>
      ) : rows.length ? (
        <div className="divide-y divide-zinc-900 rounded-lg border border-zinc-800 bg-zinc-950">
          {rows.map((person) => (
            <div key={`${person.kind}-${person.id}`} className="flex items-center gap-3 p-3">
              <Avatar
                name={person.name || person.username}
                accent={person.kind === 'remote' ? 'bg-cyan-500' : 'bg-blue-500'}
                size="h-10 w-10"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {person.name || person.username}
                </p>
                <p className="truncate text-xs text-zinc-500">{person.handle}</p>
              </div>
              <span className="rounded-full border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                {person.kind}
              </span>
              <button
                type="button"
                onClick={() =>
                  person.kind === 'remote' ? unfollowRemote(person) : unfollowLocal(person)
                }
                disabled={removingId === person.id}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-red-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Unfollow ${person.handle}`}
              >
                {removingId === person.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <UserMinus size={15} />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
          Follow a remote account from Explore to build your network.
        </div>
      )}
    </section>
  );
}

export function ProfilePage() {
  const currentUser = useCurrentUser();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [followingCount, setFollowingCount] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [form, setForm] = useState({
    name: currentUser.name,
    username: currentUser.username,
    bio: currentUser.bio,
  });

  const openEditor = () => {
    setForm({
      name: currentUser.name,
      username: currentUser.username,
      bio: currentUser.bio,
    });
    setEditError('');
    setIsEditing(true);
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setEditError('');
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const username = form.username.trim().replace(/^@/, '').toLowerCase();

    if (!form.name.trim() || !username) {
      setEditError('Display name and username are required.');
      return;
    }

    setIsSaving(true);
    setEditError('');

    try {
      const { data } = await api.patch('/auth/me', {
        name: form.name.trim(),
        username,
        bio: form.bio.trim(),
      });
      updateUser(data.user);
      toast.success('Profile updated');
      setIsEditing(false);
    } catch (err) {
      setEditError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Unable to update profile right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <section className="border-b border-zinc-800">
        <div className="h-36 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />
        <div className="px-4 pb-5">
          <div className="-mt-10 flex items-end justify-between gap-4">
            <Avatar name={currentUser.name} accent="bg-blue-500" size="h-20 w-20" />
            <button
              type="button"
              onClick={openEditor}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-blue-500 hover:text-blue-300"
            >
              Edit profile
            </button>
          </div>
          <h1 className="mt-4 text-2xl font-bold">{currentUser.name}</h1>
          <p className="text-sm text-zinc-500">
            @{currentUser.username}@{currentUser.server}
          </p>
          <p className="mt-3 max-w-xl leading-relaxed text-zinc-300">{currentUser.bio}</p>
          <div className="mt-4 flex gap-6 text-sm">
            <span>
              <strong className="text-white">128</strong> <span className="text-zinc-500">posts</span>
            </span>
            <span>
              <strong className="text-white">
                {followingCount === null ? '...' : followingCount}
              </strong>{' '}
              <span className="text-zinc-500">following</span>
            </span>
            <span>
              <strong className="text-white">1.8K</strong>{' '}
              <span className="text-zinc-500">followers</span>
            </span>
          </div>
        </div>
      </section>

      <FollowingPanel onCountChange={setFollowingCount} />

      <PostCard
        post={{
          ...initialPosts[0],
          id: 'profile-post',
          author: currentUser.name,
          username: currentUser.username,
          server: currentUser.server,
          accent: 'bg-blue-500',
          time: '2h',
          body:
            'Working through the frontend first: feed, discovery, notifications, communities, profile, and settings. Backend federation can land behind these surfaces cleanly.',
          tags: ['buildinpublic', 'fediverse'],
          replies: 4,
          reposts: 7,
          likes: 39,
        }}
      />

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <form
            onSubmit={saveProfile}
            className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-blue-950/20"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Edit profile</h2>
                <p className="text-sm text-zinc-500">
                  @{form.username.trim().replace(/^@/, '').toLowerCase() || 'username'}@
                  {currentUser.server}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
                aria-label="Close edit profile"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Display name</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
                  placeholder="Your display name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Username</span>
                <input
                  name="username"
                  value={form.username}
                  onChange={updateField}
                  className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
                  placeholder="username"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Bio</span>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={updateField}
                  rows={4}
                  maxLength={240}
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
                  placeholder="Tell people what you are building or sharing."
                />
                <span className="mt-2 block text-right text-xs text-zinc-500">
                  {form.bio.length}/240
                </span>
              </label>
            </div>

            {editError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {editError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg border border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

export function SettingsPage() {
  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Account, privacy, and federation preferences" />
      <div className="space-y-4 p-4">
        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex items-center gap-3">
            <AtSign size={20} className="text-blue-400" />
            <h2 className="font-bold">Identity</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Display name</span>
              <input
                className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-white outline-none focus:border-blue-500"
                defaultValue="Karthik"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-400">Username</span>
              <input
                className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-white outline-none focus:border-blue-500"
                defaultValue="karthik"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex items-center gap-3">
            <Shield size={20} className="text-emerald-400" />
            <h2 className="font-bold">Safety</h2>
          </div>
          {[
            { label: 'Require approval for follow requests', checked: true },
            { label: 'Hide boosts from unknown servers', checked: false },
            { label: 'Filter media from new accounts', checked: true },
          ].map((setting) => (
            <label
              key={setting.label}
              className="flex items-center justify-between border-t border-zinc-900 py-3 first:border-t-0 first:pt-0"
            >
              <span className="text-sm text-zinc-300">{setting.label}</span>
              <input
                type="checkbox"
                defaultChecked={setting.checked}
                className="h-4 w-4 rounded border-zinc-700 bg-black text-blue-500 focus:ring-blue-500"
              />
            </label>
          ))}
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex items-center gap-3">
            <Lock size={20} className="text-amber-400" />
            <h2 className="font-bold">Post visibility</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {['Public', 'Followers', 'Mentioned'].map((option) => (
              <button
                key={option}
                type="button"
                className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                  option === 'Public'
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-600 hover:text-white'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
