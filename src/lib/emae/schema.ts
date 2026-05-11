export const EMAE_SECTORS = [
    { key: 'agro', label: 'Agro', header: 'Agricultura, ganaderia, caza y silvicultura', color: '#84CC16' },
    { key: 'pesca', label: 'Pesca', header: 'Pesca', color: '#06B6D4' },
    { key: 'mineria', label: 'Mineria', header: 'Explotacion de minas y canteras', color: '#A855F7' },
    { key: 'industria', label: 'Industria', header: 'Industria manufacturera', color: '#F97316' },
    { key: 'energia', label: 'Energia', header: 'Electricidad, gas y agua', color: '#FACC15' },
    { key: 'construccion', label: 'Construccion', header: 'Construccion', color: '#FB7185' },
    { key: 'comercio', label: 'Comercio', header: 'Comercio mayorista, minorista y reparaciones', color: '#22C55E' },
    { key: 'hoteles', label: 'Hoteles', header: 'Hoteles y restaurantes', color: '#F59E0B' },
    { key: 'transporte', label: 'Transporte', header: 'Transporte y comunicaciones', color: '#38BDF8' },
    { key: 'finanzas', label: 'Finanzas', header: 'Intermediacion financiera', color: '#818CF8' },
    { key: 'inmobiliarias', label: 'Inmobiliarias', header: 'Actividades inmobiliarias, empresariales y de alquiler', color: '#C084FC' },
    { key: 'administracion_publica', label: 'Administracion publica', header: 'Administracion publica y defensa', color: '#F43F5E' },
    { key: 'ensenanza', label: 'Ensenanza', header: 'Ensenanza', color: '#14B8A6' },
    { key: 'salud', label: 'Salud', header: 'Servicios sociales y de salud', color: '#EF4444' },
    { key: 'otros_servicios', label: 'Otros servicios', header: 'Otras actividades de servicios comunitarios, sociales y personales', color: '#A3E635' },
    { key: 'impuestos', label: 'Impuestos', header: 'Impuestos netos de subsidios', color: '#FFFFFF' },
] as const;

export type EmaeSectorKey = typeof EMAE_SECTORS[number]['key'];
export type EmaeSectorMm12Key = `${EmaeSectorKey}_mm12`;

export const EMAE_SECTOR_KEYS = EMAE_SECTORS.map(sector => sector.key) as EmaeSectorKey[];
export const EMAE_SECTOR_MM12_KEYS = EMAE_SECTOR_KEYS.map(key => `${key}_mm12`) as EmaeSectorMm12Key[];
export const EMAE_BASE_KEYS = ['emae', 'emae_desestacionalizado', 'emae_tendencia'] as const;
export const EMAE_NORMALIZED_DB_COLUMNS = ['fecha', ...EMAE_BASE_KEYS, ...EMAE_SECTOR_MM12_KEYS] as const;
