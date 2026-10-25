import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileArchive,
  HelpCircle,
  Layers,
  LogOut,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  logout,
  useAuthUser,
  useLandingAssets,
  useLandingSettings,
  type LandingAsset,
} from './useLandingData';

const clsx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

/* ================================================================== */
/* Config — edit here, nowhere else                                    */
/* ================================================================== */

const DEFAULT_HERO_VIDEO_URL =
  'https://videotourl.com/videos/1791950139712-479a96d1-85cd-49ac-b099-3f19603ca56e.mp4';

const HERO_SUBHEADLINE =
  'Unify digital workflows, manage structured records, and coordinate team activities through one powerful platform.';

const ROUTES = {
  login: '/login',
  signup: '/signup',
  dashboard: '/dashboard',
} as const;

type ModuleStatus = 'available' | 'coming-soon';

type ToolModule = {
  key: string;
  name: string;
  short: string;
  desc: string;
  icon: LucideIcon;
  route: string;
  status: ModuleStatus;
};

const MODULES: ToolModule[] = [
  {
    key: 'searching',
    name: 'Searching Team',
    short: 'Intake, URL extraction, profile registration',
    desc: 'Raw WhatsApp and Telegram text intake, automated URL normalization, platform classification, permanent profileId (PRF) assignment, and checking handoff.',
    icon: Search,
    route: '/searching',
    status: 'available',
  },
  {
    key: 'checking',
    name: 'Checking Team',
    short: 'Queue evaluation and verification',
    desc: 'Controlled queue evaluation with configurable capacity, two-outcome verification (Verified or Failed / Blocked), and up to 3 post link associations.',
    icon: CheckCircle2,
    route: '/checking',
    status: 'available',
  },
  {
    key: 'reports',
    name: 'Report Generator',
    short: 'ZIP analysis and report packages',
    desc: 'ZIP archive analysis, zip-bomb defense, 5-level identity matching against Supabase workflow records, configurable links per folder, and export of Link.txt and Screenshots.zip.',
    icon: FileArchive,
    route: '/reports',
    status: 'available',
  },
];

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]';

/* ================================================================== */
/* Top bar (sticky nav)                                                */
/* ================================================================== */

