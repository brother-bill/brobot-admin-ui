import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TeamPokemon, TeamResponse } from '../core/brobot-api';
import { API, appTestProviders, text } from '../testing/test-helpers';
import { TeamSearchPage, toAway, toSlots } from './team-search.page';

function pokemon(slot: number | null, overrides: Partial<TeamPokemon> = {}): TeamPokemon {
    return {
        name: 'Pikachu',
        nameId: 'pikachu',
        slot,
        level: 12,
        shiny: false,
        wins: 3,
        losses: 1,
        draws: 0,
        item: '',
        moves: ['thunderbolt', 'quickattack'],
        dexNum: 25,
        color: 'Yellow',
        types: ['Electric'],
        gender: 'F',
        nature: 'Timid',
        ability: 'Static',
        activeGame: 'brobot',
        createdDate: '2022-11-20T00:00:00.000Z',
        updatedDate: '2022-11-21T00:00:00.000Z',
        ...overrides,
    };
}

const TEAM: TeamResponse = {
    displayName: 'Viewer_One',
    pokemonTeam: {
        pokemon: [pokemon(1), pokemon(3, { name: 'Eevee', nameId: 'eevee', dexNum: 133, gender: 'M', shiny: true })],
    },
};

/** Two slotted, two away in pmd-online (no slot). */
const TEAM_WITH_AWAY: TeamResponse = {
    displayName: 'Viewer_Two',
    pokemonTeam: {
        pokemon: [
            pokemon(2, { name: 'Eevee', nameId: 'eevee', dexNum: 133, gender: 'M' }),
            pokemon(null, { name: 'Bulbasaur', nameId: 'bulbasaur', dexNum: 1, gender: 'M', activeGame: 'pmd', level: 30 }),
            pokemon(5),
            pokemon(null, { name: 'Squirtle', nameId: 'squirtle', dexNum: 7, gender: 'F', activeGame: 'pmd', shiny: true }),
        ],
    },
};

