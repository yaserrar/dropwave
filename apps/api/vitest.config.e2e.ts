import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Real database round trips and scrypt hashing: slower than unit tests on a busy machine.
    testTimeout: 20_000,
    // The suite writes to a real Postgres database, so it only runs against one
    // named explicitly, never the DATABASE_URL in .env. S3 and SES are faked.
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      APP_URL: 'http://localhost:3000',
      SCAN_RESULT_SECRET: 'e2e-scan-result-secret',
      AWS_REGION: 'eu-west-3',
      S3_BUCKET: 'e2e-bucket',
      MAIL_FROM: 'Dropwave <noreply@example.com>',
      LOG_LEVEL: 'silent',
    },
  },
});
