export const EMAE_SECTORS = [
    { key: 'agro', label: 'Agro', header: 'Agricultura, ganaderia, caza y silvicultura', color: '#84CC16', weight: 0.054 },
    { key: 'pesca', label: 'Pesca', header: 'Pesca', color: '#06B6D4', weight: 0.002 },
    { key: 'mineria', label: 'Mineria', header: 'Explotacion de minas y canteras', color: '#A855F7', weight: 0.032 },
    { key: 'industria', label: 'Industria', header: 'Industria manufacturera', color: '#F97316', weight: 0.168 },
    { key: 'energia', label: 'Energia', header: 'Electricidad, gas y agua', color: '#FACC15', weight: 0.021 },
    { key: 'construccion', label: 'Construccion', header: 'Construccion', color: '#FB7185', weight: 0.048 },
    { key: 'comercio', label: 'Comercio', header: 'Comercio mayorista, minorista y reparaciones', color: '#22C55E', weight: 0.125 },
    { key: 'hoteles', label: 'Hoteles', header: 'Hoteles y restaurantes', color: '#F59E0B', weight: 0.021 },
    { key: 'transporte', label: 'Transporte', header: 'Transporte y comunicaciones', color: '#38BDF8', weight: 0.072 },
    { key: 'finanzas', label: 'Finanzas', header: 'Intermediacion financiera', color: '#818CF8', weight: 0.045 },
    { key: 'inmobiliarias', label: 'Inmobiliarias', header: 'Actividades inmobiliarias, empresariales y de alquiler', color: '#C084FC', weight: 0.148 },
    { key: 'administracion_publica', label: 'Administracion publica', header: 'Administracion publica y defensa', color: '#F43F5E', weight: 0.055 },
    { key: 'ensenanza', label: 'Ensenanza', header: 'Ensenanza', color: '#14B8A6', weight: 0.042 },
    { key: 'salud', label: 'Salud', header: 'Servicios sociales y de salud', color: '#EF4444', weight: 0.041 },
    { key: 'otros_servicios', label: 'Otros servicios', header: 'Otras actividades de servicios comunitarios, sociales y personales', color: '#A3E635', weight: 0.034 },
    { key: 'impuestos', label: 'Impuestos', header: 'Impuestos netos de subsidios', color: '#E5E7EB', weight: 0.092 },
] as const;

export type EmaeSectorKey = typeof EMAE_SECTORS[number]['key'];
export type EmaeSectorMm12Key = `${EmaeSectorKey}_mm12`;
export type EmaeSectorAporteKey = `${EmaeSectorKey}_aporte`;

export const EMAE_SECTOR_KEYS = EMAE_SECTORS.map(sector => sector.key) as EmaeSectorKey[];
export const EMAE_SECTOR_MM12_KEYS = EMAE_SECTOR_KEYS.map(key => `${key}_mm12`) as EmaeSectorMm12Key[];
export const EMAE_SECTOR_APORTE_KEYS = EMAE_SECTOR_KEYS.map(key => `${key}_aporte`) as EmaeSectorAporteKey[];
export const EMAE_BASE_KEYS = ['emae', 'emae_desestacionalizado', 'emae_tendencia'] as const;
export const EMAE_NORMALIZED_DB_COLUMNS = ['fecha', ...EMAE_BASE_KEYS, ...EMAE_SECTOR_MM12_KEYS, ...EMAE_SECTOR_APORTE_KEYS] as const;

export function aporteKeyForSector(key: EmaeSectorKey): EmaeSectorAporteKey {
    return `${key}_aporte`;
}

export function sectorLevelAportes(
    sectorIndicesBase100: Partial<Record<EmaeSectorKey, number | null | undefined>>,
    emaeBase100: number | null | undefined,
): Record<EmaeSectorAporteKey, number | null> {
    const empty = Object.fromEntries(EMAE_SECTOR_APORTE_KEYS.map(key => [key, null])) as Record<EmaeSectorAporteKey, number | null>;
    if (emaeBase100 == null || !Number.isFinite(emaeBase100)) return empty;

    let weightedSum = 0;
    const rawAportes: Partial<Record<EmaeSectorKey, number>> = {};

    for (const sector of EMAE_SECTORS) {
        const index = sectorIndicesBase100[sector.key];
        if (typeof index !== 'number' || !Number.isFinite(index)) continue;
        const raw = sector.weight * index;
        rawAportes[sector.key] = raw;
        weightedSum += raw;
    }

    if (weightedSum <= 0) return empty;

    return Object.fromEntries(
        EMAE_SECTORS.map(sector => {
            const raw = rawAportes[sector.key];
            return [aporteKeyForSector(sector.key), raw == null ? null : emaeBase100 * (raw / weightedSum)];
        }),
    ) as Record<EmaeSectorAporteKey, number | null>;
}
