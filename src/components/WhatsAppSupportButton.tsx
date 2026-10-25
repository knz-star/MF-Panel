import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { getSupportContact, buildWhatsAppLink, SupportContact } from '../services/supportService';
import { useAuth } from '../features/auth/AuthContext';

type GenderGroup = 'male' | 'female';

interface WhatsAppSupportButtonProps {
  genderGroup: GenderGroup;
}

export const WhatsAppSupportButton: React.FC<WhatsAppSupportButtonProps> = ({ genderGroup }) => {
  const [contact, setContact] = useState<SupportContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getSupportContact(genderGroup)
      .then((data) => {
        if (mounted) {
          setContact(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setContact(null);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [genderGroup]);

  if (loading || !contact?.number) {
    return null;
  }

  const link = buildWhatsAppLink(contact.number);
  const label = contact.label || 'WhatsApp Support';

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      aria-label={`Contact ${label} on WhatsApp`}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
};

/**
 * Renders the WhatsApp Support button for the currently signed-in user's own
 * gender group. Renders nothing when the user has no gender group or the
 * group has no support number configured.
 */
export const WhatsAppSupportForCurrentUser: React.FC = () => {
  const { userProfile } = useAuth();
  const group = userProfile?.genderGroup || userProfile?.gender;
  if (group !== 'male' && group !== 'female') return null;
  return <WhatsAppSupportButton genderGroup={group} />;
};
