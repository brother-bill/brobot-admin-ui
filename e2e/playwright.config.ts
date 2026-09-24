import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for brobot-admin-ui. They need no API: every call to brobot is
 * answered by `page.route` in the spec. Not run by fleet jobs; CI runs them
 * at deploy time like every other app's e2e.
 *
 *   pnpm --filter @singularity/brobot-admin-ui run test:e2e
 */
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env['CI'],
    retries: 0,
    workers: process.env['CI'] ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:4207',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'pnpm run dev',
        cwd: '..',
        url: 'http://localhost:4207',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
    },
});
