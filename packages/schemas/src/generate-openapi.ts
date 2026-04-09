/**
 * CLI script: generates docs/openapi/openapi.json
 * Run via: npm run generate:openapi (from root)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOpenApiDocument } from './openapi-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../../../docs/openapi');
const outFile = join(outDir, 'openapi.json');

mkdirSync(outDir, { recursive: true });
const doc = generateOpenApiDocument();
writeFileSync(outFile, JSON.stringify(doc, null, 2));
console.log(`OpenAPI spec written to ${outFile}`);
