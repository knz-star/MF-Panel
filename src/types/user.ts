export type UserRole = 'USER' | 'ADMIN' | 'TEAM_ADMIN' | 'CHECKER' | 'SEARCHER';
export type AccountStatus = 'ACTIVE' | 'DISABLED' | 'PENDING';
export type ModuleKey = 'searching' | 'checking' | 'reports' | 'evidence' | 'admin';
export type TeamKey = 'searching' | 'checking' | 'reports' | 'evidence';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  gender?: 'male' | 'female';
  genderGroup?: 'male' | 'female';
  role: UserRole;
  allowedModules: ModuleKey[];
  team?: TeamKey;
  /** True only after the signed-in user completes the post-login team selection. */
  teamConfirmed?: boolean;
  accountStatus: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
  pledgeAccepted?: boolean;
  pledgeSignature?: string;
  pledgeAcceptedAt?: string;
}
