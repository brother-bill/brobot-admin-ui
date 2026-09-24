import type { ParamMap } from '@angular/router';

/**
 * What the API's Twitch callbacks put on the URL when they send the browser
 * back here (`apps/brobot/README.md`, "Auth"): `?auth_error=<reason>` on any
 * failure, `?linked=streamer|bot` after the streamer or bot flow.
 */
export const AUTH_RETURN_PARAMS = ['auth_error', 'linked'] as const;

export interface AuthNotice {
    tone: 'success' | 'warn' | 'error';
    message: string;
}

const ERROR_COPY: Record<string, string> = {
    access_denied: 'Sign-in was cancelled on Twitch. Nothing was changed.',
    invalid_state: 'That sign-in link had expired or was already used. Please sign in again.',
    wrong_account:
        "That Twitch account can't be linked here. In Twitch's account picker, choose the streamer's account for the streamer link, or the bot's account for the bot link.",
    twitch_unavailable: "Twitch didn't answer. Please try again in a minute.",
};

const LINKED_COPY: Record<string, string> = {
    streamer: "The streamer's Twitch account is linked. You are still signed in as yourself.",
    bot: "brobot's bot account is linked. You are still signed in as yourself.",
};

/** Turns the callback's query parameters into a notice, or null when there is nothing to say. */
export function readAuthReturn(params: ParamMap): AuthNotice | null {
    const error = params.get('auth_error');
    if (error !== null) {
        return {
            tone: error === 'access_denied' ? 'warn' : 'error',
            message: ERROR_COPY[error] ?? 'Signing in with Twitch failed. Please try again.',
        };
    }
    const linked = params.get('linked');
    if (linked !== null && linked in LINKED_COPY) {
        return { tone: 'success', message: LINKED_COPY[linked] ?? '' };
    }
    return null;
}
