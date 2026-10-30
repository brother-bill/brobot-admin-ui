import { DOCUMENT } from '@angular/common';
import type { ElementRef } from '@angular/core';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    Injector,
    afterNextRender,
    computed,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { pokemonArtUrl, pokemonCryUrl } from '../core/pokemon-art';
import type { DebsAlertEvent, PokemonRoarEvent } from './overlay-events';
import type { OverlayFrame } from './overlay-socket';
import { OVERLAY_SOCKET } from './overlay-socket';
import { OverlaySound } from './overlay-sound';
import type { VoteStateEvent } from './vote-state';

/** How long one roar stays on screen. Roars queue; they never overlap. */
export const ROAR_MS = 4_000;

/** The duck, as the 2022 overlay played it. */
export const QUACK_URL =
    'https://res.cloudinary.com/dsmddewxs/video/upload/v1669460570/stream-overlay/duck.mp3';

/** The DEBS Alert jingle, as the 2022 overlay played it (at full volume). */
export const DEBS_ALERT_URL =
    'https://res.cloudinary.com/dsmddewxs/video/upload/v1669253835/stream-overlay/DEBS_Alert.mp3';

/** How long the DEBS Alert bar takes to scale in, and to scale out again. */
export const DEBS_SCALE_MS = 750;

/**
 * How long a DEBS Alert's message scrolls, given its rendered width: the 2022
 * marquee's formula, a second per 280 px of text plus four seconds for the
 * text to cross the bar first. That is about 280 px/s for a long message.
 */
export function debsAlertDurationMs(scrollWidth: number): number {
    return Math.ceil(scrollWidth / 280) * 1000 + 4000;
}

type VoteKind = VoteStateEvent['vote'];

interface Roar {
    login: string;
    name: string;
    level: number;
    shiny: boolean;
    artUrl: string;
    cryUrl: string;
}

interface DebsAlert {
    message: string;
    /** 0 until the message has been measured; then it scrolls for this long. */
    durationMs: number;
    leaving: boolean;
}

const VOTE_COPY: Record<VoteKind, { title: string; caged: string }> = {
    chatban: { title: '!chatban', caged: 'Enter key banned' },
    voiceban: { title: '!voiceban', caged: 'Microphone muted' },
};

/**
 * The OBS browser source (`/twitch/supahot/overlay`): a transparent page
 * that shows what brobot pushes over `/api/admin-ui` — a viewer's Pokémon
 * when they redeem a roar, a viewer's DEBS Alert as a scrolling news
 * ticker, the duck, and (once brobot sends it, see
 * `vote-state.ts`) the running `!chatban` / `!voiceban` vote. It only reads;
 * nothing here acts on the streamer's machine — that is brobot-client's job.
 */
