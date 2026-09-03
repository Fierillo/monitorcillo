import { NextResponse } from 'next/server';
import { saveFeedback } from '@/lib/db/feedback';
import { checkRequestRateLimit } from '@/lib/rate-limit';
import type { FeedbackContext, FeedbackSubmission, FeedbackSurface } from '@/types';

const MAX_MESSAGE_LENGTH = 500;
const FEEDBACK_RATE_LIMIT = { maxAttempts: 1, windowMs: 5 * 60 * 1000 };

function optionalText(value: unknown, maxLength: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error('Invalid feedback context');
    const text = value.trim();
    if (!text || text.length > maxLength) throw new Error('Invalid feedback context');
    return text;
}

function parseFeedbackContext(value: unknown): FeedbackContext {
    if (!value || typeof value !== 'object') throw new Error('Invalid feedback context');
    const context = value as Record<string, unknown>;
    const surface = context.surface;
    if (surface !== 'general_table' && surface !== 'chart') throw new Error('Invalid feedback context');
    const path = optionalText(context.path, 200);
    if (!path?.startsWith('/')) throw new Error('Invalid feedback context');

    return {
        surface: surface as FeedbackSurface,
        path,
        metricId: optionalText(context.metricId, 100),
        metricTitle: optionalText(context.metricTitle, 255),
        chartTitle: optionalText(context.chartTitle, 255),
        viewId: optionalText(context.viewId, 100),
        viewTitle: optionalText(context.viewTitle, 255),
        modeId: optionalText(context.modeId, 100),
        modeTitle: optionalText(context.modeTitle, 255),
    };
}

export function parseFeedbackSubmission(value: unknown): FeedbackSubmission {
    if (!value || typeof value !== 'object') throw new Error('Invalid feedback payload');
    const body = value as Record<string, unknown>;
    if (typeof body.message !== 'string') throw new Error('Invalid feedback payload');
    const message = body.message.trim();
    if (message.length < 3 || message.length > MAX_MESSAGE_LENGTH) throw new Error('Invalid feedback payload');
    return { message, context: parseFeedbackContext(body.context) };
}

export async function POST(request: Request) {
    let feedback: FeedbackSubmission;
    try {
        feedback = parseFeedbackSubmission(await request.json());
    } catch {
        return NextResponse.json({ error: 'Escribí un mensaje de entre 3 y 500 caracteres.' }, { status: 400 });
    }

    if (!await checkRequestRateLimit(request, 'api:feedback:post', FEEDBACK_RATE_LIMIT)) {
        return NextResponse.json(
            { error: 'Ya enviaste feedback recientemente. Intentá de nuevo en 5 minutos.' },
            { status: 429, headers: { 'Retry-After': '300' } },
        );
    }

    try {
        await saveFeedback(feedback);
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error('[api/feedback] error:', error);
        return NextResponse.json({ error: 'No se pudo guardar el feedback. Intentá nuevamente.' }, { status: 500 });
    }
}
