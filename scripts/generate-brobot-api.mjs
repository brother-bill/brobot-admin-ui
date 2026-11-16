#!/usr/bin/env node
/**
 * Regenerates src/app/core/generated/ from brobot's registered OpenAPI
 * document. Needs Java 17+ (the openapi-generator jar), and git or gh:
 *
 *   pnpm run generate:api
 *
 * 1. Reads brobot's entry in the superproject's contract registry
 *    (libs/contracts/documents.yaml): repository, ref (a commit), path.
 * 2. Reads the document at that commit: from the apps/brobot submodule when
 *    it has the commit (`git show`), otherwise from GitHub at that commit
 *    (`gh api`). Never a branch, never a running server.
 * 3. Runs openapi-generator `typescript-angular` at the version this app's
 *    openapitools.json pins (7.18.0, libs/contracts/docs/zod-source-of-truth.md
 *    item 7), models only: no services, no module, no configuration.
 * 4. Replaces the generated directory and writes .provenance.json, which
 *    scripts/check-brobot-api.mjs holds the directory to.
 *
 * This script is an input of the provenance: changing the options below makes
 * the committed models stale until they are regenerated.
 */
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import {
    APP, DOCUMENT_NAME, FORMAT, GENERATED, PROVENANCE, ROOT, checkBrobotApi, formatDiagnostics,
    generatedFiles, hashText, inputHashes, registryEntry,
} from './check-brobot-api.mjs';

const GENERATOR = 'typescript-angular';
/** Models and their barrel (model/models.ts) only: no services, no Angular module. */
const GLOBAL_PROPERTIES = 'models,supportingFiles=models.ts';
/**
 * stringEnums stays false: an enum is a const object plus a union of its
 * literals, so `activeGame === 'pmd'` still typechecks.
 */
const ADDITIONAL_PROPERTIES = 'ngVersion=21.0.0,supportsES6=true,fileNaming=kebab-case,stringEnums=false';

/** The document's bytes at the registered commit. */
function readDocument({ repository, ref, path }) {
    const submodule = join(ROOT, 'apps', DOCUMENT_NAME);
    try {
        // Only when apps/brobot is its own checkout: in an uninitialised
        // submodule, git would answer for the superproject instead.
        const top = execFileSync('git', ['-C', submodule, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (top === submodule) {
            return { bytes: execFileSync('git', ['-C', submodule, 'show', `${ref}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }), via: 'git' };
        }
    } catch { /* not there, or without the commit: GitHub has it */ }
    const bytes = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw',
        `repos/${repository}/contents/${path}?ref=${ref}`], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20 });
    return { bytes, via: 'gh' };
}

function main() {
    const entry = registryEntry();
    const { bytes, via } = readDocument(entry);
    JSON.parse(bytes.toString('utf8'));
    const openapitools = JSON.parse(readFileSync(join(APP, 'openapitools.json'), 'utf8'));
    const version = openapitools['generator-cli']?.version;
    if (typeof version !== 'string') throw new Error('openapitools.json pins no generator-cli version');

    const staging = mkdtempSync(join(tmpdir(), 'brobot-api-models-'));
    try {
        const document = join(staging, 'openapi.json');
        writeFileSync(document, bytes);
        const output = join(staging, 'out');
        execFileSync('pnpm', ['exec', 'openapi-generator-cli', '--openapitools', join(APP, 'openapitools.json'), 'generate',
            '-g', GENERATOR, '-i', document, '-o', output,
            '--global-property', GLOBAL_PROPERTIES, '--additional-properties', ADDITIONAL_PROPERTIES],
        { cwd: APP, stdio: ['ignore', 'ignore', 'inherit'] });
        const written = readFileSync(join(output, '.openapi-generator/VERSION'), 'utf8').trim();
        if (written !== version) throw new Error(`openapi-generator wrote VERSION ${written}; openapitools.json pins ${version}`);

        const target = join(APP, GENERATED);
        rmSync(target, { recursive: true, force: true });
        mkdirSync(target, { recursive: true });
        cpSync(join(output, 'model'), join(target, 'model'), { recursive: true });
        cpSync(join(output, '.openapi-generator'), join(target, '.openapi-generator'), { recursive: true });
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }

    const provenance = {
        format: FORMAT,
        document: { name: DOCUMENT_NAME, ...entry, sha256: hashText(bytes) },
        generator: { name: GENERATOR, version, globalProperties: GLOBAL_PROPERTIES, additionalProperties: ADDITIONAL_PROPERTIES },
        inputs: inputHashes(),
        outputs: Object.fromEntries(generatedFiles().map(path => [path, hashText(readFileSync(join(APP, GENERATED, path)))])),
    };
    writeFileSync(join(APP, PROVENANCE), `${JSON.stringify(provenance, null, 4)}\n`);
    const diagnostics = checkBrobotApi();
    if (diagnostics.length) throw new Error(formatDiagnostics(diagnostics));
    console.info(`Generated ${Object.keys(provenance.outputs).length} files in ${GENERATED} from ${entry.repository}@${entry.ref}:${entry.path} (read with ${via}), openapi-generator ${version}.`);
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