function TopBar({ signedIn, authLoading }: { signedIn: boolean; authLoading: boolean }) {
  const link = `rounded-xl px-4 py-2 text-sm font-semibold text-[#8A8A80] transition-colors hover:text-[#1F2421] ${FOCUS}`;

  return (
    <header className="sticky top-0 z-50 border-b border-[#E2D9C8] bg-[#FBF7EF]/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-8">
        <Link to="/" className={`flex shrink-0 items-center gap-2.5 rounded-xl font-display text-xl font-bold tracking-tight text-[#1F2421] ${FOCUS}`}>
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-[#2A2723] text-sm font-bold text-[#F6F1E8]">
            M
          </span>
          <span>MF MPanel</span>
        </Link>

        <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
          <a href="#features" className={link}>Features</a>
          <a href="#workflow" className={link}>Workflow</a>
          <a href="#faq" className={link}>FAQ</a>
        </nav>

        <div className="flex min-h-10 shrink-0 items-center gap-2">
          {authLoading ? null : signedIn ? (
            <>
              <Link
                to={ROUTES.dashboard}
                className="rounded-xl bg-[#C8853F] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#A86B2C] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Log out"
                className={`grid h-10 w-10 place-items-center rounded-xl text-[#8A8A80] transition-colors hover:bg-[#F0E3D0] hover:text-[#1F2421] ${FOCUS}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link to={ROUTES.login} className={link}>Login</Link>
              <Link
                to={ROUTES.signup}
                className="rounded-xl bg-[#C8853F] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#A86B2C] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ================================================================== */
/* Hero Section                                                        */
/* ================================================================== */

function Hero({ videoUrl, signedIn }: { videoUrl?: string; signedIn: boolean }) {
  const reduceMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section className="relative overflow-hidden bg-[#F6F1E8] px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left Column - Content */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col justify-center"
        >
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F0E3D0] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#C8853F]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C8853F]" aria-hidden="true" />
            Now in Public Beta
          </div>

          <h1 className="mt-6 font-display text-[48px] font-bold leading-[1.05] tracking-tight text-[#1F2421] md:text-[64px]">
            Centralized workflows for{' '}
            <em className="not-italic text-[#C8853F]">modern teams</em>
          </h1>

          <p className="mt-6 max-w-[520px] text-lg leading-relaxed text-[#8A8A80]">
            {HERO_SUBHEADLINE}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {signedIn ? (
              <Link
                to={ROUTES.dashboard}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C8853F] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:bg-[#A86B2C] hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
              >
                Open Dashboard
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to={ROUTES.signup}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C8853F] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:bg-[#A86B2C] hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
                >
                  Get Started
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link
                  to={ROUTES.login}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-[#E2D9C8] bg-white px-6 py-3.5 text-base font-bold text-[#1F2421] transition-all hover:border-[#C8853F] hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-[#8A8A80]">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#C8853F]" aria-hidden="true" />
              <span className="font-semibold">Secure workflow</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#C8853F]" aria-hidden="true" />
              <span className="font-semibold">Team coordination</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#C8853F]" aria-hidden="true" />
              <span className="font-semibold">Real-time sync</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column - Mockup */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center lg:justify-end"
        >
          <div className="relative w-full max-w-[600px]">
            {/* Browser Window Frame */}
            <div className="overflow-hidden rounded-2xl border-2 border-[#E2D9C8] bg-white shadow-2xl">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 border-b border-[#E2D9C8] bg-[#FBF7EF] px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F57]" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-[#28C840]" aria-hidden="true" />
                </div>
              </div>
              {/* Content */}
              <div className="aspect-[4/3] overflow-hidden bg-[#F6F1E8]">
                {videoFailed || !videoUrl ? (
                  <div className="flex h-full items-center justify-center p-8">
                    <div className="text-center">
                      <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[#F0E3D0]">
                        <Database className="h-10 w-10 text-[#C8853F]" aria-hidden="true" />
                      </div>
                      <p className="mt-4 font-display text-xl font-bold text-[#1F2421]">MF MPanel Dashboard</p>
                      <p className="mt-2 text-sm text-[#8A8A80]">Unified workflow management</p>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={(el) => {
                      if (el) el.muted = true;
                    }}
                    className="h-full w-full object-cover"
                    src={videoUrl}
                    autoPlay={!reduceMotion}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    onError={() => setVideoFailed(true)}
                  />
                )}
              </div>
            </div>
            {/* Floating Status Chip */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.6 }}
              className="absolute -bottom-4 right-4 flex items-center gap-2 rounded-xl border border-[#E2D9C8] bg-white px-4 py-2.5 shadow-lg"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-[#1F2421]">Active workflow · 47 min uptime</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Stats Section                                                       */
/* ================================================================== */

function StatsSection() {
  const stats = [
    { label: 'Profiles Managed', value: '10K+' },
    { label: 'Records Verified', value: '25K+' },
    { label: 'Team Members', value: '50+' },
    { label: 'Uptime', value: '99.9%' },
  ];

  return (
    <section className="border-y border-[#E2D9C8] bg-white px-4 py-12 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-display text-4xl font-bold tracking-tight text-[#1F2421] md:text-5xl">{value}</p>
              <p className="mt-2 text-sm font-semibold text-[#8A8A80]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Features Grid                                                       */
/* ================================================================== */

function FeaturesSection() {
  const features = [
    {
      icon: Database,
      title: 'Canonical Identity System',
      desc: 'Every profile receives a permanent, immutable ID. Posts link as child records, preventing duplicate identities across imports.',
    },
    {
      icon: Layers,
      title: 'Controlled Queue Flow',
      desc: 'Capacity-managed handoff between teams ensures no overflow. Every record closes with a clear outcome.',
    },
    {
      icon: FileArchive,
      title: 'Smart ZIP Analysis',
      desc: 'Five-tier identity matching maps screenshots to profiles, producing clean report packages automatically.',
    },
    {
      icon: Shield,
      title: 'Role-Based Access',
      desc: 'Granular permissions protect sensitive data. Audit trails track every action across the platform.',
    },
    {
      icon: Zap,
      title: 'Real-Time Updates',
      desc: 'Supabase Realtime keeps dashboards synchronized. Changes propagate instantly across all team views.',
    },
    {
      icon: Users,
      title: 'Team Coordination',
      desc: 'Separate workspaces for Searching, Checking, and Reports teams with dedicated admin controls.',
    },
  ];

  return (
    <section id="features" className="bg-[#F6F1E8] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="text-center">
          <h2 className="font-display text-[40px] font-bold leading-tight tracking-tight text-[#1F2421] md:text-[52px]">
            Built for <em className="not-italic text-[#C8853F]">scale and precision</em>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#8A8A80]">
            One integrated pipeline from raw intake to verified evidence packaging.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-[#E2D9C8] bg-white p-6 shadow-sm transition-all hover:border-[#C8853F] hover:shadow-lg hover:-translate-y-1"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0E3D0] text-[#C8853F] transition-colors group-hover:bg-[#C8853F] group-hover:text-white">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-[#1F2421]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8A8A80]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Workflow Steps                                                      */
/* ================================================================== */

function WorkflowSection() {
  const steps = [
    {
      step: '01',
      title: 'Text Extraction',
      desc: 'Searching Team ingests WhatsApp/Telegram text. URLs are normalized and assigned permanent PRF identities.',
    },
    {
      step: '02',
      title: 'Queue Handoff',
      desc: 'Eligible profiles flow into Checking queue while staying within configured capacity limits.',
    },
    {
      step: '03',
      title: 'Verification',
      desc: 'Checking Team marks records Verified (with region + posts) or Failed/Blocked with reason.',
    },
    {
      step: '04',
      title: 'Report Generation',
      desc: 'ZIP archives are matched to workflow records. Organized folders with Link.txt and Screenshots.zip.',
    },
  ];

  return (
    <section id="workflow" className="border-t border-[#E2D9C8] bg-white px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="text-center">
          <h2 className="font-display text-[40px] font-bold leading-tight tracking-tight text-[#1F2421] md:text-[52px]">
            How the <em className="not-italic text-[#C8853F]">workflow runs</em>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#8A8A80]">
            Every stage maintains identity integrity and logs all transitions for full audit trails.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, title, desc }, i) => (
            <div key={step} className="relative">
              <div className="rounded-2xl border border-[#E2D9C8] bg-[#FBF7EF] p-6">
                <span className="font-display text-5xl font-bold tracking-tight text-[#F0E3D0]">{step}</span>
                <h3 className="mt-3 font-display text-xl font-bold text-[#1F2421]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8A8A80]">{desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 lg:block" aria-hidden="true">
                  <ChevronRight className="h-6 w-6 text-[#E2D9C8]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Tools/Modules List                                                  */
/* ================================================================== */

function ToolsSection({ signedIn }: { signedIn: boolean }) {
  const routeFor = (m: ToolModule) => (signedIn ? m.route : `${ROUTES.login}?next=${encodeURIComponent(m.route)}`);

  return (
    <section className="bg-[#F6F1E8] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="font-display text-[40px] font-bold leading-tight tracking-tight text-[#1F2421] md:text-[52px]">
            Integrated <em className="not-italic text-[#C8853F]">tools</em>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#8A8A80]">
            {signedIn ? 'Access is limited to approved tools for your account.' : 'Sign in to access the tools your team is approved for.'}
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const live = m.status === 'available';
            return (
              <div key={m.key} className="overflow-hidden rounded-2xl border border-[#E2D9C8] bg-white shadow-sm transition-all hover:border-[#C8853F] hover:shadow-md">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:gap-6">
                  <div className="flex items-start gap-4 md:w-72 md:shrink-0">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F0E3D0] text-[#C8853F]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#1F2421]">{m.name}</h3>
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-[#8A8A80]">{m.short}</p>
                    </div>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-[#8A8A80]">{m.desc}</p>
                  <div className="md:shrink-0">
                    {live ? (
                      <Link
                        to={routeFor(m)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#C8853F] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#A86B2C] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
                      >
                        {signedIn ? 'Open' : 'Sign in'}
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-xl bg-[#E2D9C8] px-5 py-2.5 text-sm font-bold text-[#8A8A80]">
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* FAQ Section                                                         */
/* ================================================================== */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is MF MPanel?',
      a: 'MF MPanel is a centralized workflow management system for coordinating digital records across Searching, Checking, and Reports teams. It maintains canonical profile identities and produces verified evidence packages.',
    },
    {
      q: 'How does identity management work?',
      a: 'Every profile receives a permanent PRF (Profile ID) upon registration. Posts are linked as child records, so duplicate imports enrich history without creating duplicate identities.',
    },
    {
      q: 'What teams use this platform?',
      a: 'Three primary teams: Searching (intake and URL extraction), Checking (queue verification), and Reports (ZIP analysis and packaging). Admin roles oversee system-wide operations.',
    },
    {
      q: 'Is my data secure?',
      a: 'Yes. Role-based access controls protect sensitive data. All actions are logged for audit trails. The platform runs on Supabase with enterprise-grade security.',
    },
    {
      q: 'Can I integrate external apps?',
      a: 'MF MPanel is built for future client integrations like the planned Evidence Android app. All apps share one Supabase backend with clear data contracts.',
    },
  ];

  return (
    <section id="faq" className="border-t border-[#E2D9C8] bg-white px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[900px]">
        <div className="text-center">
          <h2 className="font-display text-[40px] font-bold leading-tight tracking-tight text-[#1F2421] md:text-[52px]">
            Frequently asked <em className="not-italic text-[#C8853F]">questions</em>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#8A8A80]">
            Everything you need to know about the platform.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map(({ q, a }, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-[#E2D9C8] bg-[#FBF7EF]">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-[#F0E3D0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
              >
                <span className="font-display text-lg font-bold text-[#1F2421]">{q}</span>
                <ChevronDown
                  className={clsx('h-5 w-5 shrink-0 text-[#C8853F] transition-transform', openIndex === i && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              {openIndex === i && (
                <div className="border-t border-[#E2D9C8] bg-white px-6 py-4">
                  <p className="text-sm leading-relaxed text-[#8A8A80]">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* CTA Section                                                         */
/* ================================================================== */

function CTASection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-[#2A2723] px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1000px] text-center">
        <h2 className="font-display text-[40px] font-bold leading-tight tracking-tight text-[#F6F1E8] md:text-[52px]">
          Ready to <em className="not-italic text-[#C8853F]">streamline</em> your workflow?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[#E2D9C8]">
          Join teams already coordinating their operations through MF MPanel.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {signedIn ? (
            <Link
              to={ROUTES.dashboard}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C8853F] px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-[#A86B2C] hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
            >
              Open Dashboard
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                to={ROUTES.signup}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C8853F] px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-[#A86B2C] hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
              >
                Get Started Free
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                to={ROUTES.login}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#E2D9C8] bg-transparent px-8 py-4 text-lg font-bold text-[#F6F1E8] transition-all hover:bg-[#E2D9C8]/10 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8853F]"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Footer                                                              */
/* ================================================================== */

function Footer() {
  return (
    <footer className="border-t border-[#E2D9C8] bg-[#FBF7EF] px-6 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2A2723] text-sm font-bold text-[#F6F1E8]" aria-hidden="true">
              M
            </span>
            <span className="font-display text-lg font-bold text-[#1F2421]">MF MPanel</span>
          </div>
          <p className="text-sm text-[#8A8A80]">
            © {new Date().getFullYear()} MF MPanel — Central Workflow Management System
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ================================================================== */
/* Main Page Component                                                 */
/* ================================================================== */

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthUser();
  const settings = useLandingSettings();

  const signedIn = !!user;
  useEffect(() => {
    if (!authLoading && signedIn) navigate('/dashboard', { replace: true });
  }, [authLoading, signedIn, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F1E8] font-sans text-[#1F2421]">
      <TopBar signedIn={signedIn} authLoading={authLoading} />

      <main>
        <Hero videoUrl={settings.heroVideoUrl} signedIn={signedIn} />
        <StatsSection />
        <FeaturesSection />
        <WorkflowSection />
        <ToolsSection signedIn={signedIn} />
        <FAQSection />
        <CTASection signedIn={signedIn} />
      </main>

      <Footer />
    </div>
  );
};

export default LandingPage;
