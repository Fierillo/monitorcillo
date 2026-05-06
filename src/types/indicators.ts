export type IndicatorType = 'emision' | 'emae' | 'bma' | 'reca' | 'poder';

export type IndicatorTrend = 'up' | 'down' | 'neutral';

export type Indicator = {
    id: string;
    fecha: string;
    fuente: string;
    indicador: string;
    referencia: string;
    referenceDescription?: string;
    dato: string;
    trend?: IndicatorTrend;
    category?: string;
    hasDetails?: boolean;
    sourceUrl?: string | null;
};

export type CatalogIndicatorRow = {
    id: string;
    indicador: string;
    referencia: string;
    reference_description?: string;
    dato: string;
    fecha: string;
    fuente: string;
    trend: IndicatorTrend;
    category: string;
    has_details: boolean;
    source_url: string | null;
};
