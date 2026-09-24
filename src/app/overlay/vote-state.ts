/**
 * PROPOSED frame on `/api/admin-ui`: the live `!chatban` / `!voiceban` vote.
 *
 * brobot does not send this yet. Its overlay socket (`overlay-events.ts`, a
 * verbatim copy of `apps/brobot/src/modules/twitch/overlay-events.ts`)
 * carries only `pokemon_roar` and `quack`; the vote counts live in
 * `VotesService` / `VoteCounter` and go only to the streamer client. The
 * overlay renders this frame the moment the API starts sending it — on every
 * vote, on reaching the threshold (`caged: true`), and on reset
 * (`count: 0, caged: false`) — and until then shows no vote meter at all.
 * The wire rule on that socket is "unknown types are ignored" in both
 * directions, so shipping either side first is safe.
 *
 * When brobot adds it, the type belongs in `overlay-events.ts` there (and
 * the copy here is refreshed); this file then goes away.
 */
export interface VoteStateEvent {
    type: 'vote_state';
    vote: 'chatban' | 'voiceban';
    /** Distinct viewers who have voted in the running vote. */
    count: number;
    /** Votes needed (brobot's `VOTE_THRESHOLD`, 4). */
    threshold: number;
    /** The threshold was reached and the ban is running; further votes are refused until it ends. */
    caged: boolean;
}
