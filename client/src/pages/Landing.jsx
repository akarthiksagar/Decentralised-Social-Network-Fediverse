// src/pages/Landing.jsx
import { useNavigate } from 'react-router-dom';
import {
  Globe, Shield, Users, Zap,
  ArrowRight, CheckCircle
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────
const features = [
  {
    icon: Globe,
    title: 'Truly Decentralized',
    description:
      'No single company owns your data. Run your own instance or join one you trust. Your account, your rules.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'No ads, no tracking, no algorithm manipulating your feed. You see what you choose to see.',
  },
  {
    icon: Users,
    title: 'Open Federation',
    description:
      'Connect with millions of users across Mastodon, Pixelfed, and the entire Fediverse seamlessly.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Create your account',
    description: 'Sign up on our instance or any compatible server across the Fediverse.',
  },
  {
    number: '02',
    title: 'Find your people',
    description: 'Follow anyone across any federated instance using their @user@instance handle.',
  },
  {
    number: '03',
    title: 'Post freely',
    description: 'Share your thoughts. Your posts travel across the entire federated network.',
  },
];

const footerLinks = ['About', 'Privacy', 'Terms', 'Source Code'];

// ─── Navbar ──────────────────────────────────────────────
function Navbar({ onLogin, onRegister }) {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Globe size={24} className="text-blue-500" />
        <span className="text-xl font-bold text-white">Fediverse</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onLogin}
          className="text-zinc-400 hover:text-white px-4 py-2 rounded-full
                     transition font-medium"
        >
          Login
        </button>
        <button
          onClick={onRegister}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2
                     rounded-full transition font-medium"
        >
          Register
        </button>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────
function Hero({ onRegister }) {
  return (
    <section className="flex flex-col items-center text-center px-6 py-24 max-w-3xl mx-auto">
      {/* Badge */}
      <div className="flex items-center gap-2 bg-blue-500/10 text-blue-400
                      border border-blue-500/20 px-4 py-1.5 rounded-full
                      text-sm font-medium mb-8">
        <Zap size={14} />
        Built on ActivityPub Protocol
      </div>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
        Social media that{' '}
        <span className="text-blue-500">you control</span>
      </h1>

      {/* Subtext */}
      <p className="text-zinc-400 text-xl leading-relaxed mb-10 max-w-2xl">
        A decentralized social network where no corporation owns your data,
        controls your feed, or can silence your voice. Connect with the
        entire Fediverse from one place.
      </p>

      {/* CTA Buttons */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <button
          onClick={onRegister}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600
                     text-white font-bold px-8 py-3 rounded-full transition
                     text-lg"
        >
          Get Started Free
          <ArrowRight size={20} />
        </button>
        <button
          onClick={() => window.open('https://activitypub.rocks', '_blank')}
          className="text-zinc-400 hover:text-white px-8 py-3 rounded-full
                     border border-zinc-700 hover:border-zinc-500 transition
                     text-lg"
        >
          Learn more
        </button>
      </div>

      {/* Social proof */}
      <div className="flex items-center gap-2 mt-10 text-zinc-500 text-sm">
        <CheckCircle size={16} className="text-green-500" />
        Connects with Mastodon, Pixelfed, and 10M+ Fediverse users
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────
function Features() {
  return (
    <section className="px-6 py-20 border-t border-zinc-800">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">
            Why decentralized?
          </h2>
          <p className="text-zinc-400 text-lg">
            Everything wrong with social media — fixed.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl
                           p-6 hover:border-zinc-600 transition"
              >
                <div className="bg-blue-500/10 w-12 h-12 rounded-xl
                                flex items-center justify-center mb-4">
                  <Icon size={22} className="text-blue-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────
function HowItWorks() {
  return (
    <section className="px-6 py-20 border-t border-zinc-800">
      <div className="max-w-4xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">
            How it works
          </h2>
          <p className="text-zinc-400 text-lg">
            Up and running in 3 simple steps.
          </p>
        </div>

        {/* Steps — no connector lines */}
        <div className="flex flex-col md:flex-row gap-8">
          {steps.map((step) => (
            <div key={step.number} className="flex-1">
              {/* Step number */}
              <div className="text-4xl font-bold text-blue-500/30 mb-3">
                {step.number}
              </div>
              <h3 className="text-white font-bold text-lg mb-2">
                {step.title}
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-zinc-800 px-6 py-10">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row
                      items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Globe size={20} className="text-blue-500" />
          <span className="text-white font-bold">Fediverse</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          {footerLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="text-zinc-500 hover:text-white text-sm transition"
            >
              {link}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-zinc-600 text-sm">
          © 2026 Fediverse. Open source.
        </p>
      </div>
    </footer>
  );
}

// ─── Main Landing Page ────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black">
      <Navbar
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/servers')}
      />
      <Hero onRegister={() => navigate('/servers')} />
      <Features />
      <HowItWorks />
      <Footer />
    </div>
  );
}
