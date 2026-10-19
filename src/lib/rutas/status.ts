export type ConcessionStage = 'concesionado' | 'en-licitacion' | 'sin-concesionar';
export type PavementCondition = 'bueno' | 'regular' | 'malo' | 'sin-dato';
export type ColorMode = 'concesion' | 'pavimento';

export const CONCESSION_STAGES: ConcessionStage[] = ['concesionado', 'en-licitacion', 'sin-concesionar'];
export const PAVEMENT_CONDITIONS: PavementCondition[] = ['bueno', 'regular', 'malo', 'sin-dato'];

export const CONCESSION_COLORS: Record<ConcessionStage | 'sin-dato', string> = {
    concesionado: '#4ADE80',
    'en-licitacion': '#FBBF24',
    'sin-concesionar': '#38BDF8',
    'sin-dato': '#94A3B8',
};

export const PAVEMENT_COLORS: Record<PavementCondition, string> = {
    bueno: '#4ADE80',
    regular: '#FBBF24',
    malo: '#F87171',
    'sin-dato': '#94A3B8',
};

export const CONCESSION_LABELS: Record<ConcessionStage | 'sin-dato', string> = {
    concesionado: 'Concesionado',
    'en-licitacion': 'En licitación',
    'sin-concesionar': 'Sin concesionar',
    'sin-dato': 'Sin dato',
};

export const PAVEMENT_LABELS: Record<PavementCondition, string> = {
    bueno: 'Bueno',
    regular: 'Regular',
    malo: 'Malo',
    'sin-dato': 'Sin dato',
};

export const PAVEMENT_SOURCE_NOTE = 'Estado de pavimento según carga manual. Referencia: Informe Anual de Evaluación de Estado de Pavimentos 2023-2024 de la Dirección Nacional de Vialidad. Los tramos sin medición figuran en gris (sin dato).';

export const CONCESSION_SOURCE_NOTE = 'Etapa inicial de la Red Federal de Concesiones tomada de Vialidad Nacional y del Boletín Oficial. Los cambios posteriores se cargan a mano. Las rutas sin tramo cargado figuran en gris (sin dato).';

export const RUTAS_METHODOLOGY = [
    {
        title: 'Geometría',
        description: 'Rutas nacionales publicadas por la Dirección de Observatorio Nacional de Transporte, con fuente Dirección Nacional de Vialidad, en https://datos.transporte.gob.ar/dataset/rutas-nacionales (GeoJSON WFS idera:Rutas_Nacionales, licencia CC-BY-4.0, descarga del 19/10/2026). Se conservó un sentido por ruta y se simplificó la traza para el mapa. La progresiva final de cada ruta se usa como kilómetros cuando el tramo no carga los suyos.',
    },
    {
        title: 'Contorno',
        description: 'Límites provinciales del Instituto Geográfico Nacional vía la API Georef: https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson. Se excluyen los polígonos al sur de 56° S (sector antártico) y las islas al este de las Malvinas, para que el continente ocupe el mapa. El contorno fueguino insular y las Malvinas permanecen.',
    },
    {
        title: 'Concesión',
        description: 'La etapa de la Red Federal de Concesiones (concesionado, en licitación o sin concesionar) no sale de una API. Si todavía no hay tramos guardados, el mapa usa la carga inicial oficial de Vialidad Nacional y el Boletín Oficial. El administrador puede editarla y, al guardar, esa versión reemplaza a la carga inicial. Una ruta sin tramo queda en gris, como sin dato, y no se asume sin concesionar. Si una ruta figura en más de un tramo, vale el último de la lista.',
    },
    {
        title: 'Pavimento',
        description: 'El Informe Anual de Evaluación de Estado de Pavimentos 2023-2024 de la Dirección Nacional de Vialidad califica la calzada con el Índice de Estado (bueno, regular o malo) y no está publicado por tramo en el catálogo de datos abiertos (https://www.argentina.gob.ar/transporte/vialidad-nacional/transparencia-vialidad-nacional/catalogos-de-datos-abiertos) ni en el WFS de SIG-Vial (https://sigvial.vialidad.gob.ar/geoserver/dnv/ows). La capa «Tipo de pavimento 2025» describe el tipo de superficie, no el estado. Por eso el color se carga a mano. Lo no medido o no cargado se dibuja en gris (sin dato).',
    },
    {
        title: 'Detalle',
        description: 'Al pasar el cursor o tocar una ruta se muestran el número y cada tramo que la incluye, con su concesionaria, kilómetros y estado. A la derecha, los escudos de cada tramo resaltan una o más rutas; sin ninguna elegida se ve la red completa. Con la tabla vacía se muestra la carga inicial. Después del primer guardado del administrador, vale lo que quedó en la base.',
    },
];

