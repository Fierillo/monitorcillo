import type { DbRow, FeedbackRecord, FeedbackSubmission } from '@/types';
import { sql } from './client';

let feedbackTableReady = false;

async function ensureFeedbackTable(): Promise<void> {
    if (feedbackTableReady) return;
    await sql.query(`
        CREATE TABLE IF NOT EXISTS feedback (
            id BIGSERIAL PRIMARY KEY,
            message VARCHAR(500) NOT NULL,
            surface VARCHAR(30) NOT NULL,
            path VARCHAR(200) NOT NULL,
            metric_id VARCHAR(100),
            metric_title VARCHAR(255),
            chart_title VARCHAR(255),
            view_id VARCHAR(100),
            view_title VARCHAR(255),
            mode_id VARCHAR(100),
            mode_title VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `, []);
    await sql.query('CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC)', []);
    feedbackTableReady = true;
}

export async function saveFeedback({ message, context }: FeedbackSubmission): Promise<void> {
    await ensureFeedbackTable();
    await sql.query(`
        INSERT INTO feedback (
            message, surface, path, metric_id, metric_title, chart_title,
            view_id, view_title, mode_id, mode_title
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
        message,
        context.surface,
        context.path,
        context.metricId ?? null,
        context.metricTitle ?? null,
        context.chartTitle ?? null,
        context.viewId ?? null,
        context.viewTitle ?? null,
        context.modeId ?? null,
        context.modeTitle ?? null,
    ]);
}

export async function getFeedback(): Promise<FeedbackRecord[]> {
    try {
        await ensureFeedbackTable();
        const rows = await sql.query('SELECT * FROM feedback ORDER BY created_at DESC', []) as DbRow[];
        return rows.map(row => ({
            id: Number(row.id),
            message: String(row.message),
            surface: row.surface === 'chart' ? 'chart' : 'general_table',
            path: String(row.path),
            metricId: row.metric_id == null ? undefined : String(row.metric_id),
            metricTitle: row.metric_title == null ? undefined : String(row.metric_title),
            chartTitle: row.chart_title == null ? undefined : String(row.chart_title),
            viewId: row.view_id == null ? undefined : String(row.view_id),
            viewTitle: row.view_title == null ? undefined : String(row.view_title),
            modeId: row.mode_id == null ? undefined : String(row.mode_id),
            modeTitle: row.mode_title == null ? undefined : String(row.mode_title),
            createdAt: new Date(String(row.created_at)).toISOString(),
        }));
    } catch (error) {
        console.error('[db] getFeedback failed', error);
        return [];
    }
}
