// Must be imported before anything else in main.ts (including
// supabase.polyfill) — Sentry can only auto-instrument modules that get
// required/imported after it initializes.
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// An empty/undefined DSN makes the SDK a documented no-op rather than an
// error — safe to deploy before a real DSN is configured.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  integrations: [nodeProfilingIntegration(), Sentry.prismaIntegration()],
  // Gives the request/DB/handler latency breakdown this was added for —
  // 20% keeps overhead low while still catching real slowness patterns.
  // Revisit downward if the free-tier transaction quota gets tight.
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.2,
});
