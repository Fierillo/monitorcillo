import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const apiRoot = join(process.cwd(), 'src/app/api');
const forbiddenImports = [
    'lib/bcra',
    'lib/sync',
    'https.get(',
    'fetchBcraVariable',
    'fetchFromUrl',
    'fetchCSV',
];

function routeFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) return routeFiles(path);
        return path.endsWith('route.ts') ? [path] : [];
    });
}

describe('api boundaries', () => {
    it('does not expose API routes that can call external data sources', () => {
        for (const file of routeFiles(apiRoot)) {
            const source = readFileSync(file, 'utf8');
            for (const forbiddenImport of forbiddenImports) {
                expect(source, `${file} imports ${forbiddenImport}`).not.toContain(forbiddenImport);
            }
        }
    });
});
