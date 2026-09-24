import { HttpErrorResponse } from '@angular/common/http';

/** A sentence a viewer can act on, for an HTTP failure the page did not handle itself. */
export function describeHttpError(error: unknown, subject = 'brobot'): string {
    if (!(error instanceof HttpErrorResponse)) return `Something went wrong talking to ${subject}.`;
    switch (error.status) {
        case 0:
            return `Can't reach ${subject} right now. Check your connection and try again.`;
        case 401:
            return 'Your session has ended. Sign in again to continue.';
        case 403:
            return 'Only the streamer and brobot admins can do that.';
        case 429:
            return 'Too many requests. Wait a minute and try again.';
        case 502:
            return "Twitch didn't answer. Try again in a minute.";
        default:
            return error.status >= 500
                ? `${capitalise(subject)} had a problem. Try again in a minute.`
                : `${capitalise(subject)} refused that request (${error.status}).`;
    }
}

function capitalise(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
