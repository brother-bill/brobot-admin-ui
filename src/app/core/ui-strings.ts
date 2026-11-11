import type { EnvironmentProviders } from '@angular/core';
import { inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

/**
 * The English for the few translation keys this site shows. ngx-ui labels
 * some controls with keys (the alert banner's dismiss button is
 * `a11y.dismiss_alert`); with no ngx-translate the key itself would be the
 * button's accessible name. Those match tt-budget's `public/i18n/en.json`.
 * The site's own keyed strings sit under `session`. The site is
 * English-only, so the table is inline rather than a loaded file. Any other
 * string passes through unchanged.
 */
export const UI_STRINGS_EN = {
    a11y: {
        dismiss_alert: 'Dismiss alert',
        skip_links_region: 'Skip navigation',
    },
    session: {
        logout_failed:
            "Couldn't log you out: brobot isn't answering. You're still signed in on this browser; try again.",
    },
};

export function provideUiStrings(): EnvironmentProviders {
    return makeEnvironmentProviders([
        provideTranslateService({ defaultLanguage: 'en' }),
        provideAppInitializer(() => {
            const translate = inject(TranslateService);
            translate.setTranslation('en', UI_STRINGS_EN);
            translate.use('en');
        }),
    ]);
}
