type RoleProfileData = Record<string, unknown> | null | undefined;

export type ProfileCompletionInput = {
  role?: string | null;
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
  resumeKey?: string | null;
  founderProfile?: RoleProfileData;
  investorProfile?: RoleProfileData;
  advisorProfile?: RoleProfileData;
  professionalProfile?: RoleProfileData;
  serviceProviderProfile?: RoleProfileData;
};

const hasText = (value?: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

const hasItems = (value?: unknown) => Array.isArray(value) && value.length > 0;

const field = (
  key: string,
) => (value: RoleProfileData) => value?.[key];

type CompletionField = {
  weight: number;
  isFilled: (input: ProfileCompletionInput, roleData: RoleProfileData) => boolean;
};

const SHARED_FIELDS: CompletionField[] = [
  { weight: 8, isFilled: (i) => hasText(i.fullName) },
  { weight: 8, isFilled: (i) => hasText(i.headline) },
  { weight: 8, isFilled: (i) => hasText(i.location) },
  { weight: 8, isFilled: (i) => hasText(i.linkedinUrl) },
  { weight: 6, isFilled: (i) => hasText(i.avatarUrl) },
  { weight: 6, isFilled: (i) => hasText(i.bio) },
  { weight: 10, isFilled: (i) => hasItems(i.lookingFor) },
];

const LEGACY_ROLE_ALIASES: Record<string, string> = {
  co_founder: 'founder',
  software_engineer: 'professional',
  mentor: 'advisor',
  designer: 'professional',
  product_manager: 'professional',
  policy_maker: 'advisor',
  other: 'professional',
  developer: 'professional',
};

const PRIMARY_ROLES = new Set([
  'founder',
  'investor',
  'advisor',
  'professional',
  'service_provider',
]);

const normalizeRole = (role?: string | null): string | null => {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  if (PRIMARY_ROLES.has(normalized)) return normalized;
  return LEGACY_ROLE_ALIASES[normalized] ?? null;
};

/**
 * Weights reflect how much each field matters for that role's discovery
 * (e.g. a founder's stage matters more than team size). Founder & investor
 * deliberately have no resume field — a resume isn't relevant to raising or
 * investing — while professional, advisor and service_provider count the
 * shared resume upload toward their %.
 */
const ROLE_FIELDS: Record<string, CompletionField[]> = {
  founder: [
    { weight: 10, isFilled: (i, r) => hasText(i.company) || hasText(field('startupName')(r)) },
    { weight: 8, isFilled: (_i, r) => hasText(field('founderStatus')(r)) },
    { weight: 6, isFilled: (_i, r) => hasText(field('currentRole')(r)) },
    { weight: 8, isFilled: (_i, r) => hasText(field('startupStage')(r)) },
    { weight: 8, isFilled: (_i, r) => hasItems(field('industry')(r)) },
    { weight: 4, isFilled: (_i, r) => hasText(field('teamSize')(r)) },
    { weight: 6, isFilled: (i, r) => hasText(i.website) || hasText(field('website')(r)) },
    { weight: 4, isFilled: (_i, r) => hasItems(field('portfolio')(r)) },
  ],
  investor: [
    { weight: 10, isFilled: (i, r) => hasText(i.company) || hasText(field('fundName')(r)) },
    { weight: 6, isFilled: (_i, r) => hasText(field('investingAs')(r)) },
    { weight: 6, isFilled: (_i, r) => hasText(field('investorType')(r)) },
    { weight: 10, isFilled: (_i, r) => hasText(field('investmentRange')(r)) },
    { weight: 6, isFilled: (_i, r) => hasItems(field('investmentStage')(r)) },
    { weight: 10, isFilled: (_i, r) => hasItems(field('industries')(r)) },
    { weight: 6, isFilled: (_i, r) => hasText(field('yearsInvestingExperience')(r)) },
    { weight: 6, isFilled: (_i, r) => hasItems(field('portfolio')(r)) },
  ],
  advisor: [
    { weight: 12, isFilled: (_i, r) => hasItems(field('expertise')(r)) },
    { weight: 10, isFilled: (_i, r) => hasText(field('yearsExperience')(r)) },
    { weight: 8, isFilled: (_i, r) => hasText(field('mentorshipExperience')(r)) },
    { weight: 8, isFilled: (_i, r) => hasItems(field('industries')(r)) },
    { weight: 8, isFilled: (_i, r) => hasItems(field('mentorshipAreas')(r)) },
    { weight: 6, isFilled: (i) => hasText(i.resumeKey) },
  ],
  professional: [
    { weight: 12, isFilled: (i, r) => hasItems(i.skills) || hasItems(field('skills')(r)) },
    { weight: 4, isFilled: (_i, r) => hasText(field('specialization')(r)) },
    {
      weight: 10,
      isFilled: (_i, r) => hasItems(field('experiencePeriods')(r)) || hasText(field('experienceLevel')(r)),
    },
    { weight: 8, isFilled: (i) => hasText(i.resumeKey) },
  ],
  service_provider: [
    { weight: 10, isFilled: (i, r) => hasText(i.company) || hasText(field('company')(r)) },
    { weight: 12, isFilled: (_i, r) => hasItems(field('services')(r)) },
    { weight: 8, isFilled: (i, r) => hasText(i.website) || hasText(field('website')(r)) },
    { weight: 8, isFilled: (_i, r) => hasItems(field('clientIndustries')(r)) },
    { weight: 4, isFilled: (_i, r) => hasText(field('companyLinkedinUrl')(r)) },
    { weight: 6, isFilled: (i) => hasText(i.resumeKey) },
  ],
};

/**
 * Weighted per-field score, not a flat role-based constant: each field
 * contributes a share of 100% based on how much it matters for that role,
 * so a founder who filled everything except team size scores much higher
 * than one who only entered their name. Recomputed after every write that
 * can change these fields (onboarding, profile edit, avatar/resume upload)
 * so it stays in sync on web and mobile alike.
 */
export function calculateProfileCompletion(input: ProfileCompletionInput): number {
  const role = normalizeRole(input.role);
  if (!role) return 0;

  const roleData: RoleProfileData =
    role === 'founder'
      ? input.founderProfile
      : role === 'investor'
        ? input.investorProfile
        : role === 'advisor'
          ? input.advisorProfile
          : role === 'professional'
            ? input.professionalProfile
            : input.serviceProviderProfile;

  const fields = [...SHARED_FIELDS, ...(ROLE_FIELDS[role] ?? [])];
  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  if (totalWeight === 0) return 0;

  const earnedWeight = fields.reduce(
    (sum, f) => sum + (f.isFilled(input, roleData) ? f.weight : 0),
    0,
  );

  return Math.min(100, Math.round((earnedWeight / totalWeight) * 100));
}
