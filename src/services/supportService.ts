import { doc, getDoc, setDoc } from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';

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
export async function getSupportContact(genderGroup: GenderGroup): Promise<SupportContact | null> {
  try {
    const docId = `support-${genderGroup}`;
    const snap = await withTimeout(
      getDoc(doc(db, 'settings', docId)),
      1500,
      null
    );
    if (snap && snap.exists()) {
      return snap.data() as SupportContact;
    }
  } catch (err) {
    console.error(`Failed to load support contact for ${genderGroup}:`, err);
  }
  return null;
}

/**
 * Save WhatsApp support contact for a gender group
 */
export async function saveSupportContact(
  genderGroup: GenderGroup,
  contact: { number: string; label?: string },
  adminUid: string
): Promise<void> {
  // Validate and normalize the number
  const normalized = contact.number.replace(/[\s-]/g, '');
  if (!normalized || !/^\+?[0-9]+$/.test(normalized)) {
    throw new Error('Invalid WhatsApp number format. Use digits only, optionally starting with +.');
  }

  const data: SupportContact = {
    number: normalized,
    label: contact.label || '',
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };

  const docId = `support-${genderGroup}`;
  try {
    await withTimeout(
      setDoc(doc(db, 'settings', docId), data, { merge: true }),
      2000,
      undefined
    );
  } catch (err) {
    handleBackendError(err, OperationType.WRITE, `settings/${docId}`);
    throw new Error('Failed to save support contact. Please try again.');
  }
}

/**
 * Build WhatsApp link from a number (strips non-digits except leading +)
 */
export function buildWhatsAppLink(number: string): string {
  const digits = number.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}
