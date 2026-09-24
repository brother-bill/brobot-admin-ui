import { convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { readAuthReturn } from './auth-return';

describe('readAuthReturn', () => {
    it('says nothing for an ordinary visit', () => {
        expect(readAuthReturn(convertToParamMap({ username: 'x' }))).toBeNull();
    });

    it('explains each failure the API reports', () => {
        expect(readAuthReturn(convertToParamMap({ auth_error: 'access_denied' }))).toEqual({
            tone: 'warn',
            message: 'Sign-in was cancelled on Twitch. Nothing was changed.',
        });
        for (const reason of ['invalid_state', 'wrong_account', 'twitch_unavailable']) {
            const notice = readAuthReturn(convertToParamMap({ auth_error: reason }));
            expect(notice?.tone).toBe('error');
            expect(notice?.message).not.toContain('failed. Please try again');
        }
    });

    it('falls back to a generic message for a reason it does not know', () => {
        expect(readAuthReturn(convertToParamMap({ auth_error: 'new_reason' }))?.message).toBe(
            'Signing in with Twitch failed. Please try again.',
        );
    });

    it('confirms a streamer or bot link, and ignores anything else', () => {
        expect(readAuthReturn(convertToParamMap({ linked: 'streamer' }))?.tone).toBe('success');
        expect(readAuthReturn(convertToParamMap({ linked: 'bot' }))?.message).toContain('bot account');
        expect(readAuthReturn(convertToParamMap({ linked: 'nope' }))).toBeNull();
    });
});
