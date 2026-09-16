export const SIPA_BREAKDOWN_KEYS = [
    'privado',
    'publico',
    'casas_particulares',
    'autonomos',
    'monotributo',
    'monotributo_social',
] as const;

export type SipaBreakdownKey = (typeof SIPA_BREAKDOWN_KEYS)[number];

export const SIPA_VALUE_KEYS = [...SIPA_BREAKDOWN_KEYS, 'total'] as const;

export type SipaValueKey = (typeof SIPA_VALUE_KEYS)[number];

export const SIPA_NORMALIZED_COLUMNS = ['fecha', ...SIPA_VALUE_KEYS, 'provisional'] as const;

export const SIPA_PAGE_URL = 'https://www.argentina.gob.ar/trabajo/estadisticas';

export const SIPA_BREAKDOWN_SERIES = [
    { key: 'privado', name: 'Asalariados privados', color: '#438FC7' },
    { key: 'publico', name: 'Asalariados públicos', color: '#7DD3FC' },
    { key: 'casas_particulares', name: 'Casas particulares', color: '#F59E0B' },
    { key: 'autonomos', name: 'Autónomos', color: '#22C55E' },
    { key: 'monotributo', name: 'Monotributo', color: '#A855F7' },
    { key: 'monotributo_social', name: 'Monotributo social', color: '#94A3B8' },
] as const satisfies ReadonlyArray<{ key: SipaBreakdownKey; name: string; color: string }>;