export type RutaTramoDraft = {
    id?: string;
    nombre: string;
    rutas: string;
    km: string;
    concesionaria: string;
    fechaTomaPosesion: string;
    obrasInicialesPct: string;
    fechaHabilitacionTarifa: string;
    etapa: string;
    pavimento: string;
};

export type RutaTramo = {
    id: string;
    nombre: string;
    rutas: string[];
    km: number | null;
    concesionaria: string;
    fechaTomaPosesion: string | null;
    obrasInicialesPct: number | null;
    fechaHabilitacionTarifa: string | null;
    etapa: ConcessionStage;
    pavimento: PavementCondition;
};

export type RouteGeometry = {
    code: string;
    label: string;
    km: number | null;
    lines: number[][][];
};

export type RutasGeometry = {
    source: { routes: string; outline: string; retrieved: string };
    routes: RouteGeometry[];
    outline: number[][][];
};

export type RouteAssignment = {
    tramo: string;
    concesionaria: string;
    kmLabel: string;
    statusLabel: string;
};

export type RouteSign = 'nacional' | 'provincial';

export type PaintedRoute = {
    code: string;
    label: string;
    km: number | null;
    kmLabel: string;
    concesionaria: string;
    tramo: string | null;
    assignments: RouteAssignment[];
    status: ConcessionStage | PavementCondition | 'sin-dato';
    statusLabel: string;
    color: string;
    lines: number[][][];
};

export type ProjectedRoute = PaintedRoute & { paths: string[] };

export type ProjectedMap = {
    viewBox: string;
    outlinePaths: string[];
    routes: ProjectedRoute[];
};

const KM_FORMAT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const DRAFT_FIELDS = ['nombre', 'rutas', 'km', 'concesionaria', 'fechaTomaPosesion', 'obrasInicialesPct', 'fechaHabilitacionTarifa', 'etapa', 'pavimento'] as const;

export function normalizeRouteCode(value: string): string | null {
    const cleaned = value.trim().toUpperCase().replace(/^RUTA\s+/, '').replace(/^RN\s*/, '');
    if (!cleaned || /\s/.test(cleaned) || !/\d/.test(cleaned)) return null;
    const access = cleaned.match(/^A0*(\d+)$/);
    if (access) return `A${Number(access[1])}`;
    if (/^\d+$/.test(cleaned)) return String(Number(cleaned));
    if (/^(?:\d+V\d+|\d+S\d+|\d+[A-Z]{1,2}|V\d+)$/.test(cleaned)) return cleaned;
    return null;
}

export function parseRouteList(value: string): string[] {
    const codes: string[] = [];
    for (const token of value.split(/[,;/]|\s+y\s+|\s+e\s+/i)) {
        for (const candidate of [token, ...token.trim().split(/\s+/)]) {
            const code = normalizeRouteCode(candidate);
            if (code && !codes.includes(code)) codes.push(code);
        }
    }
    return codes;
}

export function parseRutasPayload(data: unknown): RutaTramo[] {
    if (!Array.isArray(data)) throw new Error('Los tramos tienen que enviarse como una lista.');
    const tramos: RutaTramo[] = [];
    for (const row of data) {
        if (!row || typeof row !== 'object') throw new Error('Cada tramo tiene que ser un objeto con nombre, rutas y etapa.');
        if (isBlankDraft(row as Record<string, unknown>)) continue;
        tramos.push(parseTramoDraft(row as Record<string, unknown>, tramos.length + 1));
    }
    const ids = new Set<string>();
    for (const tramo of tramos) {
        if (ids.has(tramo.id)) throw new Error(`Hay dos tramos con el id ${tramo.id}. Dejá un id distinto en cada fila.`);
        ids.add(tramo.id);
    }
    return tramos;
}

