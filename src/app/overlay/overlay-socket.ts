import type { Signal } from '@angular/core';
import { InjectionToken, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { filter, map, retry, share, timer } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import type { OverlayEvent } from './overlay-events';
import type { VoteStateEvent } from './vote-state';

/** Everything the overlay understands: brobot's frames, plus the proposed vote frame. */
export type OverlayFrame = OverlayEvent | VoteStateEvent;

export type OverlaySocketStatus = 'connecting' | 'open' | 'reconnecting';

/**
 * The overlay's view of `/api/admin-ui`. An interface so the page never
 * touches a WebSocket directly: tests (and a future transport) provide their
 * own.
 */
export interface OverlaySocket {
    /** Every valid frame, for as long as the page subscribes. Reconnects on its own. */
    readonly frames$: Observable<OverlayFrame>;
    readonly status: Signal<OverlaySocketStatus>;
}

export const OVERLAY_SOCKET = new InjectionToken<OverlaySocket>('OVERLAY_SOCKET');

const RECONNECT_DELAY_MS = 3_000;

/**
 * The browser WebSocket, reconnecting every {@link RECONNECT_DELAY_MS} while
 * anything is subscribed. The socket closes with the last unsubscribe, so it
 * lives exactly as long as the overlay page.
 */
export class WebSocketOverlaySocket implements OverlaySocket {
    private readonly _status = signal<OverlaySocketStatus>('connecting');
    readonly status = this._status.asReadonly();
    readonly frames$: Observable<OverlayFrame>;

    constructor(url: string) {
        const subject = webSocket<unknown>({
            url,
            // Parse leniently: one bad frame must not tear the socket down.
            deserializer: event => safeJson(event.data),
            openObserver: { next: () => this._status.set('open') },
            closeObserver: { next: () => this._status.set('reconnecting') },
        });
        this.frames$ = subject.pipe(
            retry({ delay: () => timer(RECONNECT_DELAY_MS) }),
            map(parseOverlayFrame),
            filter((frame): frame is OverlayFrame => frame !== null),
            share(),
        );
    }
}

function safeJson(data: unknown): unknown {
    if (typeof data !== 'string') return null;
    try {
        return JSON.parse(data) as unknown;
    } catch {
        return null;
    }
}

/** Checks a frame's shape; anything else (including unknown types) is ignored, per the wire rule. */
export function parseOverlayFrame(value: unknown): OverlayFrame | null {
    if (!isRecord(value)) return null;
    switch (value['type']) {
        case 'quack':
            return { type: 'quack' };
        case 'pokemon_roar': {
            const pokemon = value['pokemon'];
            if (typeof value['login'] !== 'string' || !isRecord(pokemon)) return null;
            const { name, nameId, dexNum, level, shiny, gender, color } = pokemon;
            if (
                typeof name !== 'string' ||
                typeof nameId !== 'string' ||
                typeof dexNum !== 'number' ||
                typeof level !== 'number' ||
                typeof shiny !== 'boolean'
            ) {
                return null;
            }
            return {
                type: 'pokemon_roar',
                login: value['login'],
                pokemon: {
                    name,
                    nameId,
                    dexNum,
                    level,
                    shiny,
                    gender: typeof gender === 'string' ? gender : 'N',
                    color: typeof color === 'string' ? color : '',
                },
            };
        }
        case 'vote_state': {
            const { vote, count, threshold, caged } = value;
            if (
                (vote !== 'chatban' && vote !== 'voiceban') ||
                typeof count !== 'number' ||
                typeof threshold !== 'number' ||
                threshold < 1 ||
                typeof caged !== 'boolean'
            ) {
                return null;
            }
            return { type: 'vote_state', vote, count, threshold, caged };
        }
        default:
            return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
