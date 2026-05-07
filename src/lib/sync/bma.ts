import type { BcraVariableRow, BmaRawRow } from '@/types';
import { buildMonthlyPbiSeries } from '../pbi-source';
import { fetchBcraVariable } from './bcra';
import { fetchEmaeWorkbookRows, fetchPbiAnchorRows } from './cache';
import { WEEKLY_BALANCE_WORKBOOK_URL } from './constants';
import { fetchBufferFromUrl, fetchFromUrl } from './http-client';
import { emaeDesestacionalizadoMap, seriesValueMap, valueAtOrBefore } from './series';
import { extractWeeklyGovernmentDepositsSeries } from './weekly-bcra';

function mergeBcraSeries(byFecha: Map<string, BmaRawRow>, items: BcraVariableRow[], field: Exclude<keyof BmaRawRow, 'fecha'>) {
    for (const item of items) {
        if (!item?.fecha) continue;
        const row = byFecha.get(item.fecha) ?? { fecha: item.fecha };
        row[field] = item.valor == null ? null : Number(item.valor);
        byFecha.set(item.fecha, row);
    }
}

export async function fetchBmaRaw(): Promise<BmaRawRow[]> {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0];
    const fromDate = '2017-01-01';

    const [baseMonetaria, pases, leliq, lefi, otros, weeklyWorkbook, pbiAnchors, emae, ipc] = await Promise.all([
        fetchBcraVariable(15, fromDate, toDate),
        fetchBcraVariable(152, fromDate, toDate),
        fetchBcraVariable(155, fromDate, toDate),
        fetchBcraVariable(196, fromDate, toDate),
        fetchBcraVariable(198, fromDate, toDate),
        fetchBufferFromUrl(WEEKLY_BALANCE_WORKBOOK_URL),
        fetchPbiAnchorRows(),
        fetchEmaeWorkbookRows(),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
    ]);

    const byFecha = new Map<string, BmaRawRow>();
    mergeBcraSeries(byFecha, baseMonetaria, 'base_monetaria');
    mergeBcraSeries(byFecha, pases, 'pases');
    mergeBcraSeries(byFecha, leliq, 'leliq');
    mergeBcraSeries(byFecha, lefi, 'lefi');
    mergeBcraSeries(byFecha, otros, 'otros');
    mergeBcraSeries(byFecha, extractWeeklyGovernmentDepositsSeries(weeklyWorkbook, fromDate), 'depositos_tesoro');

    const monthPrefixes = new Set(Array.from(byFecha.keys()).map(fecha => fecha.slice(0, 7)));
    const firstOfMonthDates = Array.from(monthPrefixes).map(monthPrefix => `${monthPrefix}-01`);
    const pbiByFecha = buildMonthlyPbiSeries(pbiAnchors, emae, firstOfMonthDates);
    const emaeByFecha = emaeDesestacionalizadoMap(emae);
    const ipcByFecha = seriesValueMap(ipc.data || []);

    for (const monthPrefix of monthPrefixes) {
        const firstOfMonth = `${monthPrefix}-01`;
        const row = byFecha.get(firstOfMonth) ?? { fecha: firstOfMonth };
        const pbiVal = pbiByFecha.get(firstOfMonth);
        const emaeVal = emaeByFecha.get(firstOfMonth);
        const ipcVal = valueAtOrBefore(ipcByFecha, firstOfMonth);
        if (pbiVal != null) row.pbi_trimestral = pbiVal;
        if (emaeVal != null) row.emae_desestacionalizado = emaeVal;
        if (ipcVal != null) row.ipc_nucleo = ipcVal;
        if (pbiVal != null || emaeVal != null || ipcVal != null) byFecha.set(firstOfMonth, row);
    }

    return Array.from(byFecha.values()).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}
