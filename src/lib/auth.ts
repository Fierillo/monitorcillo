import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifyAuthToken } from './auth-token';

export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    return verifyAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}
