import { createAngularConfig } from '../../eslint.angular-base.config.mjs';
import a11yConfig from '../../eslint.angular-a11y.config.mjs';

export default createAngularConfig({
    prefix: 'app',
    tsconfigRootDir: import.meta.dirname,
    includeA11y: true,
    a11yConfig,
    additionalRules: [
        {
            // src/app/core/generated is openapi-generator's output, held by
            // scripts/check-brobot-api.mjs instead.
            ignores: ['dist/**', 'test-results/**', 'playwright-report/**', 'src/app/core/generated/**'],
        },
    ],
});
