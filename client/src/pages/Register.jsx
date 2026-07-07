import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AtSign, Eye, EyeOff, Globe, Lock, Mail, Server, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

function getAuthPayload(data) {
  return {
    user: data.user || data.data?.user || null,
    token: data.token || data.accessToken || data.data?.token || data.data?.accessToken || null,
  };
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const selectedServer = location.state?.selectedServer;
  const serverDomain = selectedServer?.domain || searchParams.get('server') || 'fediverse.local';
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = useMemo(() => {
    const checks = [
      form.password.length >= 8,
      /[A-Z]/.test(form.password),
      /[0-9]/.test(form.password),
      /[^A-Za-z0-9]/.test(form.password),
    ];
    return checks.filter(Boolean).length;
  }, [form.password]);

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

    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      setError('Fill in all account details to register.');
      return;
    }

    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!form.terms) {
      setError('Accept the community terms to continue.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data } = await api.post('/auth/register', {
        name: form.name.trim(),
        username: form.username.trim().replace(/^@/, ''),
        email: form.email.trim(),
        password: form.password,
        server: serverDomain,
      });
      const { user, token } = getAuthPayload(data);

      if (!token) {
        throw new Error('Registration succeeded but no token was returned.');
      }

      setAuth(user || {
        name: form.name.trim(),
        username: form.username.trim().replace(/^@/, ''),
        email: form.email.trim(),
        server: serverDomain,
      }, token);
      toast.success('Account created');
      navigate('/home');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Unable to create your account right now.'
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

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_480px]">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400">
              <AtSign size={14} />
              Claim your federated identity
            </div>
            <h1 className="mb-5 text-4xl font-bold leading-tight md:text-5xl">
              Create an account for a network you can actually leave.
            </h1>
            <p className="text-lg leading-relaxed text-zinc-400">
              Your home server is part of your public identity. Your handle will
              appear as @{form.username.trim().replace(/^@/, '') || 'username'}@{serverDomain}.
            </p>
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Server size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-500">Selected server</p>
                  <p className="truncate font-semibold text-white">
                    {selectedServer?.name || serverDomain}
                  </p>
                  <p className="text-sm text-zinc-500">{serverDomain}</p>
                </div>
                <Link
                  to="/servers"
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-blue-500 hover:text-blue-300"
                >
                  Change
                </Link>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-blue-950/10"
          >
            <div className="mb-7">
              <h2 className="text-2xl font-bold">Register</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
                  Login
                </Link>
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Display name</span>
                <span className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-3 transition focus-within:border-blue-500">
                  <User size={18} className="text-zinc-500" />
                  <input
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={updateField}
                    className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                    placeholder="Karthik"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Username</span>
                <span className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-3 transition focus-within:border-blue-500">
                  <AtSign size={18} className="text-zinc-500" />
                  <input
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={form.username}
                    onChange={updateField}
                    className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                    placeholder="karthik"
                  />
                </span>
                <span className="mt-2 block truncate text-xs text-zinc-500">
                  @{form.username.trim().replace(/^@/, '') || 'username'}@{serverDomain}
                </span>
              </label>
            </div>

            <label className="mt-5 block">
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

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Password</span>
              <span className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-3 transition focus-within:border-blue-500">
                <Lock size={18} className="text-zinc-500" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={updateField}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                  placeholder="Create password"
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

            <div className="mt-3 flex gap-2" aria-label="Password strength">
              {[0, 1, 2, 3].map((level) => (
                <span
                  key={level}
                  className={`h-1 flex-1 rounded-full ${
                    passwordStrength > level ? 'bg-blue-500' : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Confirm password</span>
              <span className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black px-3 py-3 transition focus-within:border-blue-500">
                <Lock size={18} className="text-zinc-500" />
                <input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={updateField}
                  className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                  placeholder="Repeat password"
                />
              </span>
            </label>

            <label className="mt-5 flex items-start gap-3 text-sm text-zinc-400">
              <input
                name="terms"
                type="checkbox"
                checked={form.terms}
                onChange={updateField}
                className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-black text-blue-500 focus:ring-blue-500"
              />
              <span>
                I agree to follow the community terms and understand my profile can
                federate with other compatible servers.
              </span>
            </label>

            {error && (
              <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 font-bold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Register'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
