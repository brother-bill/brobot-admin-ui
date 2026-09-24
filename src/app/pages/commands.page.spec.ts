import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { BotCommand, SessionUser } from '../core/brobot-api';
import { SessionService } from '../core/session.service';
import { API, appTestProviders, provideFakeSession, settle, text, user } from '../testing/test-helpers';
import { CommandsPage } from './commands.page';

const COMMANDS: BotCommand[] = [
    {
        name: 'pokemon-battle',
        trigger: '!pokemon battle',
        aliases: [],
        category: 'pokemon',
        description: 'Start or join a 1v1 battle.',
        enabled: true,
    },
    {
        name: 'quack',
        trigger: '!quack',
        aliases: [],
        category: 'fun',
        description: 'Plays a duck on stream.',
        enabled: false,
    },
    {
        name: 'chatban',
        trigger: '!chatban',
        aliases: ['!cb'],
        category: 'voting',
        description: 'Vote to ban the Enter key.',
        enabled: true,
    },
];

describe('CommandsPage', () => {
    let http: HttpTestingController;

    afterEach(() => http.verify());

    let session: { restores: number };

    async function render(signedInAs: SessionUser | null) {
        TestBed.configureTestingModule({
            providers: [...appTestProviders(), provideFakeSession(signedInAs)],
        });
        http = TestBed.inject(HttpTestingController);
        session = TestBed.inject(SessionService) as unknown as { restores: number };
        const fixture = TestBed.createComponent(CommandsPage);
        TestBed.tick();
        http.expectOne(`${API}/commands`).flush(COMMANDS);
        await settle(fixture);
        return { fixture, root: fixture.nativeElement as HTMLElement };
    }

    it('lists every command by category, read-only for viewers', async () => {
        const { root } = await render(null);
        const headings = [...root.querySelectorAll('h2')].map(h => h.textContent.trim());
        expect(headings.slice(0, 3)).toEqual(['Pokémon', 'Voting', 'Fun']);
        expect(text(root)).toContain('!chatban or !cb');
        expect(root.querySelectorAll('input[role="switch"]')).toHaveLength(0);
        expect(text(root)).toContain('Off');
    });

    it('tells a signed-in viewer who can switch commands', async () => {
        const { root } = await render(user());
        expect(text(root)).toContain('Only the streamer and brobot admins can switch commands');
        expect(root.querySelectorAll('input[role="switch"]')).toHaveLength(0);
    });

    it('lets an admin switch a command, and says so', async () => {
        const { fixture, root } = await render(user({ roles: ['Admin'] }));
        const switches = [...root.querySelectorAll<HTMLInputElement>('input[role="switch"]')];
        expect(switches.map(s => s.checked)).toEqual([true, true, false]);
        const quack = switches[2]!;
        expect(quack.closest('label')?.textContent).toContain('!quack');

        quack.click();
        const request = http.expectOne(`${API}/commands`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ name: 'quack', enabled: true });
        expect(request.request.withCredentials).toBe(true);
        request.flush({ ...COMMANDS[1], enabled: true });
        await settle(fixture);

        expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe('!quack is now on.');
        expect(root.querySelectorAll<HTMLInputElement>('input[role="switch"]').item(2).checked).toBe(true);
    });

    it('puts a switch back and explains when the save is refused', async () => {
        const { fixture, root } = await render(user({ roles: ['StreamerAuth'] }));
        root.querySelectorAll<HTMLInputElement>('input[role="switch"]')[0]!.click();
        http.expectOne(`${API}/commands`).flush(
            { statusCode: 403, message: 'Forbidden' },
            { status: 403, statusText: 'Forbidden' },
        );
        await settle(fixture);

        expect(root.querySelectorAll<HTMLInputElement>('input[role="switch"]').item(0).checked).toBe(true);
        expect(text(root)).toContain('Could not turn !pokemon battle off. Only the streamer and brobot admins can do that.');
    });

    it('keeps a switch operable while its save is in flight', async () => {
        const { fixture, root } = await render(user({ roles: ['Admin'] }));
        const quack = root.querySelectorAll<HTMLInputElement>('input[role="switch"]').item(2);
        quack.focus();
        quack.click();
        await settle(fixture);
        expect(quack.disabled).toBe(false);
        expect(document.activeElement).toBe(quack);
        http.expectOne(`${API}/commands`).flush({ ...COMMANDS[1], enabled: true });
        await settle(fixture);
    });

    it('re-reads the session when a save finds it has ended', async () => {
        const { fixture, root } = await render(user({ roles: ['Admin'] }));
        root.querySelectorAll<HTMLInputElement>('input[role="switch"]').item(0).click();
        // ngx-auth's interceptor tries one refresh before giving up.
        http.expectOne(`${API}/commands`).flush(null, { status: 401, statusText: 'Unauthorized' });
        http.expectOne(`${API}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
        await settle(fixture);
        expect(session.restores).toBe(1);
        expect(root.querySelectorAll('input[role="switch"]')).toHaveLength(0);
        expect(text(root)).toContain('Your session has ended.');
    });
});
