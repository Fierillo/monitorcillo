import type { NumericValue } from './common';
import type { IndicatorType } from './indicators';

export type BcraVariableRow = {
    fecha: string;
    valor: NumericValue;
};

export type DatosGobSeriesRow = [string, ...NumericValue[]];

export type DatosGobSeriesResponse = {
    data?: DatosGobSeriesRow[];
};

export type EmisionRawRow = {
    fecha: string;
    compra_dolares?: NumericValue;
    tc?: NumericValue;
    bcra?: NumericValue;
    vencimientos?: NumericValue;
    licitado?: NumericValue;
    resultado_fiscal?: NumericValue;
    valor?: NumericValue;
};

export type EmisionRawEditableField = Exclude<keyof EmisionRawRow, 'fecha' | 'valor'>;

export type EmisionNormalizedRow = {
    fecha: string;
    iso_fecha: string;
    BCRA: number;
    BCRA_POS: number | null;
    BCRA_NEG: number | null;
    TC: number;
    CompraDolares: number;
    Vencimientos: number;
    Licitado: number;
    Licitaciones: number;
    Licitaciones_POS: number | null;
    Licitaciones_NEG: number | null;
    'Resultado fiscal': number;
    ResultadoFiscal_POS: number | null;
    ResultadoFiscal_NEG: number | null;
    TOTAL: number;
    ACUMULADO: number;
};

export type EmaeRawRow = {
    fecha: string;
    emae?: NumericValue;
    emae_desestacionalizado?: NumericValue;
    emae_tendencia?: NumericValue;
};

export type EmaeNormalizedRow = {
    fecha: string;
    iso_fecha: string;
    emae: number | null;
    emae_desestacionalizado: number | null;
    emae_tendencia: number | null;
};

export type BmaRawRow = {
    fecha: string;
    base_monetaria?: NumericValue;
    pases?: NumericValue;
    leliq?: NumericValue;
    lefi?: NumericValue;
    otros?: NumericValue;
    depositos_tesoro?: NumericValue;
    pbi_trimestral?: NumericValue;
    emae_desestacionalizado?: NumericValue;
    ipc_nucleo?: NumericValue;
};

export type BmaMonthlyBucket = {
    bmTotal: number;
    bmCount: number;
    pasesTotal: number;
    pasesCount: number;
    leliqTotal: number;
    leliqCount: number;
    lefiTotal: number;
    lefiCount: number;
    otrosTotal: number;
    otrosCount: number;
    depositosTesoroTotal: number;
    depositosTesoroCount: number;
    pbi_trimestral: number | null;
    emae_desestacionalizado: number | null;
    ipc_nucleo: number | null;
};

export type BmaNormalizedRow = {
    fecha: string;
    iso_fecha: string;
    BaseMonetaria: number | null;
    PasivosRemunerados: number | null;
    DepositosTesoro: number | null;
    BMAmplia: number | null;
};

export type RecaudacionRawRow = {
    fecha: string;
    mes?: string | null;
    year?: number | null;
    recaudacion_total?: NumericValue;
    pbi_trimestral?: NumericValue;
    emae_desestacionalizado?: NumericValue;
    ipc_nucleo?: NumericValue;
};

export type RecaudacionNormalizedRow = {
    fecha: string;
    iso_fecha: string;
    mes: string;
    year: number;
    pctPbi: number | null;
};

export type PoderAdquisitivoRawRow = {
    fecha: string;
    ipc_nucleo?: NumericValue;
    salario_registrado?: NumericValue;
    salario_no_registrado?: NumericValue;
    salario_privado?: NumericValue;
    salario_publico?: NumericValue;
    ripte?: NumericValue;
    jubilacion_minima?: NumericValue;
};

export type PoderAdquisitivoNormalizedRow = {
    fecha: string;
    iso_fecha: string;
    blanco: number | null;
    negro: number | null;
    privado: number | null;
    publico: number | null;
    ripte: number | null;
    jubilacion: number | null;
};

export type RawDataByType = {
    emision: EmisionRawRow;
    emae: EmaeRawRow;
    bma: BmaRawRow;
    reca: RecaudacionRawRow;
    poder: PoderAdquisitivoRawRow;
};

export type NormalizedDataByType = {
    emision: EmisionNormalizedRow;
    emae: EmaeNormalizedRow;
    bma: BmaNormalizedRow;
    reca: RecaudacionNormalizedRow;
    poder: PoderAdquisitivoNormalizedRow;
};

export type RawDataRow = RawDataByType[IndicatorType];

export type NormalizedDataRow = NormalizedDataByType[IndicatorType];
