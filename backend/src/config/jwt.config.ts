export default () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
  accessTtl: Number(process.env.JWT_ACCESS_TTL ?? 900),
  refreshTtl: Number(process.env.JWT_REFRESH_TTL ?? 2592000),
});
