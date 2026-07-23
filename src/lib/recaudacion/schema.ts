export const RECAUDACION_TAX_TYPES = [
    {
        key: 'iva',
        rawKey: 'iva',
        pctKey: 'ivaPctPbi',
        mm12Key: 'ivaPctPbiMm12',
        label: 'IVA',
        color: '#FFD700',
        seriesId: '142.3_IVA_2001_M_3',
        concepts: ['iva', 'impuesto al valor agregado'],
    },
    {
        key: 'ganancias',
        rawKey: 'ganancias',
        pctKey: 'gananciasPctPbi',
        mm12Key: 'gananciasPctPbiMm12',
        label: 'Ganancias',
        color: '#00BFFF',
        seriesId: '142.3_GANAN_2001_M_9',
        concepts: ['ganancias', 'impuesto a las ganancias', 'iigg'],
    },
    {
        key: 'aportes',
        rawKey: 'aportes_personales',
        pctKey: 'aportesPctPbi',
        mm12Key: 'aportesPctPbiMm12',
        label: 'Aportes personales',
        color: '#22C55E',
        seriesId: '142.3_APORT_2001_M_18',
        concepts: ['aportes personales'],
    },
    {
        key: 'contribuciones',
        rawKey: 'contribuciones_patronales',
        pctKey: 'contribucionesPctPbi',
        mm12Key: 'contribucionesPctPbiMm12',
        label: 'Contribuciones patronales',
        color: '#F97316',
        seriesId: '142.3_CONTR_2001_M_25',
        concepts: ['contribuciones patronales'],
    },
] as const;

export const RECAUDACION_RESIDUAL = {
    key: 'otros',
    rawKey: 'otros',
    pctKey: 'otrosPctPbi',
    mm12Key: 'otrosPctPbiMm12',
    label: 'Otros',
    color: '#9CA3AF',
} as const;

export const RECAUDACION_BREAKDOWN_TYPES = [
    ...RECAUDACION_TAX_TYPES.map(({ seriesId: _seriesId, concepts: _concepts, ...tax }) => tax),
    RECAUDACION_RESIDUAL,
] as const;

export type RecaudacionTaxType = typeof RECAUDACION_TAX_TYPES[number];
export type RecaudacionBreakdownType = typeof RECAUDACION_BREAKDOWN_TYPES[number];
export type RecaudacionTaxKey = RecaudacionTaxType['key'];
export type RecaudacionTaxRawKey = RecaudacionTaxType['rawKey'];
export type RecaudacionTaxPctKey = RecaudacionTaxType['pctKey'] | typeof RECAUDACION_RESIDUAL.pctKey;
export type RecaudacionTaxMm12Key = RecaudacionTaxType['mm12Key'] | typeof RECAUDACION_RESIDUAL.mm12Key;

export const RECAUDACION_TAX_RAW_KEYS = RECAUDACION_TAX_TYPES.map(tax => tax.rawKey) as RecaudacionTaxRawKey[];
export const RECAUDACION_TAX_PCT_DB_COLUMNS = RECAUDACION_BREAKDOWN_TYPES.map(tax => `${tax.rawKey}_pct_pbi`);
export const RECAUDACION_TAX_MM12_DB_COLUMNS = RECAUDACION_BREAKDOWN_TYPES.map(tax => `${tax.rawKey}_pct_pbi_mm12`);

export const RECAUDACION_TOTAL_SERIES_ID = '172.3_TL_RECAION_M_0_0_17';
export const RECAUDACION_COMPONENT_SERIES_IDS = RECAUDACION_TAX_TYPES.map(tax => tax.seriesId);

export function conceptToTaxField(concept: string): RecaudacionTaxRawKey | 'recaudacion_total' | null {
    const normalized = concept
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (normalized === 'total recursos tributarios') return 'recaudacion_total';

    for (const tax of RECAUDACION_TAX_TYPES) {
        if (tax.concepts.some(alias => normalized === alias || normalized.startsWith(`${alias} `))) {
            return tax.rawKey;
        }
    }

    return null;
}
