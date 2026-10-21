import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const revokedMemory = new Map<string, number>();
let sql: NeonQueryFunction<false, false> | null = null;
let tableReady = false;

function getSql(): NeonQueryFunction<false, false> | null {
    if (process.env.NODE_ENV === 'test' || !process.env.NEON_URL) return null;
    sql ??= neon(process.env.NEON_URL);
    return sql;
}

async function ensureRevokedTable(database: NeonQueryFunction<false, false>): Promise<void> {
    if (tableReady) return;
    await database.query(`
        CREATE TABLE IF NOT EXISTS revoked_auth_tokens (
            nonce TEXT PRIMARY KEY,
            expires_at TIMESTAMPTZ NOT NULL
        )
    `, []);
    tableReady = true;
}

/** Revokes a session nonce until its own expiry; expired revocations are pruned on the same write. */
export async function revokeNonce(nonce: string, expiresAtMs: number): Promise<void> {
    const database = getSql();
    if (!database) {
        revokedMemory.set(nonce, expiresAtMs);
        return;
    }
    await ensureRevokedTable(database);
    await database.query('DELETE FROM revoked_auth_tokens WHERE expires_at < NOW()', []);
    await database.query(`
        INSERT INTO revoked_auth_tokens (nonce, expires_at)
        VALUES ($1, to_timestamp($2::double precision / 1000))
        ON CONFLICT (nonce) DO NOTHING
    `, [nonce, expiresAtMs]);
}

export async function isNonceRevoked(nonce: string): Promise<boolean> {
    const database = getSql();
    if (!database) return revokedMemory.has(nonce);
    await ensureRevokedTable(database);
    const rows = await database.query('SELECT 1 FROM revoked_auth_tokens WHERE nonce = $1 LIMIT 1', [nonce]) as unknown[];
    return rows.length > 0;
}

export function resetRevokedAuthTokens(): void {
    revokedMemory.clear();
}
