/**
 * Local development: brobot's API on :3000 (`pnpm --filter @singularity/brobot run dev`),
 * this site on :4207. Add `http://localhost:4207` to the API's `ALLOWED_ORIGINS`
 * and point its `UI_URL` here so the Twitch callbacks land back on this site.
 */
export const environment = {
    production: false,
    /** brobot's API origin. Every HTTP route lives under `${apiUrl}/api`. */
    apiUrl: 'http://localhost:3000',
    /** The stream overlay's receive-only socket (`/api/admin-ui`). */
    overlaySocketUrl: 'ws://localhost:3000/api/admin-ui',
    /** Pokémon card art, `${base}/<default|shiny|female|shiny_female>/<dexNum>` (the 2022 set). */
    pokemonArtUrl: 'https://res.cloudinary.com/dsmddewxs/image/upload/v1668805125/pokemon/960x960',
    /** Pokémon cries for the overlay's roar, `${base}/<nameId>.mp3` (the 2022 set). */
    pokemonCryUrl:
        'https://res.cloudinary.com/dsmddewxs/video/upload/v1669433072/stream-overlay/pokemon-sounds',
};
