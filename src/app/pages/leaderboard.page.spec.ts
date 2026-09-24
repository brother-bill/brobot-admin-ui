import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '../core/brobot-api';
import { API, appTestProviders, settle, text } from '../testing/test-helpers';
import { LeaderboardPage } from './leaderboard.page';

const ENTRIES: LeaderboardEntry[] = [
    { level: 150, name: 'Garchomp', nameId: 'garchomp', shiny: true, activeGame: 'brobot', twitchUser: { displayName: 'Viewer_One' } },
    { level: 99, name: 'Eevee', nameId: 'eevee', shiny: false, activeGame: 'pmd', twitchUser: { displayName: 'ブロ' } },
];

describe('LeaderboardPage', () => {
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: appTestProviders() });
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('ranks the Pokémon and links each trainer to their team', async () => {
        const fixture = TestBed.createComponent(LeaderboardPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/leaderboard`).flush(ENTRIES);
        await settle(fixture);
        const root = fixture.nativeElement as HTMLElement;

        const rows = [...root.querySelectorAll('tbody tr')];
        expect(rows).toHaveLength(2);
        const cells = [...rows[0]!.querySelectorAll('td')].map(cell => text(cell).trim());
        expect(cells.slice(0, 4)).toEqual(['1', 'Viewer_One', 'Garchomp Shiny', '150']);
        expect(text(rows[1] as HTMLElement)).toContain('Away in PMD');

        const link = rows[0]!.querySelector('a');
        expect(link?.getAttribute('href')).toBe('/pokemon/team?username=viewer_one');
        expect(text(link as HTMLElement).trim()).toBe('View team of Viewer_One');
        // A display name that is not a login cannot be looked up, so it gets no link.
        expect(rows[1]!.querySelector('a')).toBeNull();
    });

    it('offers a retry when the API fails', async () => {
        const fixture = TestBed.createComponent(LeaderboardPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/leaderboard`).flush(null, { status: 503, statusText: 'Down' });
        await settle(fixture);
        const root = fixture.nativeElement as HTMLElement;
        expect(text(root)).toContain('Brobot had a problem.');

        [...root.querySelectorAll('button')].find(b => b.textContent.includes('Try again'))!.click();
        TestBed.tick();
        http.expectOne(`${API}/pokemon/leaderboard`).flush([]);
        await settle(fixture);
        expect(text(root)).toContain('Nobody has a Pokémon yet.');
    });
});
