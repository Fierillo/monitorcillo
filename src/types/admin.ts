export type EditableNumber = number | '-';

export type EmisionAdminRow = {
    fecha: string;
    iso_fecha?: string;
    TOTAL: number;
    ACUMULADO?: number;
    CompraDolares: EditableNumber;
    TC: EditableNumber;
    BCRA: number;
    Vencimientos: EditableNumber;
    Licitado: EditableNumber;
    Licitaciones: number;
    'Resultado fiscal': EditableNumber;
};

export type EmisionAdminEditableField = 'fecha' | 'CompraDolares' | 'TC' | 'Vencimientos' | 'Licitado' | 'Resultado fiscal';

export type EmisionAdminNumericField = Exclude<EmisionAdminEditableField, 'fecha'>;

export type EmisionDataResponse = {
    data?: EmisionAdminRow[];
};
