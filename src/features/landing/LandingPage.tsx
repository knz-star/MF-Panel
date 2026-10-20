import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  FileArchive,
  Layers,
  LogOut,
  Search,
  ShieldCheck,
  Smartphone,
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
  'Designing connected workflows, managing digital records, and bringing teams and applications together through one central platform.';

// Change these to your real post-login routes.
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
  status: ModuleStatus; // set to 'coming-soon' for any module that is not live yet
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

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a1b33]';

/* ================================================================== */
/* Small shared pieces                                                 */
/* ================================================================== */

function StatusBadge({ status }: { status: ModuleStatus }) {
  return status === 'available' ? (
    <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
      Available
    </span>
  ) : (
    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
      Coming soon
    </span>
  );
}

/** Native <dialog>: focus trap, Esc to close and backdrop come from the browser. */
function InfoDialog({
  info,
  onClose,
}: {
  info: { title: string; body: string } | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (info && !d.open) d.showModal();
    if (!info && d.open) d.close();
  }, [info]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="info-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[28px] border border-slate-200/60 bg-white p-0 shadow-[0_24px_60px_rgba(10,27,51,0.18)] backdrop:bg-slate-900/30"
    >
      <div className="p-6">
        <h2 id="info-dialog-title" className="font-display text-lg font-medium text-[#0a1b33]">
          {info?.title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{info?.body}</p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className={`mt-5 rounded-full bg-[#0a152d] px-5 py-2 text-xs font-semibold text-white ${FOCUS}`}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

/* ================================================================== */
/* Top bar (public vs signed-in)                                       */
/* ================================================================== */

function TopBar({
  signedIn,
  authLoading,
}: {
  signedIn: boolean;
  authLoading: boolean;
}) {
  const link = `rounded-full px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:text-[#0a1b33] ${FOCUS}`;

  return (
    <header
      data-glass
      className="sticky top-0 z-40 border-b border-slate-200/50 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link
          to="/"
          className={`flex shrink-0 items-center gap-2 rounded-full font-display text-lg font-medium tracking-tight text-[#0a1b33] ${FOCUS}`}
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-full bg-[#0a152d] text-[11px] text-white"
          >
            ✦
          </span>
          MF MPanel
        </Link>

        <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
          <a href="#overview" className={link}>Overview</a>
          <a href="#tools" className={link}>Tools</a>
          <a href="#workflow" className={link}>Workflow</a>
          <a href="#architecture" className={link}>Architecture</a>
        </nav>

        <div className="flex min-h-9 shrink-0 items-center gap-1">
          {authLoading ? null : signedIn ? (
            <>
              <Link
                to={ROUTES.dashboard}
                className="rounded-full bg-[#0a152d] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a152d]"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Log out"
                className={`grid h-10 w-10 place-items-center rounded-full text-slate-600 transition-colors hover:text-[#0a1b33] ${FOCUS}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link to={ROUTES.login} className={link}>
                Login
              </Link>
              <Link
                to={ROUTES.signup}
                className="rounded-full bg-[#0a152d] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a152d]"
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
/* Hero + floating glass navbar                                        */
/* ================================================================== */

type FloatingNavProps = {
  modules: ToolModule[];
  logoUrl?: string;
  onLogo: () => void;
  onOpenModule: (m: ToolModule) => void;
};

function FloatingNav({ modules, logoUrl, onLogo, onOpenModule }: FloatingNavProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={wrapRef} className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-1.5rem)]">
      {open && (
        <div className="absolute bottom-full left-1/2 mb-3 w-[22rem] max-w-[calc(100vw-1.5rem)] -translate-x-1/2">
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="MF MPanel products"
            onKeyDown={onMenuKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            data-glass
            className="rounded-[28px] border border-slate-200/50 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl"
          >
            {modules.map((m) => {
              const Icon = m.icon;
              const live = m.status === 'available';
              return (
                <button
                  key={m.key}
                  type="button"
                  role="menuitem"
                  disabled={!live}
                  onClick={() => {
                    setOpen(false);
                    onOpenModule(m);
                  }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
                    live ? 'hover:bg-slate-50 focus-visible:bg-slate-50' : 'cursor-not-allowed opacity-60',
                    FOCUS,
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-100 bg-slate-50 text-[#0a1b33]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#0a1b33]">{m.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{m.short}</span>
                  </span>
                  <StatusBadge status={m.status} />
                </button>
              );
            })}
          </motion.div>
        </div>
      )}

      <motion.nav
        data-glass
        aria-label="Primary"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center bg-white/90 backdrop-blur-2xl px-1.5 py-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-200/40"
      >
        <button
          type="button"
          onClick={onLogo}
          aria-label="MF MPanel — back to top"
          className={`w-9 h-9 shrink-0 overflow-hidden rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-[#0a1b33] ${FOCUS}`}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-5 w-5 object-contain" />
          ) : (
            <span aria-hidden="true">✦</span>
          )}
        </button>

        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'rounded-full px-3 py-2 text-[12px] font-medium transition-colors sm:px-4 sm:text-[13px]',
            open ? 'bg-slate-100 text-[#0a1b33]' : 'text-slate-600 hover:text-[#0a1b33]',
            FOCUS,
          )}
        >
          Products
        </button>


      </motion.nav>
    </div>
  );
}

function Hero({ children, videoUrl }: { children?: React.ReactNode; videoUrl?: string }) {
  const reduceMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <section aria-labelledby="hero-title" className="px-3 pt-3 md:px-6 md:pt-4">
      <div className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-white border border-slate-200/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden h-[600px] min-h-[520px] max-md:h-auto max-md:min-h-[560px] flex flex-col max-md:rounded-[32px]">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none" aria-hidden="true">
          {videoFailed ? (
            <div className="h-full w-full bg-slate-50" />
          ) : (
            <video
              ref={(el) => {
                if (el) el.muted = true; // React does not reliably set the muted attribute
              }}
              className="w-full h-full object-cover scale-105 transition-transform duration-1000"
              src={videoUrl || DEFAULT_HERO_VIDEO_URL}
              autoPlay={!reduceMotion}
              loop
              muted
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/82 to-white/30" />
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start"
        >
          <h1
            id="hero-title"
            className="font-display text-[42px] md:text-[56px] font-medium tracking-tight leading-[1.05] text-[#0a1b33]"
          >
            Foundation of the
            <br />
            new digital epoch
          </h1>
          <p className="mt-5 max-w-[440px] font-sans text-[14px] md:text-[15px] leading-relaxed text-[#334155] [text-shadow:0_1px_12px_rgba(255,255,255,0.98),0_0_24px_rgba(255,255,255,0.95)]">
            {HERO_SUBHEADLINE}
          </p>

        </motion.div>

        {children}
      </div>
    </section>
  );
}

/* ================================================================== */
/* Logo marquee (admin-managed, hidden when there is nothing to show)  */
/* ================================================================== */

function LogoCard({ asset, onImageError }: { asset: LandingAsset; onImageError?: (id: string) => void }) {
  const hasGradient = !!asset.gradientStart && !!asset.gradientEnd;

  return (
    <div className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden">
      {hasGradient && (
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-150 opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none"
          style={{ backgroundImage: `linear-gradient(135deg, ${asset.gradientStart}, ${asset.gradientEnd})` }}
        />
      )}
      <img
        src={asset.imageUrl}
        alt={asset.altText}
        width={96}
        height={40}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => onImageError?.(asset.id)}
        className={clsx(
          'relative z-10 h-auto w-auto max-h-10 max-w-[96px] object-contain transition-[filter] duration-300',
          hasGradient && asset.invertOnHover && 'group-hover:brightness-0 group-hover:invert',
        )}
      />
    </div>
  );
}

function LogoMarquee() {
  const { assets, status } = useLandingAssets();
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const visible = useMemo(() => assets.filter((a) => !failed.has(a.id)), [assets, failed]);

  // Render-only repetition so one half is wider than any screen. The database is never duplicated.
  const half = useMemo(
    () =>
      visible.length ? Array.from({ length: Math.ceil(12 / visible.length) }, () => visible).flat() : [],
    [visible],
  );

  if (status === 'loading') return <div className="mt-10 h-24" aria-hidden="true" />; // reserve space, no jump
  if (half.length === 0) return null; // nothing active (or error) => whole section hidden

  return (
    <section aria-label="Partners and clients" className="mt-10">
      <div className="mf-marquee">
        <ul
          className="mf-marquee-track"
          style={{ '--mf-marquee-duration': `${Math.max(30, half.length * 4)}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) =>
            half.map((a, i) => (
              <li key={`${copy}-${a.id}-${i}`} className="shrink-0 pr-4" aria-hidden={copy === 1 ? true : undefined}>
                <LogoCard asset={a} onImageError={(id) => setFailed((s) => new Set(s).add(id))} />
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

const OVERVIEW: { icon: LucideIcon; title: string; body: React.ReactNode }[] = [
  {
    icon: Database,
    title: 'Stable canonical identities',
    body: (
      <>
        Profiles receive an immutable <code className="font-medium text-[#0a1b33]">profileId</code> and source
        references. Posts link strictly as child records of their profile, so duplicate imports enrich history
        without fracturing identities.
      </>
    ),
  },
  {
    icon: Layers,
    title: 'Controlled queue mechanics',
    body: 'Searching Team hands profiles off into a capacity-controlled active queue. Checking Team closes every record with one of two outcomes: Verified or Failed / Blocked.',
  },
  {
    icon: FileArchive,
    title: 'Defensible ZIP matching',
    body: (
      <>
        ZIP analysis maps screenshots to profiles using 5-priority identity rules, then produces clean packages
        with <code className="font-medium text-[#0a1b33]">Link.txt</code> and{' '}
        <code className="font-medium text-[#0a1b33]">Screenshots.zip</code>.
      </>
    ),
  },
];

const STEPS = [
  {
    title: 'Text extraction and registration',
    text: 'Searching Team pastes WhatsApp or raw text. URLs are extracted and normalized, given a permanent PRF identity and SRC reference, and checked for duplicates.',
  },
  {
    title: 'Queue handoff and capacity gate',
    text: 'Eligible profiles move to the Checking Team queue while it stays within its configured capacity, preventing overflow and duplicate work.',
  },
  {
    title: 'Verification and region mapping',
    text: 'Checking Team records either Verified (with region and up to 3 post URLs) or Failed / Blocked (with an explanation).',
  },
  {
    title: 'ZIP analysis and report packaging',
    text: 'Uploaded archives are matched against Supabase workflow records. The system builds organized folders, each with Link.txt and Screenshots.zip.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthUser();
  const settings = useLandingSettings();
  const { assets: siteAssets } = useLandingAssets();
  const reduceMotion = useReducedMotion();
  const [info, setInfo] = useState<{ title: string; body: string } | null>(null);

  const signedIn = !!user;
  const contactTarget =
    settings.contactUrl ?? (settings.contactEmail ? `mailto:${settings.contactEmail}` : undefined);

  const openContact = () => {
    if (!contactTarget) {
      setInfo({
        title: 'Contact details are not set up yet',
        body: 'An administrator has not added contact details for this site. They can add them in the admin panel under Landing settings.',
      });
      return;
    }
    if (contactTarget.startsWith('mailto:')) window.location.href = contactTarget;
    else window.open(contactTarget, '_blank', 'noopener,noreferrer');
  };



  const routeFor = (m: ToolModule) => (signedIn ? m.route : `${ROUTES.login}?next=${encodeURIComponent(m.route)}`);

  const openModule = (m: ToolModule) => {
    if (m.status !== 'available') return;
    navigate(routeFor(m));
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-[#0a1b33]">
      <TopBar signedIn={signedIn} authLoading={authLoading} />

      <main>
        <Hero videoUrl={settings.heroVideoUrl}>
          <FloatingNav
            modules={MODULES}
            logoUrl={settings.logoUrl}
            onLogo={scrollTop}
            onOpenModule={openModule}
          />
        </Hero>

        <LogoMarquee />

        {/* Overview */}
        <section id="overview" className="px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-16">
            <div>
              <h2 className="font-display text-[28px] font-medium leading-[1.1] tracking-tight md:text-[36px]">
                Built for scale, precision, and permanent identity
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
                One pipeline from raw intake to verified evidence packaging, replacing duplicate records and
                fragmented spreadsheets.
              </p>
            </div>
            <ul className="divide-y divide-slate-200/70 border-y border-slate-200/70">
              {OVERVIEW.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4 py-6">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200/60 bg-white text-[#0a1b33]">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-medium">{title}</h3>
                    <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-slate-600">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tools */}
        <section id="tools" className="px-4 pb-16 md:px-6 md:pb-24">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-display text-[28px] font-medium leading-[1.1] tracking-tight md:text-[36px]">
              Tools in MF MPanel
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              {signedIn
                ? 'Open a tool below. Access is limited to the tools your account is approved for.'
                : 'Sign in to open the tools your team is approved for.'}
            </p>

            <ul className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgba(10,27,51,0.04)] max-md:rounded-[28px]">
              {MODULES.map((m) => {
                const Icon = m.icon;
                const live = m.status === 'available';
                return (
                  <li key={m.key} className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:gap-8 md:p-8">
                    <div className="flex shrink-0 items-start gap-4 md:w-72">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-100 bg-slate-50 text-[#0a1b33]">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-display text-lg font-medium">{m.name}</h3>
                        <div className="mt-1.5">
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                    </div>
                    <p className="flex-1 text-[13px] leading-relaxed text-slate-600">{m.desc}</p>
                    <div className="md:w-44 md:text-right">
                      {live ? (
                        <Link
                          to={routeFor(m)}
                          className={`inline-flex items-center gap-1 rounded-full text-[13px] font-semibold text-[#0a1b33] underline-offset-4 hover:underline ${FOCUS}`}
                        >
                          {signedIn ? `Open ${m.name}` : 'Sign in to open'}
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="text-[13px] text-slate-400">Not available yet</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="border-y border-slate-200/60 bg-white px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-display text-[28px] font-medium leading-[1.1] tracking-tight md:text-[36px]">
              How the workflow runs
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Every stage keeps identity intact and logs each transition so the whole path can be audited.
            </p>

            <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-sm font-semibold">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span aria-hidden="true" className="absolute -right-8 left-12 top-[18px] hidden h-px bg-slate-200 md:block" />
                  )}
                  <h3 className="mt-4 font-display text-base font-medium">{s.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Architecture */}
        <section id="architecture" className="px-3 py-12 md:px-6 md:py-20">
          <div className="mx-auto max-w-[1400px] rounded-[40px] bg-[#0a152d] px-6 py-12 text-white max-md:rounded-[28px] md:px-16 md:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="font-display text-[28px] font-medium leading-[1.1] tracking-tight md:text-[36px]">
                  Ready for external apps, without a second backend
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
                  MF MPanel is built so future client applications, such as the planned Evidence Android app, can
                  sign in and work with the same data through authorized interfaces.
                </p>
                <ul className="mt-6 space-y-3 text-[13px] text-slate-300">
                  {[
                    'One shared Supabase backend: Auth, PostgreSQL, Realtime, Storage, and Edge Functions.',
                    'Clear data contracts for future Evidence Android capture integration.',
                    'Role- and team-based access rules protect records and audit events.',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-[13px] font-medium text-slate-200">
                  <Smartphone className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  How the pieces connect
                </div>
                <dl className="space-y-3 text-[13px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <dt className="text-slate-400">Web portal</dt>
                    <dd className="mt-0.5 font-medium text-white">MF MPanel central console</dd>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <dt className="text-slate-400">Database</dt>
                    <dd className="mt-0.5 font-medium text-white">
                      Supabase PostgreSQL{}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <dt className="text-slate-400">Future client</dt>
                    <dd className="mt-0.5 font-medium text-white">MF Evidence Android app</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-200/60 bg-white px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="font-medium text-slate-700">
            © {new Date().getFullYear()} MF MPanel — Central Workflow Management System
          </span>
        </div>
      </footer>

      <InfoDialog info={info} onClose={() => setInfo(null)} />
    </div>
  );
};

export default LandingPage;
