import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AUTH_CONFIG, authInterceptor } from '@singularity/ngx-auth';
import { provideLibUi } from '@singularity/ngx-ui';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideBrobotApi } from './core/brobot-api';
import { brobotAuthConfig, provideBrobotSession } from './core/session';
import { provideUiStrings } from './core/ui-strings';

/**
 * brobot issues the same JWT cookie pair api-time does, so libs/ngx-auth's
 * interceptor and `SessionStore` work unchanged: the interceptor sends
 * credentials to brobot's `/api` and answers a 401 with one refresh, and
 * `provideBrobotSession()` points the store (and so that refresh) at
 * brobot's status, refresh and logout endpoints (`core/session.ts`).
 */
export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: AUTH_CONFIG, useValue: brobotAuthConfig(`${environment.apiUrl}/api`) },
        provideBrobotApi(environment.apiUrl),
        provideBrobotSession(),
        provideLibUi({ button: { defaultVariant: 'primary' } }),
        provideUiStrings(),
    ],
};
