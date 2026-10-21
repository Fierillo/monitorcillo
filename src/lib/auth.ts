import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, isAuthTokenActive } from './auth-token';

export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    return isAuthTokenActive(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}
