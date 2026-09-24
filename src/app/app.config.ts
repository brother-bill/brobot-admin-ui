import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideApi } from '@singularity/contracts/angular';
import type { AuthConfig } from '@singularity/ngx-auth';
import { AUTH_CONFIG, authInterceptor } from '@singularity/ngx-auth';
import { provideLibUi } from '@singularity/ngx-ui';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { provideBrobotApi } from './core/brobot-api';

/**
 * brobot issues the same JWT pair shape api-time does, in the same cookies,
 * and serves `POST /api/auth/refresh` (an alias of its Twitch refresh) — so
 * libs/ngx-auth's interceptor works unchanged: it sends credentials on every
 * request and answers a 401 with one refresh. The generated contracts client
 * is configured only because that interceptor refreshes through it; its base
 * path is brobot's `/api`, so the refresh lands on brobot, never on api-time.
 */
const authConfig: AuthConfig = {
    apiBaseUrl: `${environment.apiUrl}/api`,
    tokenMode: 'cookie',
    signedInRedirectUrl: '/commands',
};

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideApi({ basePath: authConfig.apiBaseUrl, withCredentials: true }),
        { provide: AUTH_CONFIG, useValue: authConfig },
        provideBrobotApi(environment.apiUrl),
        provideLibUi({ button: { defaultVariant: 'primary' } }),
    ],
};
