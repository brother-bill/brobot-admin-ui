import type { EnvironmentProviders } from '@angular/core';
import { inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

/**
 * The English for the few ngx-ui strings this site shows. ngx-ui labels some
 * controls with translation keys (the alert banner's dismiss button is
 * `a11y.dismiss_alert`); with no ngx-translate the key itself would be the
 * button's accessible name. The site is English-only, so the table is inline
 * rather than a loaded file. Any other string passes through unchanged.
 * Wording matches tt-budget's `public/i18n/en.json`.
 */
export const UI_STRINGS_EN = {
    a11y: {
        dismiss_alert: 'Dismiss alert',
        skip_links_region: 'Skip navigation',
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
