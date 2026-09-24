import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API, appTestProviders, settle, text } from '../testing/test-helpers';
import { BattleOutcomePage } from './battle-outcome.page';

describe('BattleOutcomePage', () => {
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: appTestProviders() });
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('shows the last 1v1 log line by line, and an empty team battle', async () => {
        const fixture = TestBed.createComponent(BattleOutcomePage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/battle-outcome`).flush({
            outcome: ['viewer_one sent out Pikachu!', 'Pikachu used Thunderbolt!', 'viewer_one won!'],
            updatedDate: '2026-09-20T18:00:00.000Z',
        });
        http.expectOne(`${API}/pokemon/team-battle-outcome`).flush({ outcome: [], updatedDate: null });
        await settle(fixture);
        const root = fixture.nativeElement as HTMLElement;

        const log = root.querySelector('ol.log');
        expect(log?.getAttribute('aria-labelledby')).toBe('battle-1v1');
        expect([...log!.querySelectorAll('li')].map(li => li.textContent)).toEqual([
            'viewer_one sent out Pikachu!',
            'Pikachu used Thunderbolt!',
            'viewer_one won!',
        ]);
        expect(root.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-20T18:00:00.000Z');
        expect(text(root)).toContain('No team battle has been fought yet.');
    });

    it('refreshes both battles', async () => {
        const fixture = TestBed.createComponent(BattleOutcomePage);
        TestBed.tick();
        http.expectOne(`${API}/pokemon/battle-outcome`).flush({ outcome: [], updatedDate: null });
        http.expectOne(`${API}/pokemon/team-battle-outcome`).flush({ outcome: [], updatedDate: null });
        await settle(fixture);

        [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
            .find(b => b.textContent.includes('Refresh'))!
            .click();
        TestBed.tick();
        http.expectOne(`${API}/pokemon/battle-outcome`).flush({ outcome: ['a'], updatedDate: null });
        http.expectOne(`${API}/pokemon/team-battle-outcome`).flush({ outcome: ['b'], updatedDate: null });
        await settle(fixture);
        expect(fixture.nativeElement.querySelectorAll('ol.log')).toHaveLength(2);
    });
});
