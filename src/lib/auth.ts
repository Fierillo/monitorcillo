import { cookies } from 'next/headers';
import crypto from 'crypto';

export function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return false;

    const expectedHash = hashPassword(process.env.ADMIN_PASSWORD || 'monitordefault');
    return token === expectedHash;
}