export function routeSign(code: string): RouteSign {
    const cleaned = code.trim().toUpperCase().replace(/\s+/g, '');
    return /^(?:RP|P)\d/.test(cleaned) ? 'provincial' : 'nacional';
}

export function paintRoutes(routes: RouteGeometry[], tramos: RutaTramo[], mode: ColorMode): PaintedRoute[] {
    return routes.map(route => {
        const matches = tramos.filter(tramo => tramo.rutas.includes(route.code));
        const tramo = matches.at(-1) ?? null;
        const status = statusFor(tramo, mode);
        const km = tramo?.km ?? route.km;
        const assignments = matches.map(match => assignmentFor(match, route.km, mode));
        return {
            code: route.code,
            label: route.label,
            km,
            kmLabel: km === null ? 'Sin dato' : `${KM_FORMAT.format(km)} km`,
            concesionaria: tramo?.concesionaria?.trim() || 'Sin dato',
            tramo: tramo?.nombre ?? null,
            assignments,
            status,
            statusLabel: labelFor(status, mode),
            color: mode === 'concesion' ? CONCESSION_COLORS[status as ConcessionStage | 'sin-dato'] : PAVEMENT_COLORS[status as PavementCondition],
            lines: route.lines,
        };
    });
}

function assignmentFor(tramo: RutaTramo, routeKm: number | null, mode: ColorMode): RouteAssignment {
    const status = statusFor(tramo, mode);
    const km = tramo.km ?? routeKm;
    return {
        tramo: tramo.nombre,
        concesionaria: tramo.concesionaria?.trim() || 'Sin dato',
        kmLabel: km === null ? 'Sin dato' : `${KM_FORMAT.format(km)} km`,
        statusLabel: labelFor(status, mode),
    };
}

function labelFor(status: ConcessionStage | PavementCondition | 'sin-dato', mode: ColorMode): string {
    return mode === 'concesion' ? CONCESSION_LABELS[status as ConcessionStage | 'sin-dato'] : PAVEMENT_LABELS[status as PavementCondition];
}

const MAP_PADDING = 12;
const PAST_MALVINAS_LON = -50;

export function frameMapSize(outline: number[][][], routes: { lines: number[][][] }[], height: number): { width: number; height: number } {
    const bounds = boundsOf(outlineUpToMalvinas(outline), routes);
    if (!bounds) return { width: height, height };
    const { xSpan, ySpan } = spanOf(bounds);
    const scale = (height - MAP_PADDING * 2) / ySpan;
    return { width: Math.max(1, Math.round(xSpan * scale + MAP_PADDING * 2)), height };
}

export function projectMap(outline: number[][][], routes: PaintedRoute[], width: number, height: number): ProjectedMap {
    const framed = outlineUpToMalvinas(outline);
    const bounds = boundsOf(framed, routes);
    const project = bounds ? projector(bounds, width, height) : null;
    return {
        viewBox: `0 0 ${width} ${height}`,
        outlinePaths: project ? framed.map(ring => toPath(ring, project)) : [],
        routes: routes.map(route => ({ ...route, paths: project ? route.lines.map(line => toPath(line, project)) : [] })),
    };
}

function outlineUpToMalvinas(outline: number[][][]): number[][][] {
    return outline.filter(ring => ring.some(([lon]) => lon <= PAST_MALVINAS_LON));
}

function statusFor(tramo: RutaTramo | null, mode: ColorMode): ConcessionStage | PavementCondition | 'sin-dato' {
    if (!tramo) return 'sin-dato';
    return mode === 'concesion' ? tramo.etapa : tramo.pavimento;
}

function isBlankDraft(row: Record<string, unknown>): boolean {
    return DRAFT_FIELDS.every(field => String(row[field] ?? '').trim() === '');
}

