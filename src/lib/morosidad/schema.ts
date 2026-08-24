export const PNFC_BREAKDOWNS = [
    {
        id: 'edad',
        label: 'Rango etario',
        sheet: '3. Rango etario',
        dateRow: 22,
        series: [
            { id: 'hasta_29', name: 'Hasta 29 años', financingRow: 5, ratioRow: 23, color: '#38BDF8', rawKey: 'mora_pnfc_hasta_29_pct', normalizedKey: 'moraPnfcHasta29Pct', dbKey: 'mora_pnfc_hasta_29_pct' },
            { id: 'de_30_a_64', name: 'De 30 a 64 años', financingRow: 6, ratioRow: 24, color: '#F59E0B', rawKey: 'mora_pnfc_de_30_a_64_pct', normalizedKey: 'moraPnfcDe30A64Pct', dbKey: 'mora_pnfc_de_30_a_64_pct' },
            { id: 'desde_65', name: '65 años o más', financingRow: 7, ratioRow: 25, color: '#A855F7', rawKey: 'mora_pnfc_desde_65_pct', normalizedKey: 'moraPnfcDesde65Pct', dbKey: 'mora_pnfc_desde_65_pct' },
        ],
    },
    {
        id: 'proveedor',
        label: 'Grupo de proveedor',
        sheet: '2. Grupo de proveedor',
        dateRow: 35,
        series: [
            { id: 'cooperativas', name: 'Cooperativas y mutuales', financingRow: 5, ratioRow: 36, color: '#22C55E', rawKey: 'mora_pnfc_cooperativas_pct', normalizedKey: 'moraPnfcCooperativasPct', dbKey: 'mora_pnfc_cooperativas_pct' },
            { id: 'fintech', name: 'Fintech', financingRow: 6, ratioRow: 37, color: '#38BDF8', rawKey: 'mora_pnfc_fintech_pct', normalizedKey: 'moraPnfcFintechPct', dbKey: 'mora_pnfc_fintech_pct' },
            { id: 'leasing_factoring', name: 'Leasing y factoring', financingRow: 7, ratioRow: 38, color: '#A855F7', rawKey: 'mora_pnfc_leasing_factoring_pct', normalizedKey: 'moraPnfcLeasingFactoringPct', dbKey: 'mora_pnfc_leasing_factoring_pct' },
            { id: 'otras_cadenas', name: 'Otras cadenas de comercios', financingRow: 8, ratioRow: 39, color: '#F59E0B', rawKey: 'mora_pnfc_otras_cadenas_pct', normalizedKey: 'moraPnfcOtrasCadenasPct', dbKey: 'mora_pnfc_otras_cadenas_pct' },
            { id: 'otras_tarjetas', name: 'Otras emisoras de tarjetas', financingRow: 9, ratioRow: 40, color: '#EC4899', rawKey: 'mora_pnfc_otras_tarjetas_pct', normalizedKey: 'moraPnfcOtrasTarjetasPct', dbKey: 'mora_pnfc_otras_tarjetas_pct' },
            { id: 'resto', name: 'Resto', financingRow: 10, ratioRow: 41, color: '#94A3B8', rawKey: 'mora_pnfc_resto_pct', normalizedKey: 'moraPnfcRestoPct', dbKey: 'mora_pnfc_resto_pct' },
            { id: 'electrodomesticos', name: 'Venta de electrodomésticos', financingRow: 11, ratioRow: 42, color: '#DC2626', rawKey: 'mora_pnfc_electrodomesticos_pct', normalizedKey: 'moraPnfcElectrodomesticosPct', dbKey: 'mora_pnfc_electrodomesticos_pct' },
        ],
    },
    {
        id: 'asistencia',
        label: 'Tipo de asistencia',
        sheet: '7. Tipo de asistencia',
        dateRow: 23,
        series: [
            { id: 'tarjetas', name: 'Tarjetas de crédito', financingRow: 6, ratioRow: 24, color: '#38BDF8', rawKey: 'mora_pnfc_tarjetas_pct', normalizedKey: 'moraPnfcTarjetasPct', dbKey: 'mora_pnfc_tarjetas_pct' },
            { id: 'personales', name: 'Préstamos personales', financingRow: 7, ratioRow: 25, color: '#F59E0B', rawKey: 'mora_pnfc_personales_pct', normalizedKey: 'moraPnfcPersonalesPct', dbKey: 'mora_pnfc_personales_pct' },
            { id: 'otras_asistencias', name: 'Resto de asistencias', financingRow: 8, ratioRow: 26, color: '#A855F7', rawKey: 'mora_pnfc_otras_asistencias_pct', normalizedKey: 'moraPnfcOtrasAsistenciasPct', dbKey: 'mora_pnfc_otras_asistencias_pct' },
        ],
    },
] as const;

export const PNFC_SERIES = [
    ...PNFC_BREAKDOWNS[0].series,
    ...PNFC_BREAKDOWNS[1].series,
    ...PNFC_BREAKDOWNS[2].series,
] as const;

export type PnfcRawKey = typeof PNFC_SERIES[number]['rawKey'];
export type PnfcNormalizedKey = typeof PNFC_SERIES[number]['normalizedKey'];
