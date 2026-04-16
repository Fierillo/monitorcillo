import { cookies } from 'next/headers';

const AUTH_TOKEN = 'authenticated';

export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    return cookieStore.get('auth_token')?.value === AUTH_TOKEN;
}
