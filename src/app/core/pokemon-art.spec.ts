import { describe, expect, it } from 'vitest';
import { genderLabel, genderSymbol, pokemonArtUrl, pokemonCryUrl } from './pokemon-art';

const BASE = 'https://cdn.test/art/';

describe('pokemonArtUrl', () => {
    it('picks the default or shiny art', () => {
        expect(pokemonArtUrl(BASE, { dexNum: 1, gender: 'M', shiny: false })).toBe(
            'https://cdn.test/art/default/1',
        );
        expect(pokemonArtUrl(BASE, { dexNum: 1, gender: 'M', shiny: true })).toBe(
            'https://cdn.test/art/shiny/1',
        );
    });

    it('uses female art only for species that have it', () => {
        expect(pokemonArtUrl(BASE, { dexNum: 25, gender: 'F', shiny: false })).toBe(
            'https://cdn.test/art/female/25',
        );
        expect(pokemonArtUrl(BASE, { dexNum: 25, gender: 'F', shiny: true })).toBe(
            'https://cdn.test/art/shiny_female/25',
        );
        expect(pokemonArtUrl(BASE, { dexNum: 1, gender: 'F', shiny: true })).toBe(
            'https://cdn.test/art/shiny/1',
        );
    });
});

describe('pokemon helpers', () => {
    it('builds the cry url from the species id', () => {
        expect(pokemonCryUrl('https://cdn.test/cries', 'mr-mime')).toBe('https://cdn.test/cries/mr-mime.mp3');
    });

    it('names every gender for assistive tech', () => {
        expect(genderLabel('M')).toBe('Male');
        expect(genderLabel('F')).toBe('Female');
        expect(genderLabel('N')).toBe('No gender');
        expect(genderSymbol('N')).toBe('');
    });
});
