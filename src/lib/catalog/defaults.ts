import type { CatalogIndicatorRow } from '@/types';

export const DEFAULT_CATALOG: CatalogIndicatorRow[] = [
    { id: 'bma', indicador: 'Base Monetaria Amplia', referencia: 'Mes anterior', dato: '-', fecha: 'Feb-26', fuente: 'BCRA e INDEC', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'emision', indicador: 'Emisión / Absorción de Pesos', referencia: 'Día anterior', dato: '-', fecha: 'Feb-26', fuente: 'BCRA y MECON', trend: 'neutral', category: 'monetario', has_details: true, source_url: null },
    { id: 'recaudacion', indicador: 'Recaudación tributaria', referencia: 'Mismo mes año anterior', dato: '-', fecha: 'ENE 26', fuente: 'MECON', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: null },
    { id: 'poder-adquisitivo', indicador: 'Poder adquisitivo (ajustado por IPC nucleo)', referencia: 'Mes anterior', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'down', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-61' },
    { id: 'emae', indicador: 'EMAE (Estimador Mensual de Actividad Económica)', referencia: 'Mes anterior desest.', dato: '-', fecha: 'FEB 26', fuente: 'INDEC', trend: 'neutral', category: 'socioeconomico', has_details: true, source_url: 'https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-9-48' },
    { id: 'deuda', indicador: 'Perfil de deuda pública', referencia: 'Año anterior', dato: '-', fecha: '-', fuente: 'MECON, BCRA e INDEC', trend: 'neutral', category: 'fiscal', has_details: true, source_url: 'https://www.argentina.gob.ar/economia/finanzas/datos-trimestrales-de-la-deuda' },
];
