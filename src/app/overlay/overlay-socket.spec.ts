import { describe, expect, it } from 'vitest';
import { parseOverlayFrame } from './overlay-socket';

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
