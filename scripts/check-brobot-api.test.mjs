import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { APP, GENERATED, INPUTS, PROVENANCE, REGISTRY, ROOT, checkBrobotApi, registryEntry } from './check-brobot-api.mjs';

let scratch;
afterEach(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
    scratch = undefined;
});

/** A copy of this app's generated models and inputs, and of the superproject's registry. */
function fixture() {
    scratch = mkdtempSync(join(tmpdir(), 'brobot-api-check-'));
    const app = join(scratch, 'app');
    const root = join(scratch, 'root');
    cpSync(join(APP, GENERATED), join(app, GENERATED), { recursive: true });
    for (const path of INPUTS) cpSync(join(APP, path), join(app, path));
    mkdirSync(join(root, 'libs/contracts'), { recursive: true });
    cpSync(join(ROOT, REGISTRY), join(root, REGISTRY));
    return { app, root };
}
const reasons = diagnostics => diagnostics.map(item => `${item.reason} ${item.path}`);

test('the committed models match the registered document', () => {
    assert.deepEqual(checkBrobotApi(), []);
});

test('they were generated at the commit the registry records', () => {
    const provenance = JSON.parse(readFileSync(join(APP, PROVENANCE), 'utf8'));
    const { repository, ref, path } = provenance.document;
    assert.deepEqual({ repository, ref, path }, registryEntry());
});

test('a registry entry moved to another commit makes them stale', () => {
    const { app, root } = fixture();
    const registry = join(root, REGISTRY);
    const { ref } = registryEntry(root);
    writeFileSync(registry, readFileSync(registry, 'utf8').replace(ref, 'f'.repeat(40)));
    assert.deepEqual(reasons(checkBrobotApi({ app, root })), [`stale ${REGISTRY}`]);
});

test('a hand-edited, added or removed model fails', () => {
    const { app, root } = fixture();
    appendFileSync(join(app, GENERATED, 'model/brobot-command.ts'), '// edited\n');
    writeFileSync(join(app, GENERATED, 'model/extra.ts'), 'export type Extra = string;\n');
    rmSync(join(app, GENERATED, 'model/brobot-error.ts'));
    assert.deepEqual(reasons(checkBrobotApi({ app, root })).sort(), [
        `edited ${GENERATED}/model/brobot-command.ts`,
        `missing ${GENERATED}/model/brobot-error.ts`,
        `unexpected ${GENERATED}/model/extra.ts`,
    ]);
});

test('a changed generator pin or option fails; line endings do not', () => {
    const { app, root } = fixture();
    const model = join(app, GENERATED, 'model/brobot-command.ts');
    writeFileSync(model, readFileSync(model, 'utf8').replace(/\n/g, '\r\n'));
    assert.deepEqual(checkBrobotApi({ app, root }), []);
    const pin = join(app, 'openapitools.json');
    writeFileSync(pin, readFileSync(pin, 'utf8').replace('7.18.0', '7.19.0'));
    appendFileSync(join(app, 'scripts/generate-brobot-api.mjs'), '\n');
    assert.deepEqual(reasons(checkBrobotApi({ app, root })), ['stale openapitools.json', 'stale scripts/generate-brobot-api.mjs']);
});

test('no provenance means the models were not generated', () => {
    const { app, root } = fixture();
    rmSync(join(app, PROVENANCE));
    assert.deepEqual(reasons(checkBrobotApi({ app, root })), [`missing ${PROVENANCE}`]);
});
