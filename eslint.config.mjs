import { createAngularConfig } from '../../eslint.angular-base.config.mjs';
import a11yConfig from '../../eslint.angular-a11y.config.mjs';

export default createAngularConfig({
    prefix: 'app',
    tsconfigRootDir: import.meta.dirname,
    includeA11y: true,
    a11yConfig,
    additionalRules: [
        {
            ignores: ['dist/**', 'test-results/**', 'playwright-report/**'],
        },
    ],
});
