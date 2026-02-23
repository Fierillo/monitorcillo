import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const { password } = await req.json();
        const adminPass = process.env.ADMIN_PASSWORD || 'monitordefault';

        if (password !== adminPass) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = hashPassword(password);
        const res = NextResponse.json({ success: true });

        res.cookies.set({
            name: 'auth_token',
            value: token,
            httpOnly: true,
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24
        });

        return res;
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}

export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.delete('auth_token');
    return res;
}
