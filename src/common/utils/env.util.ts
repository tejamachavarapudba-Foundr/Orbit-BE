// Fail loudly at the point of use rather than silently falling back to a
// hardcoded dev value — a missing secret in production should crash the
// process, not quietly sign tokens with a value anyone can read on GitHub.
export const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};