@Component({
    selector: 'app-stream-overlay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: `
        :host {
            position: fixed;
            inset: 0;
            display: block;
            overflow: hidden;
            background: transparent;
            color: #fff; /* contrast-ok the overlay sits over game footage, not the theme: white on its own near-black panels, plus a black text shadow */
            font: 600 1.5rem/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif;
            /* Legible over any game footage. */
            text-shadow:
                0 0 4px #000,
                0 2px 6px #000;
        }
        .votes {
            position: absolute;
            top: 1.5rem;
            right: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            width: 22rem;
        }
        .vote {
            padding: 0.75rem 1rem;
            border-radius: 12px;
            background: rgb(22 20 28 / 0.85);
        }
        .vote--caged {
            background: rgb(157 67 0 / 0.92);
        }
        .vote__head {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
        }
        .vote__meter {
            display: block;
            width: 100%;
            height: 0.75rem;
            margin-top: 0.5rem;
            accent-color: #b69cff;
        }
        .roar {
            position: absolute;
            left: 50%;
            bottom: 3rem;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            animation: roar-in 300ms ease-out;
            transition: bottom 300ms ease-out;
        }
        /* Clear of the DEBS Alert bar (100px up, 90px tall), so both can show. */
        .roar--above-debs {
            bottom: calc(190px + 1.5rem);
        }
        .roar img {
            width: 22rem;
            height: 22rem;
            object-fit: contain;
            filter: drop-shadow(0 4px 12px rgb(0 0 0 / 0.6));
        }
        .roar__caption {
            padding: 0.5rem 1rem;
            border-radius: 12px;
            background: rgb(22 20 28 / 0.85);
        }
        .debs {
            position: absolute;
            inset-inline: 0;
            bottom: 100px;
            display: flex;
            align-items: center;
            width: 90vw;
            height: 90px;
            margin-inline: auto;
            overflow: hidden;
            border-radius: 5px;
            background: rgb(37 37 37 / 0.8);
            box-shadow: 0 4px 12px rgb(0 0 0 / 0.5);
            font-size: 50px;
            line-height: 1.2;
            animation: debs-in 750ms ease-in-out;
        }
        .debs--leaving {
            animation: debs-out 750ms ease-in-out forwards;
        }
        .debs__text {
            margin: 0;
            /* Its own width is the message's, so translateX(-100%) clears the bar. */
            width: max-content;
            white-space: nowrap;
            /* Waits off the right edge until it has been measured. */
            transform: translateX(90vw);
        }
        .debs__text--scrolling {
            /* The duration is set inline, from the message's width. */
            animation: debs-scroll linear forwards;
        }
        .link {
            position: absolute;
            left: 1rem;
            bottom: 1rem;
            padding: 0.25rem 0.75rem;
            border-radius: 8px;
            background: rgb(22 20 28 / 0.85);
            font-size: 1rem;
        }
        @keyframes roar-in {
            from {
                opacity: 0;
                transform: translateX(-50%) scale(0.6);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) scale(1);
            }
        }
        @keyframes debs-in {
            from {
                opacity: 0;
                transform: scale(0);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        @keyframes debs-out {
            from {
                opacity: 1;
                transform: scale(1);
            }
            to {
                opacity: 0;
                transform: scale(0);
            }
        }
        @keyframes debs-scroll {
            from {
                transform: translateX(90vw);
            }
            to {
                transform: translateX(-100%);
            }
        }
        @media (prefers-reduced-motion: reduce) {
            /* The scroll is the alert itself; only the bar's zoom goes. */
            .debs {
                animation: none;
            }
            .debs--leaving {
                visibility: hidden;
            }
            .roar {
                transition: none;
            }
        }
    `,
    template: `
        <h1 class="sr-only">brobot stream overlay</h1>

        @if (activeVotes().length > 0) {
            <div class="votes">
                @for (vote of activeVotes(); track vote.vote) {
                    <section class="vote" [class.vote--caged]="vote.caged" [attr.aria-label]="vote.title">
                        <div class="vote__head">
                            <span>{{ vote.caged ? vote.cagedLabel : vote.title }}</span>
                            <span>{{ vote.count }} / {{ vote.threshold }}</span>
                        </div>
                        <meter
                            class="vote__meter"
                            min="0"
                            [max]="vote.threshold"
                            [value]="vote.count"
                            [attr.aria-label]="vote.title + ' votes'">
                            {{ vote.count }} of {{ vote.threshold }}
                        </meter>
                    </section>
                }
            </div>
        }

        @if (roar(); as r) {
            <figure class="roar" [class.roar--above-debs]="debsAlert() !== null">
                <img [src]="r.artUrl" alt="" />
                <figcaption class="roar__caption">
                    {{ r.login }}'s {{ r.shiny ? 'shiny ' : '' }}{{ r.name }} · Lv {{ r.level }}
                </figcaption>
            </figure>
        }

        @if (debsAlert(); as alert) {
            <div class="debs" [class.debs--leaving]="alert.leaving">
                <p
                    #debsText
                    class="debs__text"
                    [class.debs__text--scrolling]="alert.durationMs > 0"
                    [style.animation-duration.ms]="alert.durationMs">
                    {{ alert.message }}
                </p>
            </div>
        }

        @if (socket.status() === 'reconnecting') {
            <p class="link" role="status">brobot overlay: reconnecting…</p>
        }

        <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
        <!-- Its own region, so a roar at the same moment does not talk over it. -->
        <p class="sr-only" aria-live="polite">{{ debsAnnouncement() }}</p>
    `,
})
export class StreamOverlayComponent {
    protected readonly socket = inject(OVERLAY_SOCKET);
    private readonly sound = inject(OverlaySound);
    private readonly destroyRef = inject(DestroyRef);
    private readonly document = inject(DOCUMENT);
    private readonly injector = inject(Injector);

    private readonly votes = signal<Partial<Record<VoteKind, VoteStateEvent>>>({});
    protected readonly roar = signal<Roar | null>(null);
    protected readonly announcement = signal('');
    protected readonly debsAlert = signal<DebsAlert | null>(null);
    protected readonly debsAnnouncement = signal('');
    private readonly debsText = viewChild<ElementRef<HTMLElement>>('debsText');

    private readonly roarQueue: Roar[] = [];
    private roarTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly debsQueue: DebsAlertEvent[] = [];
    private debsTimer: ReturnType<typeof setTimeout> | null = null;

    /** Only votes in progress are drawn: an idle vote is not stream furniture. */
    protected readonly activeVotes = computed(() =>
        (['chatban', 'voiceban'] as const)
            .map(kind => this.votes()[kind])
            .filter((vote): vote is VoteStateEvent => !!vote && (vote.count > 0 || vote.caged))
            .map(vote => ({
                ...vote,
                title: VOTE_COPY[vote.vote].title,
                cagedLabel: VOTE_COPY[vote.vote].caged,
            })),
    );

    constructor() {
        this.clearPageBackground();
        this.socket.frames$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(frame => this.onFrame(frame));
        this.destroyRef.onDestroy(() => {
            if (this.roarTimer) clearTimeout(this.roarTimer);
            if (this.debsTimer) clearTimeout(this.debsTimer);
        });
    }

    /**
     * OBS composites the page over the stream, so the page itself must be
     * transparent — but the theme paints `html.look-material` with
     * `--ui-surface`. Inline styles beat any stylesheet (and need no `:has()`,
     * which OBS's embedded Chromium may predate); they are put back if the
     * overlay is ever left for another route.
     */
    private clearPageBackground(): void {
        const targets = [this.document.documentElement, this.document.body];
        const previous = targets.map(el => el.style.background);
        for (const el of targets) el.style.background = 'transparent';
        this.destroyRef.onDestroy(() => {
            targets.forEach((el, i) => (el.style.background = previous[i] ?? ''));
        });
    }

    private onFrame(frame: OverlayFrame): void {
        switch (frame.type) {
            case 'quack':
                this.sound.play(QUACK_URL, 0.4);
                break;
            case 'pokemon_roar':
                this.enqueueRoar(frame);
                break;
            case 'debs_alert':
                this.debsQueue.push(frame);
                if (!this.debsAlert()) this.showNextDebsAlert();
                break;
            case 'vote_state':
                this.votes.update(votes => ({ ...votes, [frame.vote]: frame }));
                if (frame.caged) this.announcement.set(`${VOTE_COPY[frame.vote].caged}.`);
                break;
        }
    }

    private enqueueRoar({ login, pokemon }: PokemonRoarEvent): void {
        this.roarQueue.push({
            login,
            name: pokemon.name,
            level: pokemon.level,
            shiny: pokemon.shiny,
            artUrl: pokemonArtUrl(environment.pokemonArtUrl, pokemon),
            cryUrl: pokemonCryUrl(environment.pokemonCryUrl, pokemon.nameId),
        });
        if (!this.roarTimer) this.showNextRoar();
    }

    private showNextRoar(): void {
        const next = this.roarQueue.shift() ?? null;
        this.roar.set(next);
        this.roarTimer = null;
        if (!next) return;
        this.sound.play(next.cryUrl, 0.3);
        this.announcement.set(`${next.login}'s ${next.name} roars!`);
        this.roarTimer = setTimeout(() => this.showNextRoar(), ROAR_MS);
    }

    /**
     * DEBS Alerts queue one at a time, like roars, but beside them: the bar
     * sits at the bottom, a roar in the middle. The message is drawn waiting
     * off the right edge, measured once rendered, then scrolls for
     * {@link debsAlertDurationMs} before the bar scales away.
     */
    private showNextDebsAlert(): void {
        const next = this.debsQueue.shift();
        this.debsTimer = null;
        if (!next) {
            this.debsAlert.set(null);
            return;
        }
        this.debsAlert.set({ message: next.message, durationMs: 0, leaving: false });
        this.sound.play(DEBS_ALERT_URL, 1);
        this.debsAnnouncement.set(`${next.displayName} says: ${next.message}`);
        afterNextRender(() => this.startDebsScroll(), { injector: this.injector });
    }

    private startDebsScroll(): void {
        const durationMs = debsAlertDurationMs(this.debsText()?.nativeElement.scrollWidth ?? 0);
        this.debsAlert.update(alert => alert && { ...alert, durationMs });
        this.debsTimer = setTimeout(() => {
            this.debsAlert.update(alert => alert && { ...alert, leaving: true });
            this.debsTimer = setTimeout(() => this.showNextDebsAlert(), DEBS_SCALE_MS);
        }, durationMs);
    }
}
