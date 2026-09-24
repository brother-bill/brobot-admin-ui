/**
 * Production: the site is served from `brobot.live` and the API from
 * `admin.brobot.live` (migration plan §2). The two are the same site, so the
 * API's `SameSite=Strict` session cookies still travel with this site's
 * credentialed requests; the API must list `https://brobot.live` in
 * `ALLOWED_ORIGINS` and use it as `UI_URL`.
 */
export const environment = {
    production: true,
    apiUrl: 'https://admin.brobot.live',
    overlaySocketUrl: 'wss://admin.brobot.live/api/admin-ui',
    pokemonArtUrl: 'https://res.cloudinary.com/dsmddewxs/image/upload/v1668805125/pokemon/960x960',
    pokemonCryUrl:
        'https://res.cloudinary.com/dsmddewxs/video/upload/v1669433072/stream-overlay/pokemon-sounds',
};
