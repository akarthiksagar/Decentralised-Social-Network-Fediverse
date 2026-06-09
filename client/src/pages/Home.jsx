import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bookmark,
  Compass,
  Globe,
  Heart,
  Home as HomeIcon,
  Image,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Search,
  Send,
  Settings,
  Share,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
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
      'Moved our moderation queue to a shared inbox today. The best part is watching reports from remote instances arrive with enough context to act quickly.',
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
  { label: 'Home', icon: HomeIcon, active: true },
  { label: 'Explore', icon: Compass },
  { label: 'Notifications', icon: Bell },
  { label: 'Communities', icon: Users },
  { label: 'Bookmarks', icon: Bookmark },
  { label: 'Settings', icon: Settings },
];

const trends = [
  { topic: 'ActivityPub', posts: '18.2K posts' },
  { topic: 'Open source', posts: '11.7K posts' },
  { topic: 'Self hosting', posts: '7.4K posts' },
  { topic: 'Digital gardens', posts: '4.9K posts' },
];

const suggestions = [
  { name: 'Elena Ross', handle: '@elena@mastodon.art', accent: 'bg-rose-500' },
  { name: 'Sam Rivera', handle: '@sam@fosstodon.org', accent: 'bg-amber-500' },
  { name: 'Ishan Mehta', handle: '@ishan@social.coop', accent: 'bg-indigo-500' },
];

function getInitials(name = 'Guest User') {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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

function SidebarItem({ item }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
        item.active
          ? 'bg-blue-500 text-white'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span>{item.label}</span>
    </button>
  );
}

function Composer({ currentUser, onPublish }) {
  const [text, setText] = useState('');
  const remaining = 280 - text.length;

  const publish = () => {
    const body = text.trim();
    if (!body) return;
    onPublish(body);
    setText('');
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
                disabled={!text.trim()}
                className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={16} />
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PostCard({ post }) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

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
                <span className="text-sm text-zinc-600">{post.time}</span>
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

function RightRail() {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-0 space-y-4 py-4">
        <label className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-500 focus-within:border-blue-500">
          <Search size={18} />
          <input
            type="search"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
            placeholder="Search Fediverse"
          />
        </label>

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
                <MoreHorizontal size={16} className="text-zinc-600" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-3 font-bold text-white">Who to follow</h2>
          <div className="space-y-4">
            {suggestions.map((person) => (
              <div key={person.handle} className="flex items-center gap-3">
                <Avatar name={person.name} accent={person.accent} size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{person.name}</p>
                  <p className="truncate text-xs text-zinc-500">{person.handle}</p>
                </div>
                <button
                  type="button"
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

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useMemo(
    () => ({
      name: user?.name || user?.username || 'Karthik',
      username: user?.username || 'karthik',
      server: user?.server || 'fediverse.local',
    }),
    [user]
  );
  const [posts, setPosts] = useState(initialPosts);

  const publishPost = (body) => {
    setPosts((current) => [
      {
        id: Date.now(),
        author: currentUser.name,
        username: currentUser.username,
        server: currentUser.server,
        time: 'now',
        accent: 'bg-blue-500',
        body,
        tags: ['local'],
        replies: 0,
        reposts: 0,
        likes: 0,
      },
      ...current,
    ]);
    toast.success('Post added to your local feed');
  };

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
              {navItems.map((item) => (
                <SidebarItem key={item.label} item={item} />
              ))}
            </nav>

            <button
              type="button"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-blue-500 px-5 py-3 font-bold text-white transition hover:bg-blue-600"
            >
              <Send size={17} />
              New post
            </button>

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

        <section className="min-h-screen border-x border-zinc-800">
          <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">Home</h1>
                <p className="text-sm text-zinc-500">Local and federated posts</p>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  className="rounded-full border border-zinc-800 p-2 text-zinc-400"
                  aria-label="Search"
                >
                  <Search size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-zinc-800 p-2 text-zinc-400"
                  aria-label="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </header>

          <Composer currentUser={currentUser} onPublish={publishPost} />

          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>

        <RightRail />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-zinc-800 bg-black/95 px-2 py-2 backdrop-blur lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={`flex h-11 items-center justify-center rounded-lg ${
                item.active ? 'text-blue-400' : 'text-zinc-500'
              }`}
              aria-label={item.label}
            >
              <Icon size={21} />
            </button>
          );
        })}
      </nav>
    </main>
  );
}
