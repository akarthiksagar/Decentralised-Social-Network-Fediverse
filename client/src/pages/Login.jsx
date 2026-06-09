import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Globe, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

function getAuthPayload(data) {
  return {
    user: data.user || data.data?.user || null,
    token: data.token || data.accessToken || data.data?.token || data.data?.accessToken || null,
  };
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', {
        email: form.email.trim(),
        password: form.password,
      });
      const { user, token } = getAuthPayload(data);

      if (!token) {
        throw new Error('Login succeeded but no token was returned.');
      }

      setAuth(user, token);
      toast.success('Welcome back');
      navigate('/home');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Unable to log in right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
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

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_440px]">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400">
              <Lock size={14} />
              Private access to your social graph
            </div>
            <h1 className="mb-5 text-4xl font-bold leading-tight md:text-5xl">
              Sign in and pick up your conversations.
            </h1>
            <p className="text-lg leading-relaxed text-zinc-400">
              Your account follows you across federated communities, keeping your identity,
              connections, and posts under your control.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-blue-950/10"
          >
            <div className="mb-7">
              <h2 className="text-2xl font-bold">Login</h2>
              <p className="mt-2 text-sm text-zinc-500">
                New here?{' '}
                <Link to="/register" className="font-medium text-blue-400 hover:text-blue-300">
                  Create an account
                </Link>
              </p>
            </div>

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Email</span>
              <span className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-3 transition focus-within:border-blue-500">
                <Mail size={18} className="text-zinc-500" />
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={updateField}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                  placeholder="you@example.com"
                />
              </span>
            </label>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Password</span>
              <span className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-3 transition focus-within:border-blue-500">
                <Lock size={18} className="text-zinc-500" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={updateField}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-zinc-500 transition hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <div className="mb-6 flex items-center justify-between gap-4 text-sm">
              <label className="flex items-center gap-2 text-zinc-400">
                <input
                  name="remember"
                  type="checkbox"
                  checked={form.remember}
                  onChange={updateField}
                  className="h-4 w-4 rounded border-zinc-700 bg-black text-blue-500 focus:ring-blue-500"
                />
                Remember me
              </label>
              <a href="#" className="font-medium text-blue-400 hover:text-blue-300">
                Forgot password?
              </a>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
