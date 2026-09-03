import { getRequiredEnv } from '../common/utils/env.util';

export default () => ({
  accessSecret: getRequiredEnv('JWT_ACCESS_SECRET'),
  refreshSecret: getRequiredEnv('JWT_REFRESH_SECRET'),
  accessTtl: Number(process.env.JWT_ACCESS_TTL ?? 900),
  refreshTtl: Number(process.env.JWT_REFRESH_TTL ?? 2592000),
});
