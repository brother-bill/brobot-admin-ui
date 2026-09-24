import { signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayFrame, OverlaySocket, OverlaySocketStatus } from './overlay-socket';
import { OVERLAY_SOCKET } from './overlay-socket';
import { OverlaySound } from './overlay-sound';
import { QUACK_URL, ROAR_MS, StreamOverlayComponent } from './stream-overlay.component';

class FakeSocket implements OverlaySocket {
    readonly frames = new Subject<OverlayFrame>();
    readonly frames$ = this.frames.asObservable();
    readonly status = signal<OverlaySocketStatus>('open');
}

const roar = (login: string, name: string): OverlayFrame => ({
    type: 'pokemon_roar',
    login,
    pokemon: { name, nameId: name.toLowerCase(), dexNum: 25, level: 30, shiny: false, gender: 'M', color: 'Yellow' },
});

describe('StreamOverlayComponent', () => {
    let socket: FakeSocket;
    let played: string[];

    beforeEach(() => {
        vi.useFakeTimers();
        socket = new FakeSocket();
        played = [];
        TestBed.configureTestingModule({
            providers: [
                provideZonelessChangeDetection(),
                { provide: OVERLAY_SOCKET, useValue: socket },
                { provide: OverlaySound, useValue: { play: (url: string) => played.push(url) } },
            ],
        });
    });

    afterEach(() => vi.useRealTimers());

    function render() {
        const fixture = TestBed.createComponent(StreamOverlayComponent);
        fixture.detectChanges();
        return { fixture, root: fixture.nativeElement as HTMLElement };
    }

    it('plays the duck', () => {
        render();
        socket.frames.next({ type: 'quack' });
        expect(played).toEqual([QUACK_URL]);
    });

    it('shows roars one after another, with their cries', () => {
        const { fixture, root } = render();
        socket.frames.next(roar('viewer_one', 'Pikachu'));
        socket.frames.next(roar('viewer_two', 'Eevee'));
        fixture.detectChanges();
        expect(root.querySelector('figcaption')?.textContent.trim()).toBe("viewer_one's Pikachu · Lv 30");
        expect(played).toHaveLength(1);
        expect(played[0]).toMatch(/\/pikachu\.mp3$/);

        vi.advanceTimersByTime(ROAR_MS);
        fixture.detectChanges();
        expect(root.querySelector('figcaption')?.textContent.trim()).toBe("viewer_two's Eevee · Lv 30");
        expect(played[1]).toMatch(/\/eevee\.mp3$/);

        vi.advanceTimersByTime(ROAR_MS);
        fixture.detectChanges();
        expect(root.querySelector('figure')).toBeNull();
    });

    it('draws a running vote and hides it when it resets', () => {
        const { fixture, root } = render();
        expect(root.querySelector('meter')).toBeNull();

        socket.frames.next({ type: 'vote_state', vote: 'chatban', count: 2, threshold: 4, caged: false });
        fixture.detectChanges();
        const meter = root.querySelector('meter');
        expect(meter?.getAttribute('aria-label')).toBe('!chatban votes');
        expect(meter?.value).toBe(2);
        expect(root.querySelector('.vote')?.textContent).toContain('2 / 4');

        socket.frames.next({ type: 'vote_state', vote: 'chatban', count: 4, threshold: 4, caged: true });
        fixture.detectChanges();
        expect(root.querySelector('.vote')?.textContent).toContain('Enter key banned');

        socket.frames.next({ type: 'vote_state', vote: 'chatban', count: 0, threshold: 4, caged: false });
        fixture.detectChanges();
        expect(root.querySelector('meter')).toBeNull();
    });

    it('says when it has lost brobot', () => {
        const { fixture, root } = render();
        expect(root.querySelector('[role="status"]')).toBeNull();
        socket.status.set('reconnecting');
        fixture.detectChanges();
        expect(root.querySelector('[role="status"]')?.textContent).toContain('reconnecting');
    });
});
