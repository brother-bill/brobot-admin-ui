/**
 * Card art for a Pokémon, from the 2022 art set (`environment.pokemonArtUrl`):
 * `<base>/<variant>/<dexNum>`. Only some species have separate female art;
 * for the rest a female Pokémon uses the default (or shiny) image.
 */

/** Dex numbers with female-specific art in the set (carried over from the 2022 site). */
export const FEMALE_ART_DEX = new Set([
    3, 12, 19, 20, 25, 26, 41, 42, 44, 45, 64, 65, 84, 85, 97, 111, 112, 118, 119, 123, 129, 130,
    154, 165, 166, 178, 185, 186, 190, 194, 195, 198, 202, 203, 207, 208, 212, 214, 215, 217, 221,
    224, 229, 232, 255, 256, 257, 267, 269, 272, 274, 275, 307, 308, 315, 316, 317, 322, 323, 332,
    350, 369, 396, 397, 398, 399, 400, 401, 402, 403, 404, 405, 407, 415, 417, 418, 419, 424, 443,
    444, 445, 449, 450, 453, 454, 456, 457, 459, 460, 461, 464, 465, 473,
]);

export interface ArtSubject {
    dexNum: number;
    gender: string;
    shiny: boolean;
}

export function pokemonArtUrl(base: string, { dexNum, gender, shiny }: ArtSubject): string {
    const female = gender === 'F' && FEMALE_ART_DEX.has(dexNum);
    const variant = female ? (shiny ? 'shiny_female' : 'female') : shiny ? 'shiny' : 'default';
    return `${base.replace(/\/+$/, '')}/${variant}/${dexNum}`;
}

export function pokemonCryUrl(base: string, nameId: string): string {
    return `${base.replace(/\/+$/, '')}/${encodeURIComponent(nameId)}.mp3`;
}

const GENDER_LABEL: Record<string, string> = { M: 'Male', F: 'Female', N: 'No gender' };

export function genderLabel(gender: string): string {
    return GENDER_LABEL[gender] ?? 'Unknown gender';
}

/** Gender as a symbol for sighted readers; always paired with {@link genderLabel} for assistive tech. */
export function genderSymbol(gender: string): string {
    return gender === 'M' ? '♂' : gender === 'F' ? '♀' : '';
}
