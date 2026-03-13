import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://18edceb3912f49408e096f5e731fe71b@app.glitchtip.com/21038",
  tracesSampleRate: 1.0,
  debug: false,
});
