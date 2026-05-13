import type { PobrezaRawRow } from '@/types';
import { fetchFromUrl, fetchTextFromUrl } from './sync/http-client';
import { extractUtdtChartData, getUtdtNowcastValues } from './pobreza-ocr';

const INDEC_POBREZA_SERIES_ID = '64.2_POBLACION_NUA_0_0_34_74';
const UTDT_POBREZA_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=22217&id_item_menu=36605';
const UTDT_CHART_IMAGE_URL = 'https://www.utdt.edu/imagen/_177670640061160500.png';

export async function fetchIndecPobrezaRows(): Promise<PobrezaRawRow[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${INDEC_POBREZA_SERIES_ID}&format=json`;
    const response = await fetchFromUrl(url);
    return (response.data ?? [])
        .filter(row => typeof row[0] === 'string' && row[1] != null)
        .map(row => ({ fecha: row[0], pobreza_indec: Number(row[1]) * 100 }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchUtdtPobrezaRows(): Promise<PobrezaRawRow[]> {
    try {
        const chartData = await extractUtdtChartData(UTDT_CHART_IMAGE_URL);
        const nowcastValues = getUtdtNowcastValues(chartData, 'Jul25Dic25');

        return nowcastValues.map(({ fecha, value }) => ({
            fecha,
            pobreza_utdt_proyectada: value,
        }));
    } catch (error) {
        console.error('Failed to extract UTDT nowcast from chart:', error);
        return [];
    }
}

export async function fetchPobrezaRaw(): Promise<PobrezaRawRow[]> {
    const [indecRows, utdtRows] = await Promise.all([
        fetchIndecPobrezaRows(),
        fetchUtdtPobrezaRows(),
    ]);

    const byFecha = new Map(indecRows.map(row => [row.fecha, row]));

    for (const row of utdtRows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }

    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
