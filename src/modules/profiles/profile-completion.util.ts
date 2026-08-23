type RoleProfileData = Record<string, unknown> | null | undefined;

export type ProfileCompletionInput = {
  fullName?: string | null;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  company?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  skills?: string[] | null;
  lookingFor?: string[] | null;
  founderProfile?: RoleProfileData;
  investorProfile?: RoleProfileData;
  advisorProfile?: RoleProfileData;
  professionalProfile?: RoleProfileData;
  serviceProviderProfile?: RoleProfileData;
};

const IGNORED_ROLE_KEYS = new Set([
  'profileId',
  'goals',
  'createdAt',
  'updatedAt',
]);

const hasText = (value?: string | null) =>
  typeof value === 'string' && value.trim().length > 0;

const hasItems = (value?: unknown[] | null) =>
  Array.isArray(value) && value.length > 0;

const roleProfileHasData = (data: RoleProfileData) => {
  if (!data) return false;
  return Object.entries(data)
    .filter(([key]) => !IGNORED_ROLE_KEYS.has(key))
    .some(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return Boolean(value);
    });
};

/**
 * Real richness score, not a role-based flat constant: fields the user
 * actually filled in count, unfilled ones don't. Recomputed after every
 * write that can change these fields (onboarding, profile edit, avatar
 * upload) so it stays in sync on web and mobile alike.
 */
export function calculateProfileCompletion(
  input: ProfileCompletionInput,
): number {
  let score = 0;

  if (hasText(input.fullName)) score += 10;
  if (hasText(input.headline)) score += 10;
  if (hasText(input.bio)) score += 10;
  if (hasText(input.avatarUrl)) score += 15;
  if (hasText(input.location)) score += 5;
  if (hasText(input.company)) score += 5;
  if (hasText(input.website) || hasText(input.linkedinUrl)) score += 5;
  if (hasItems(input.skills)) score += 10;
  if (hasItems(input.lookingFor)) score += 10;

  const roleData =
    input.founderProfile ??
    input.investorProfile ??
    input.advisorProfile ??
    input.professionalProfile ??
    input.serviceProviderProfile;
  if (roleProfileHasData(roleData)) score += 20;

  return Math.min(100, score);
}
