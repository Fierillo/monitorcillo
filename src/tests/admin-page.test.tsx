import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement } from 'react';
import type { ElementType, ReactNode } from 'react';
import { createAuthToken } from '../lib/auth-token';

const mocks = vi.hoisted(() => ({
    cookieValue: undefined as string | undefined,
    getIndicators: vi.fn(),
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        get: (name: string) => name === 'auth_token' && mocks.cookieValue
            ? { name, value: mocks.cookieValue }
            : undefined,
    })),
}));

vi.mock('@/lib/indicators', () => ({
    getIndicators: mocks.getIndicators,
}));

import AdminPage from '../app/admin/page';
import AdminDashboard from '../app/admin/AdminDashboard';
import LoginForm from '../app/admin/LoginForm';

const originalAdminPassword = process.env.ADMIN_PASSWORD;

function expectElementType(element: ReactNode, type: ElementType): void {
    expect(isValidElement(element)).toBe(true);
    if (!isValidElement(element)) throw new Error('Expected React element');
    expect(element.type).toBe(type);
}

beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'strong-admin-password';
    mocks.cookieValue = undefined;
    mocks.getIndicators.mockReset();
    mocks.getIndicators.mockResolvedValue([]);
});

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
});

describe('admin page auth', () => {
    it('does not render the admin dashboard with the legacy forged cookie', async () => {
        mocks.cookieValue = 'authenticated';

        const element = await AdminPage();

        expectElementType(element, LoginForm);
        expect(mocks.getIndicators).not.toHaveBeenCalled();
    });

    it('renders the admin dashboard with a valid signed cookie', async () => {
        mocks.cookieValue = createAuthToken('strong-admin-password');

        const element = await AdminPage();

        expectElementType(element, AdminDashboard);
        expect(mocks.getIndicators).toHaveBeenCalledOnce();
    });
});
