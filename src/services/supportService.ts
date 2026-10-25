import { withTimeout } from '../lib/backend';
import { supabase } from '../lib/supabase';
import type { TeamKey } from '../types/user';

type GenderGroup = 'male' | 'female';

export interface SupportContact {
  number: string;
  label?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Get WhatsApp support contact for a gender group
 */
export async function getSupportContact(teamKey: TeamKey, genderGroup: GenderGroup): Promise<SupportContact | null> {
  try {
    // Read the same team+gender contact records that the admin settings screen saves.
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('mfp_team_gender_settings_api', { p_action: 'listContacts', p_payload: {} })),
      5000,
      { data: null, error: new Error('Support contact request timed out') } as any
    );
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const row = rows.find((item: any) => item?.team_key === teamKey && item?.gender_group === genderGroup);
    if (!row || typeof row.whatsapp_number !== 'string' || !row.whatsapp_number.trim()) return null;
    return { number: row.whatsapp_number, label: row.support_label || 'WhatsApp Support', updatedAt: row.updated_at };
  } catch (err) {
    console.error(`Failed to load support contact for ${teamKey}/${genderGroup}:`, err);
    return null;
  }
}

/**
 * Save WhatsApp support contact for one team + gender group, through the same
 * team/gender settings API that the admin settings panel uses — one store for
 * both reading and writing, so saved numbers actually reach members.
 */
export async function saveSupportContact(
  teamKey: TeamKey,
  genderGroup: GenderGroup,
  contact: { number: string; label?: string }
): Promise<void> {
  const normalized = contact.number.replace(/[\s-]/g, '');
  if (!normalized || !/^\+?[0-9]+$/.test(normalized)) {
    throw new Error('Invalid WhatsApp number format. Use digits only, optionally starting with +.');
  }
  const { error } = await supabase.rpc('mfp_team_gender_settings_api', {
    p_action: 'saveContact',
    p_payload: { teamKey, genderGroup, whatsappNumber: normalized, supportLabel: (contact.label || '').trim() },
  });
  if (error) throw new Error(error.message || 'Failed to save support contact. Please try again.');
}

/**
 * Build WhatsApp link from a number (strips non-digits except leading +)
 */
export function buildWhatsAppLink(number: string): string {
  const digits = number.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}
