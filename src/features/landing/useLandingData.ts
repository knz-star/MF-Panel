import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from '../../lib/supabaseDocumentStore';
import { onAuthStateChanged, signOut, type User } from '../../lib/supabaseAuthCompat';

// Shared Supabase client is located at src/lib/supabase.ts.
import { auth, db } from '../../lib/backend';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AssetType = 'logo' | 'partner' | 'client' | 'icon' | 'banner' | 'other';

export type LandingAsset = {
  id: string;
  name: string;
  imageUrl: string;
  altText: string;
  assetType: AssetType;
  gradientStart: string | null;
  gradientEnd: string | null;
  invertOnHover: boolean;
  displayOrder: number;
  isActive: boolean;
};

export type LandingSettings = {
  contactEmail?: string;
  contactUrl?: string;
  docsUrl?: string;
  logoUrl?: string;
  heroVideoUrl?: string;
};

export type LoadStatus = 'loading' | 'ready' | 'error';

/* ------------------------------------------------------------------ */
/* Sanitisers (defence in depth: Supabase database rules are the real gate)    */
/* ------------------------------------------------------------------ */

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSET_TYPES: AssetType[] = ['logo', 'partner', 'client', 'icon', 'banner', 'other'];

function webUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function toAsset(id: string, d: Record<string, unknown>): LandingAsset | null {
  const imageUrl = webUrl(d.imageUrl);
  if (!imageUrl || typeof d.name !== 'string' || typeof d.altText !== 'string') return null;

  const hex = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : null);
  const type = ASSET_TYPES.includes(d.assetType as AssetType) ? (d.assetType as AssetType) : 'other';

  return {
    id,
    name: d.name,
    imageUrl,
    altText: d.altText,
    assetType: type,
    gradientStart: hex(d.gradientStart),
    gradientEnd: hex(d.gradientEnd),
    invertOnHover: d.invertOnHover === true,
    displayOrder: typeof d.displayOrder === 'number' ? d.displayOrder : 0,
    isActive: true,
  };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/** Active marquee assets. One listener, cleaned up on unmount. Never mocked. */
export function useLandingAssets(): { assets: LandingAsset[]; status: LoadStatus } {
  const [state, setState] = useState<{ assets: LandingAsset[]; status: LoadStatus }>({
    assets: [],
    status: 'loading',
  });

  useEffect(() => {
    // Needs the composite index: landingAssets (isActive ASC, displayOrder ASC)
    const q = query(
      collection(db, 'landingAssets'),
      where('isActive', '==', true),
      orderBy('displayOrder', 'asc'),
      limit(50),
    );

    // If nothing answers (offline / blocked), stop reserving space for the marquee.
    const timeout = window.setTimeout(() => {
      setState((s) => (s.status === 'loading' ? { assets: [], status: 'error' } : s));
    }, 6000);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        window.clearTimeout(timeout);
        const assets = snap.docs.flatMap((d) => {
          const a = toAsset(d.id, d.data());
          return a ? [a] : [];
        });
        setState({ assets, status: 'ready' });
      },
      () => {
        window.clearTimeout(timeout);
        setState({ assets: [], status: 'error' });
      },
    );

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return state;
}

/** Public, non-secret landing settings: siteSettings/landing */
export function useLandingSettings(): LandingSettings {
  const [settings, setSettings] = useState<LandingSettings>({});

  useEffect(() => {
    return onSnapshot(
      doc(db, 'siteSettings', 'landing'),
      (snap) => {
        const d = snap.data() ?? {};
        setSettings({
          contactUrl: webUrl(d.contactUrl),
          docsUrl: webUrl(d.docsUrl),
          logoUrl: webUrl(d.logoUrl),
          heroVideoUrl: webUrl(d.heroVideoUrl),
          contactEmail: typeof d.contactEmail === 'string' && EMAIL.test(d.contactEmail) ? d.contactEmail : undefined,
        });
      },
      () => setSettings({}),
    );
  }, []);

  return settings;
}

/** Current Supabase Auth user (persistent session handled by Supabase). */
export function useAuthUser(): { user: User | null; loading: boolean } {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: auth.currentUser,
    loading: true,
  });

  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);

  return state;
}

export const logout = () => signOut(auth);