function parseTramoDraft(row: Record<string, unknown>, position: number): RutaTramo {
    const nombre = String(row.nombre ?? '').trim();
    if (!nombre) throw new Error('Hay un tramo sin nombre. Completá el nombre antes de guardar.');
    const rutas = parseRouteList(String(row.rutas ?? ''));
    if (rutas.length === 0) throw new Error(`El tramo ${nombre} no incluye ninguna ruta reconocible. Escribí números como 9, 12 o A012.`);
    const etapa = String(row.etapa ?? '').trim();
    if (!CONCESSION_STAGES.includes(etapa as ConcessionStage)) {
        throw new Error(`La etapa del tramo ${nombre} no es válida. Usá concesionado, en-licitacion o sin-concesionar.`);
    }
    const pavimento = String(row.pavimento ?? '').trim() || 'sin-dato';
    if (!PAVEMENT_CONDITIONS.includes(pavimento as PavementCondition)) {
        throw new Error(`El pavimento del tramo ${nombre} no es válido. Usá bueno, regular, malo o sin-dato.`);
    }
    const id = validId(row.id) ?? `tramo-${position}`;
    return {
        id,
        nombre,
        rutas,
        km: parseOptionalNumber(row.km, `Los kilómetros del tramo ${nombre} no son un número. Usá cifras, por ejemplo 1200,5.`, value => value >= 0),
        concesionaria: String(row.concesionaria ?? '').trim(),
        fechaTomaPosesion: parseDate(row.fechaTomaPosesion, 'fecha de toma de posesión', nombre),
        obrasInicialesPct: parseOptionalNumber(row.obrasInicialesPct, `El porcentaje de obras iniciales del tramo ${nombre} tiene que estar entre 0 y 100.`, value => value >= 0 && value <= 100),
        fechaHabilitacionTarifa: parseDate(row.fechaHabilitacionTarifa, 'fecha de habilitación de tarifa', nombre),
        etapa: etapa as ConcessionStage,
        pavimento: pavimento as PavementCondition,
    };
}

function validId(value: unknown): string | null {
    const id = String(value ?? '').trim();
    return /^[a-z0-9-]{1,64}$/.test(id) ? id : null;
}

function parseOptionalNumber(value: unknown, invalidMessage: string, accept: (value: number) => boolean): number | null {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const normalized = text.includes(',')
        ? text.replace(/\./g, '').replace(',', '.')
        : /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text;
    const number = Number(normalized);
    if (!Number.isFinite(number) || !accept(number)) throw new Error(invalidMessage);
    return number;
}

function parseDate(value: unknown, label: string, nombre: string): string | null {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const year = Number(match?.[1]);
    const month = Number(match?.[2]);
    const day = Number(match?.[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!match || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error(`La ${label} del tramo ${nombre} no es válida. Usá el formato AAAA-MM-DD.`);
    }
    return text;
}

function boundsOf(outline: number[][][], routes: { lines: number[][][] }[]): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    const visit = (lon: number, lat: number) => {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    };
    for (const ring of outline) for (const [lon, lat] of ring) visit(lon, lat);
    for (const route of routes) for (const line of route.lines) for (const [lon, lat] of line) visit(lon, lat);
    if (!Number.isFinite(minLon) || minLon === maxLon || minLat === maxLat) return null;
    return { minLon, minLat, maxLon, maxLat };
}

function spanOf(bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number }) {
    const midLat = (bounds.minLat + bounds.maxLat) / 2;
    const lonFactor = Math.cos(midLat * Math.PI / 180);
    return { lonFactor, xSpan: (bounds.maxLon - bounds.minLon) * lonFactor, ySpan: bounds.maxLat - bounds.minLat };
}

function projector(bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number }, width: number, height: number) {
    const { lonFactor, xSpan, ySpan } = spanOf(bounds);
    const scale = Math.min((width - MAP_PADDING * 2) / xSpan, (height - MAP_PADDING * 2) / ySpan);
    const offsetX = MAP_PADDING + (width - MAP_PADDING * 2 - xSpan * scale) / 2;
    const offsetY = MAP_PADDING + (height - MAP_PADDING * 2 - ySpan * scale) / 2;
    return (lon: number, lat: number): [number, number] => [
        offsetX + (lon - bounds.minLon) * lonFactor * scale,
        offsetY + (bounds.maxLat - lat) * scale,
    ];
}

function toPath(points: number[][], project: (lon: number, lat: number) => [number, number]): string {
    return points.map((point, index) => {
        const [x, y] = project(point[0], point[1]);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join('');
}
