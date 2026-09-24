import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Just the outlet: the site's chrome lives in {@link ShellComponent}, which the overlay skips. */
@Component({
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterOutlet],
    template: `<router-outlet />`,
})
export class AppComponent {}
