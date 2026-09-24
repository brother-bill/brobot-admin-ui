import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketOverlaySocket, parseOverlayFrame } from './overlay-socket';

/** Just enough WebSocket for rxjs: the test drives open, message and close. */
class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    readyState = 0;
    binaryType = 'blob';
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    open(): void {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
    }

    receive(data: string): void {
        this.onmessage?.({ data } as MessageEvent);
    }

    serverClose(wasClean: boolean): void {
        this.readyState = 3;
        this.onclose?.({ wasClean, code: wasClean ? 1001 : 1006, reason: '' } as CloseEvent);
    }

    send(): void {
        // receive-only
    }

    close(): void {
        this.readyState = 3;
    }
}

describe('WebSocketOverlaySocket', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
    });

    afterEach(() => vi.useRealTimers());

    it('passes valid frames through, drops junk, and reconnects after any close', () => {
        const socket = new WebSocketOverlaySocket('wss://api.test/api/admin-ui', FakeWebSocket as never);
        const frames: unknown[] = [];
        const subscription = socket.frames$.subscribe(frame => frames.push(frame));
        expect(socket.status()).toBe('connecting');

        const first = FakeWebSocket.instances[0]!;
        expect(first.url).toBe('wss://api.test/api/admin-ui');
        first.open();
        expect(socket.status()).toBe('open');
        first.receive('{"type":"quack"}');
        first.receive('not json');
        first.receive('{"type":"future_thing"}');
        expect(frames).toEqual([{ type: 'quack' }]);

        // A clean close (a restart behind a proxy) completes the stream: still reconnect.
        first.serverClose(true);
        expect(socket.status()).toBe('reconnecting');
        vi.advanceTimersByTime(3_000);
        expect(FakeWebSocket.instances).toHaveLength(2);

        // So does a dropped connection.
        FakeWebSocket.instances[1]!.open();
        FakeWebSocket.instances[1]!.serverClose(false);
        vi.advanceTimersByTime(3_000);
        expect(FakeWebSocket.instances).toHaveLength(3);

        subscription.unsubscribe();
    });
});

describe('parseOverlayFrame', () => {
    it('accepts the frames brobot sends', () => {
        expect(parseOverlayFrame({ type: 'quack' })).toEqual({ type: 'quack' });
        const roar = {
            type: 'pokemon_roar',
            login: 'viewer',
            pokemon: { name: 'Pikachu', nameId: 'pikachu', dexNum: 25, level: 9, shiny: false, gender: 'F', color: 'Yellow' },
        };
        expect(parseOverlayFrame(roar)).toEqual(roar);
    });

    it('accepts the proposed vote frame', () => {
        const vote = { type: 'vote_state', vote: 'chatban', count: 2, threshold: 4, caged: false };
        expect(parseOverlayFrame(vote)).toEqual(vote);
    });

    it('ignores unknown types and malformed frames', () => {
        expect(parseOverlayFrame({ type: 'something_new' })).toBeNull();
        expect(parseOverlayFrame(null)).toBeNull();
        expect(parseOverlayFrame('quack')).toBeNull();
        expect(parseOverlayFrame({ type: 'pokemon_roar', login: 'x', pokemon: { name: 'P' } })).toBeNull();
        expect(parseOverlayFrame({ type: 'vote_state', vote: 'kick', count: 1, threshold: 4, caged: false })).toBeNull();
        expect(parseOverlayFrame({ type: 'vote_state', vote: 'chatban', count: 1, threshold: 0, caged: false })).toBeNull();
    });
});
