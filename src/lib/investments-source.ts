import type { ChartDataRow } from '@/types';

/** `note`: projects whose month is their first verifiable appearance in official totals, not a linked resolution. */
export type RigiApproval = { month: string; amountUsdMillions: number; note?: string };

export type RigiObservation = {
    observedAt: string;
    approvedProjects: number;
    approvedAmountUsdMillions: number;
    evaluationProjects: number | null;
    evaluationAmountUsdMillions: number;
    source: string;
};

export type NonRigiInvestment = {
    id: string;
    name: string;
    company: string;
    sector: string;
    amountUsdMillions: number;
    announcement: { date: string; url: string };
    confirmation: { date: string; url: string; evidence: string } | null;
    revisions?: { date: string; amountUsdMillions: number; url: string }[];
};

/** Investments as stored in Neon (see src/lib/db/inversiones.ts). */
export type InversionesData = { approvals: RigiApproval[]; observations: RigiObservation[]; nonRigi: NonRigiInvestment[] };

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

/** Current RIGI totals: the latest published observation, or null when none is stored. */
export function rigiTotals(observations: RigiObservation[]) {
    const latest = observations.reduce<RigiObservation | null>((last, item) => (!last || item.observedAt > last.observedAt ? item : last), null);
    if (!latest) return null;
    return {
        approved: { projects: latest.approvedProjects, amountUsdMillions: latest.approvedAmountUsdMillions },
        underEvaluation: { projects: latest.evaluationProjects, amountUsdMillions: latest.evaluationAmountUsdMillions },
        updatedAt: latest.observedAt,
    };
}

/** Monthly stacked series from January 2017 to the latest RIGI observation. */
export function buildRigiChartData({ approvals, observations, nonRigi }: InversionesData): ChartDataRow[] {
    const totals = rigiTotals(observations);
    if (!totals) return [];
    const evaluationByMonth = new Map(observations.map(observation => [`${observation.observedAt.slice(0, 7)}-01`, observation.evaluationAmountUsdMillions]));
    const approvedByMonth = new Map(approvals.map(item => [item.month, item.amountUsdMillions]));
    let approvedAccumulated = 0;
    let underEvaluation = 0;

    return buildMonthlyDates('2017-01-01', totals.updatedAt.slice(0, 7) + '-01').map(date => {
        const [year, month] = date.split('-');
        approvedAccumulated += approvedByMonth.get(date) ?? 0;
        underEvaluation = evaluationByMonth.get(date) ?? underEvaluation;
        const monthKey = date.slice(0, 7);
        const activeNonRigi = nonRigi.filter(investment => investment.announcement.date.slice(0, 7) <= monthKey);
        const confirmed = activeNonRigi.filter(investment => investment.confirmation && investment.confirmation.date.slice(0, 7) <= monthKey);
        const confirmedIds = new Set(confirmed.map(investment => investment.id));

        return {
            fecha: `${MONTHS[Number(month) - 1]} ${year.slice(2)}`,
            iso_fecha: date,
            aprobadas: approvedAccumulated,
            en_evaluacion: underEvaluation,
            anunciadas: activeNonRigi.filter(investment => !confirmedIds.has(investment.id)).reduce((total, investment) => total + investmentAmountAt(investment, monthKey), 0),
            confirmadas: confirmed.reduce((total, investment) => total + investmentAmountAt(investment, monthKey), 0),
        };
    });
}

function buildMonthlyDates(start: string, end: string): string[] {
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    const dates: string[] = [];

    for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); month++) {
        if (month === 13) {
            year++;
            month = 1;
        }
        dates.push(`${year}-${String(month).padStart(2, '0')}-01`);
    }

    return dates;
}

function investmentAmountAt(investment: NonRigiInvestment, month: string): number {
    const revision = investment.revisions?.findLast(item => item.date.slice(0, 7) <= month);
    return revision?.amountUsdMillions ?? investment.amountUsdMillions;
}
