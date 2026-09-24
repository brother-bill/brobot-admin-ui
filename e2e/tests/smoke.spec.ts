import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** The dev environment's API origin (src/environments/environment.ts). */
const API = 'http://localhost:3000/api';

const COMMANDS = [
    {
        name: 'chatban',
        trigger: '!chatban',
        aliases: [],
        category: 'voting',
        description: 'Vote to stop the streamer pressing Enter for five minutes.',
        enabled: true,
    },
];

async function mockApi(page: Page, signedIn: boolean): Promise<void> {
    await page.route(`${API}/auth/twitch/status`, route =>
        signedIn
            ? route.fulfill({
                  json: {
                      oauthId: '1',
                      displayName: 'TramaDC',
                      roles: ['StreamerAuth'],
                      profileImageUrl: null,
                      scope: [],
                  },
              })
            : route.fulfill({ status: 401, json: { statusCode: 401, message: 'Unauthorized' } }),
    );
    await page.route(`${API}/auth/refresh`, route =>
        route.fulfill({ status: 401, json: { statusCode: 401, message: 'Unauthorized' } }),
    );
    await page.route(`${API}/commands`, route =>
        route.request().method() === 'POST'
            ? route.fulfill({ json: { ...COMMANDS[0], enabled: false } })
            : route.fulfill({ json: COMMANDS }),
    );
    await page.route(`${API}/pokemon/leaderboard`, route =>
        route.fulfill({
            json: [
                {
                    level: 42,
                    name: 'Pikachu',
                    nameId: 'pikachu',
                    shiny: true,
                    activeGame: 'brobot',
                    twitchUser: { displayName: 'viewer_one' },
                },
            ],
        }),
    );
}

test('a signed-out viewer can read the commands and the leaderboard', async ({ page }) => {
    await mockApi(page, false);
    await page.goto('/');
    await expect(page).toHaveURL(/\/commands$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Commands' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in with Twitch' })).toBeVisible();
    await expect(page.getByRole('switch')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leaderboard' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pokémon leaderboard' })).toBeFocused();
    await expect(page.getByRole('cell', { name: 'viewer_one' })).toBeVisible();
});

test('an admin can switch a command off', async ({ page }) => {
    await mockApi(page, true);
    await page.goto('/commands');
    const toggle = page.getByRole('switch', { name: /!chatban/ });
    await expect(toggle).toBeChecked();
    await toggle.press('Space');
    await expect(toggle).not.toBeChecked();
});

test('the callback notice is shown and taken off the URL', async ({ page }) => {
    await mockApi(page, false);
    await page.goto('/?auth_error=access_denied');
    await expect(page.getByText('Sign-in was cancelled on Twitch.')).toBeVisible();
    await expect(page).toHaveURL(/\/commands$/);
});

test('the overlay page is transparent and has no site chrome', async ({ page }) => {
    await page.goto('/twitch/supahot/overlay');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    const backgrounds = await page.evaluate(() =>
        [document.documentElement, document.body].map(el => getComputedStyle(el).backgroundColor),
    );
    expect(backgrounds).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
});