describe('toSlots', () => {
    it('always gives six slots in order, empty ones included', () => {
        const slots = toSlots(TEAM.pokemonTeam, 'https://art.test');
        expect(slots.map(s => s.slot)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(slots.map(s => s.pokemon?.name ?? null)).toEqual(['Pikachu', null, 'Eevee', null, null, null]);
        expect(slots[0]?.pokemon?.artUrl).toBe('https://art.test/female/25');
        expect(toSlots(null, 'x').every(s => s.pokemon === null)).toBe(true);
    });

    it('leaves Pokémon without a slot out of the six', () => {
        const slots = toSlots(TEAM_WITH_AWAY.pokemonTeam, 'https://art.test');
        expect(slots.map(s => s.pokemon?.name ?? null)).toEqual([null, 'Eevee', null, null, 'Pikachu', null]);
    });
});

describe('toAway', () => {
    it('lists the Pokémon without a slot, in API order, with their art', () => {
        const away = toAway(TEAM_WITH_AWAY.pokemonTeam, 'https://art.test');
        expect(away.map(p => p.name)).toEqual(['Bulbasaur', 'Squirtle']);
        expect(away[1]?.artUrl).toBe('https://art.test/shiny/7');
        expect(toAway(TEAM.pokemonTeam, 'x')).toEqual([]);
        expect(toAway(null, 'x')).toEqual([]);
    });
});

describe('TeamSearchPage', () => {
    let http: HttpTestingController;
    let harness: RouterTestingHarness;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            providers: appTestProviders([{ path: 'pokemon/team', component: TeamSearchPage }]),
        });
        http = TestBed.inject(HttpTestingController);
        harness = await RouterTestingHarness.create();
    });

    afterEach(() => http.verify());

    async function settled(): Promise<HTMLElement> {
        TestBed.tick();
        await harness.fixture.whenStable();
        harness.detectChanges();
        return harness.routeNativeElement!;
    }

    it("looks up the URL's username and shows the six slots", async () => {
        await harness.navigateByUrl('/pokemon/team?username=Viewer_One', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=viewer_one`).flush(TEAM);
        const root = await settled();

        expect(root.querySelector<HTMLInputElement>('input')?.value).toBe('Viewer_One');
        expect(root.querySelector('h2')?.textContent).toBe("Viewer_One's team");
        const slots = [...root.querySelectorAll('ol.slots > li')];
        expect(slots).toHaveLength(6);
        const name = slots[0]!.querySelector('h3')!;
        expect(text(name).trim()).toBe('Pikachu ♀(Female)');
        expect(name.querySelector('[aria-hidden="true"]')?.textContent).toBe('♀');
        expect(text(slots[0] as HTMLElement)).toContain('3 wins, 1 losses, 0 draws');
        expect(text(slots[1] as HTMLElement)).toContain('Empty');
        expect(text(slots[2] as HTMLElement)).toContain('Shiny');
        expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe("Viewer_One's team: 2 Pokémon.");
    });

    it('shows no away group or away count when every Pokémon has a slot', async () => {
        await harness.navigateByUrl('/pokemon/team?username=Viewer_One', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=viewer_one`).flush(TEAM);
        const root = await settled();

        expect(text(root)).toContain('2 of 6 slots filled');
        expect(text(root)).not.toContain('Away in PMD');
        expect(text(root)).not.toContain('away in PMD');
        expect(root.querySelector('#away-heading')).toBeNull();
    });

    it('lists Pokémon away in PMD under the six slots, counted apart', async () => {
        await harness.navigateByUrl('/pokemon/team?username=Viewer_Two', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=viewer_two`).flush(TEAM_WITH_AWAY);
        const root = await settled();

        const slots = [...root.querySelectorAll('ol.slots > li')] as HTMLElement[];
        expect(slots).toHaveLength(6);
        expect(slots.map(li => li.querySelector('h3')?.firstChild?.textContent?.trim() ?? null)).toEqual([
            null,
            'Eevee',
            null,
            null,
            'Pikachu',
            null,
        ]);
        expect(text(slots[0]!)).toContain('Slot 1');
        expect(text(slots[0]!)).toContain('Empty');
        expect(slots.some(li => text(li).includes('Away in PMD'))).toBe(false);

        expect(text(root)).toContain('2 of 6 slots filled');
        expect(text(root)).toContain('2 away in PMD');

        const group = root.querySelector<HTMLElement>('section[aria-labelledby="away-heading"]')!;
        expect(group.querySelector('h3')?.textContent).toBe('Away in PMD');
        const away = [...group.querySelectorAll('ul.slots > li')] as HTMLElement[];
        expect(away).toHaveLength(2);
        const first = away[0]!.querySelector('article')!;
        const name = first.querySelector('h4')!;
        expect(text(name).trim()).toBe('Bulbasaur ♂(Male)');
        expect(first.getAttribute('aria-labelledby')).toBe(name.id);
        expect(text(first)).toContain('Away in PMD');
        expect(text(first)).toContain('Lv 30');
        expect(text(first)).not.toContain('Slot');
        expect(text(away[1]!)).toContain('Squirtle');
        expect(text(away[1]!)).toContain('Shiny');

        const ids = [...root.querySelectorAll('[id]')].map(el => el.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe(
            "Viewer_Two's team: 2 Pokémon, 2 away in PMD.",
        );
    });

    it('still shows the away group when every Pokémon is away', async () => {
        await harness.navigateByUrl('/pokemon/team?username=Viewer_Three', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=viewer_three`).flush({
            displayName: 'Viewer_Three',
            pokemonTeam: { pokemon: [pokemon(null, { activeGame: 'pmd' })] },
        } satisfies TeamResponse);
        const root = await settled();

        expect(text(root)).not.toContain('has no Pokémon yet');
        expect(root.querySelectorAll('ol.slots > li article')).toHaveLength(0);
        expect(text(root)).toContain('0 of 6 slots filled');
        expect(root.querySelectorAll('section[aria-labelledby="away-heading"] li article')).toHaveLength(1);
    });

    it('explains a login brobot has never seen', async () => {
        await harness.navigateByUrl('/pokemon/team?username=nobody', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=nobody`).flush(
            { statusCode: 404, message: 'No brobot user with that login' },
            { status: 404, statusText: 'Not Found' },
        );
        const root = await settled();
        expect(text(root)).toContain('brobot has never seen a Twitch user called nobody.');
    });

    it('explains the rate limit', async () => {
        await harness.navigateByUrl('/pokemon/team?username=busy', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=busy`).flush(null, { status: 429, statusText: 'Too Many' });
        const root = await settled();
        expect(text(root)).toContain('Too many requests. Wait a minute and try again.');
    });

    it('refuses a username Twitch could not have issued, without asking the API', async () => {
        await harness.navigateByUrl('/pokemon/team', TeamSearchPage);
        let root = await settled();
        const input = root.querySelector<HTMLInputElement>('input')!;
        input.value = 'not a login!';
        input.dispatchEvent(new Event('input'));
        root.querySelector('form')!.dispatchEvent(new Event('submit'));
        root = await settled();

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(text(root)).toContain('A Twitch username is 1 to 25 letters, numbers or underscores.');
        expect(document.activeElement).toBe(input);
        http.expectNone(() => true);
    });

    it('says what is missing when the box is submitted empty', async () => {
        await harness.navigateByUrl('/pokemon/team', TeamSearchPage);
        let root = await settled();
        root.querySelector('form')!.dispatchEvent(new Event('submit'));
        root = await settled();
        const input = root.querySelector<HTMLInputElement>('input')!;
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(text(root)).toContain('Enter a Twitch username.');
        http.expectNone(() => true);
    });

    it('does not repeat a failed search in the polite region; the alert says it', async () => {
        await harness.navigateByUrl('/pokemon/team?username=busy', TeamSearchPage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/teams?login=busy`).flush(null, { status: 502, statusText: 'Bad Gateway' });
        const root = await settled();
        expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe('');
        expect(text(root)).toContain("Twitch didn't answer.");
    });

    it('puts a new search in the URL, so it can be shared', async () => {
        await harness.navigateByUrl('/pokemon/team', TeamSearchPage);
        const root = await settled();
        const input = root.querySelector<HTMLInputElement>('input')!;
        input.value = '  Some_Viewer ';
        input.dispatchEvent(new Event('input'));
        root.querySelector('form')!.dispatchEvent(new Event('submit'));
        await new Promise(resolve => setTimeout(resolve));
        TestBed.tick();
        expect(TestBed.inject(Router).url).toBe('/pokemon/team?username=some_viewer');
        http.expectOne(`${API}/pokemon/teams?login=some_viewer`).flush({ displayName: 'Some_Viewer', pokemonTeam: null });
        const after = await settled();
        expect(text(after)).toContain('Some_Viewer has no Pokémon yet.');
    });
});
