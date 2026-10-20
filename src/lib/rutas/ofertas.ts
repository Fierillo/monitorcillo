/** Offer stored in rutas_ofertas: tariff in pesos sin IVA as published in the adjudication resolution. */
export type RutaOferta = { tramoId: string; concesionaria: string; tarifa: number; gano: boolean; resolucion: string; fuenteUrl: string };

const PESOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 });
const pesos = (value: number) => `$${PESOS.format(value)}`;

/** Tooltip labels for a tramo: winning tariff and, with more than one ranked offer, count and range. */
export function ofertaLabels(ofertas: RutaOferta[], tramoId: string | null): { tarifa: string; ofertas: string | null } | null {
    const own = ofertas.filter(oferta => oferta.tramoId === tramoId);
    const winner = own.find(oferta => oferta.gano);
    if (!winner) return null;
    const tarifas = own.map(oferta => oferta.tarifa);
    return {
        tarifa: `${pesos(winner.tarifa)} sin IVA`,
        ofertas: own.length > 1 ? `${own.length} (${pesos(Math.min(...tarifas))} – ${pesos(Math.max(...tarifas))})` : null,
    };
}
