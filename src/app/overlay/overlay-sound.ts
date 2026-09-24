import { Injectable } from '@angular/core';

/**
 * Sound for the overlay. OBS browser sources may autoplay; an ordinary tab
 * may refuse until the page is clicked, which is harmless — the overlay only
 * ever runs inside OBS.
 */
@Injectable({ providedIn: 'root' })
export class OverlaySound {
    play(url: string, volume: number): void {
        const audio = new Audio(url);
        audio.volume = volume;
        audio.play().catch((error: unknown) => console.warn(`Overlay sound failed: ${url}`, error));
    }
}
