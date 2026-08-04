import type { ChartDataRow } from '@/types';

export const RIGI_INVESTMENTS = {
    approved: { projects: 21, amountUsdMillions: 46708 },
    underEvaluation: { projects: 22, amountUsdMillions: 101241 },
    updatedAt: '2026-07-31',
} as const;

const MONTHLY_APPROVED_USD_MILLIONS = [
    ['2025-01-01', 211],
    ['2025-02-01', 0],
    ['2025-03-01', 2900],
    ['2025-04-01', 15156],
    ['2025-05-01', 2744],
    ['2025-06-01', 0],
    ['2025-07-01', 286],
    ['2025-08-01', 568],
    ['2025-09-01', 0],
    ['2025-10-01', 2672],
    ['2025-11-01', 277],
    ['2025-12-01', 0],
    ['2026-01-01', 665],
    ['2026-02-01', 0],
    ['2026-03-01', 967],
    ['2026-04-01', 0],
    ['2026-05-01', 1314],
    ['2026-06-01', 3432],
    ['2026-07-01', 15516],
] as const;

export const RIGI_EVALUATION_OBSERVATIONS = [
    { observedAt: '2025-01-03', approvedProjects: 1, approvedAmountUsdMillions: 211, evaluationProjects: 7, evaluationAmountUsdMillions: 8655, source: 'https://www.bloomberglinea.com/latinoamerica/argentina/inversiones-rigi-los-ocho-proyectos-presentados-el-aprobado-y-los-que-estan-en-evaluacion/' },
    { observedAt: '2025-04-29', approvedProjects: 2, approvedAmountUsdMillions: 2697, evaluationProjects: 9, evaluationAmountUsdMillions: 12503, source: 'https://www.infobae.com/economia/2025/04/29/en-ocho-meses-del-rigi-ya-se-aprobaron-dos-proyectos-y-hay-inversiones-por-usd-15200-millones-en-carpeta/' },
    { observedAt: '2025-10-22', approvedProjects: 8, approvedAmountUsdMillions: 15729, evaluationProjects: null, evaluationAmountUsdMillions: 19834, source: 'https://www.infobae.com/economia/2025/10/22/a-un-ano-del-rigi-ingresaron-22-proyectos-por-mas-de-usd-35500-millones/' },
    { observedAt: '2026-04-24', approvedProjects: 13, approvedAmountUsdMillions: 27210, evaluationProjects: 22, evaluationAmountUsdMillions: 67755, source: 'https://www.infobae.com/economia/2026/04/24/los-proyectos-presentados-en-el-rigi-ya-suman-usd-95000-millones-uno-por-uno-cuales-son/' },
    { observedAt: '2026-06-11', approvedProjects: 16, approvedAmountUsdMillions: 29892, evaluationProjects: 25, evaluationAmountUsdMillions: 111037, source: 'https://www.argentina.gob.ar/noticias/el-ministerio-de-economia-lanzo-una-web-oficial-con-la-informacion-de-los-proyectos-del' },
    { observedAt: '2026-07-31', approvedProjects: 21, approvedAmountUsdMillions: 46708, evaluationProjects: 22, evaluationAmountUsdMillions: 101241, source: 'https://www.argentina.gob.ar/economia/rigi' },
] as const;

type NonRigiInvestment = {
    id: string;
    name: string;
    company: string;
    sector: string;
    amountUsdMillions: number;
    announcement: { date: string; url: string };
    confirmation: { date: string; url: string; evidence: string } | null;
    revisions?: readonly { date: string; amountUsdMillions: number; url: string }[];
};

export const NON_RIGI_INVESTMENTS: readonly NonRigiInvestment[] = [
    {
        id: 'lindero-gold-mine',
        name: 'Mina de oro Lindero',
        company: 'Fortuna Silver Mines',
        sector: 'Minería',
        amountUsdMillions: 239,
        announcement: { date: '2017-09-21', url: 'https://www.sec.gov/Archives/edgar/data/1341335/000119312517290277/d455532dex991.htm' },
        confirmation: { date: '2017-09-21', url: 'https://www.sec.gov/Archives/edgar/data/1341335/000119312517290277/d455532dex991.htm', evidence: 'Decisión de construcción e inversión inicial aprobada.' },
    },
    {
        id: 'cauchari-solar',
        name: 'Parques solares Cauchari I, II y III',
        company: 'JEMSE',
        sector: 'Energía',
        amountUsdMillions: 511,
        announcement: { date: '2017-10-06', url: 'https://www.argentina.gob.ar/noticias/en-jujuy-se-inician-las-obras-del-parque-fotovoltaico-mas-grande-de-latinoamerica' },
        confirmation: { date: '2017-10-06', url: 'https://www.argentina.gob.ar/noticias/arranco-la-obra-del-parque-solar-cauchari', evidence: 'Inicio de obra documentado.' },
    },
    {
        id: 'genelba-combined-cycle',
        name: 'Segundo ciclo combinado de Genelba',
        company: 'Pampa Energía',
        sector: 'Energía',
        amountUsdMillions: 350,
        announcement: { date: '2017-10-18', url: 'https://ri.pampa.com/en/press-release/awarding-of-expansion-project-at-genelba-thermal-power-plant/' },
        confirmation: { date: '2017-10-18', url: 'https://ri.pampa.com/en/press-release/awarding-of-expansion-project-at-genelba-thermal-power-plant/', evidence: 'Adjudicación con contrato de abastecimiento a 15 años.' },
    },
    {
        id: 'yacyreta-ana-cua',
        name: 'Ampliación hidroeléctrica Aña Cuá',
        company: 'Entidad Binacional Yacyretá',
        sector: 'Infraestructura',
        amountUsdMillions: 329,
        announcement: { date: '2019-11-26', url: 'https://www.eby.gov.py/historico-paraguay-y-argentina-firman-los-contratos-para-iniciar-las-obras-civiles-de-ana-cua/' },
        confirmation: { date: '2019-11-26', url: 'https://www.eby.gov.py/historico-paraguay-y-argentina-firman-los-contratos-para-iniciar-las-obras-civiles-de-ana-cua/', evidence: 'Contratos vinculantes de obra civil y equipamiento firmados.' },
    },
    {
        id: 'mirgor-ontec-baradero',
        name: 'Planta autopartista ONTEC de Baradero',
        company: 'Grupo Mirgor',
        sector: 'Industria automotriz',
        amountUsdMillions: 71,
        announcement: { date: '2021-06-02', url: 'https://www.argentina.gob.ar/noticias/mirgor-invertira-usd-71-millones-en-una-planta-industrial-que-producira-piezas-especiales' },
        confirmation: { date: '2021-10-01', url: 'https://mirgor.com/ontec-la-gran-apuesta-de-mirgor-en-baradero/', evidence: 'Construcción iniciada en octubre de 2021.' },
        revisions: [{ date: '2022-12-06', amountUsdMillions: 70, url: 'https://mirgor.com/ontec-la-gran-apuesta-de-mirgor-en-baradero/' }],
    },
    {
        id: 'eramet-centenario-ratones',
        name: 'Proyecto de litio Centenario-Ratones',
        company: 'Eramet, Eramine y Tsingshan',
        sector: 'Minería',
        amountUsdMillions: 400,
        announcement: { date: '2021-11-08', url: 'https://www.argentina.gob.ar/noticias/eramet-anuncio-que-retoma-la-construccion-de-una-planta-de-litio-en-salta-por-400m-de' },
        confirmation: { date: '2024-07-11', url: 'https://www.argentina.gob.ar/noticias/lucero-presente-en-la-inauguracion-de-la-primera-mina-en-produccion-de-litio-de-salta', evidence: 'Planta inaugurada y operativa.' },
        revisions: [{ date: '2024-07-11', amountUsdMillions: 870, url: 'https://www.argentina.gob.ar/noticias/lucero-presente-en-la-inauguracion-de-la-primera-mina-en-produccion-de-litio-de-salta' }],
    },
    {
        id: 'ypf-luz-zonda-i',
        name: 'Parque Solar Zonda I',
        company: 'YPF Luz',
        sector: 'Energía',
        amountUsdMillions: 90,
        announcement: { date: '2022-02-07', url: 'https://www.argentina.gob.ar/noticias/san-juan-manzur-y-unac-pusieron-en-marcha-las-obras-del-primer-parque-solar-de-ypf' },
        confirmation: { date: '2022-02-07', url: 'https://www.argentina.gob.ar/noticias/san-juan-manzur-y-unac-pusieron-en-marcha-las-obras-del-primer-parque-solar-de-ypf', evidence: 'Inicio formal de construcción.' },
    },
    {
        id: 'lamb-weston-mar-del-plata',
        name: 'Planta de procesamiento de papas de Mar del Plata',
        company: 'Lamb Weston Alimentos Modernos',
        sector: 'Agroindustria',
        amountUsdMillions: 200,
        announcement: { date: '2022-03-08', url: 'https://www.argentina.gob.ar/noticias/lamb-weston-alimentos-modernos-anuncio-que-invertira-us-200m-para-construir-una-planta' },
        confirmation: { date: '2023-04-11', url: 'https://www.argentina.gob.ar/noticias/bahillo-recibio-la-empresa-lamb-weston', evidence: 'Construcción con 20% de avance.' },
        revisions: [{ date: '2023-04-11', amountUsdMillions: 250, url: 'https://www.argentina.gob.ar/noticias/bahillo-recibio-la-empresa-lamb-weston' }],
    },
    {
        id: 'whirlpool-pilar',
        name: 'Planta de lavarropas de Pilar',
        company: 'Whirlpool Latinoamérica',
        sector: 'Manufactura',
        amountUsdMillions: 50,
        announcement: { date: '2022-07-15', url: 'https://www.argentina.gob.ar/noticias/whirlpool-latinoamerica-le-anuncio-scioli-una-inversion-de-50-millones-de-dolares' },
        confirmation: { date: '2022-10-01', url: 'https://www.argentina.gob.ar/noticias/whirlpool-crece-y-ratifica-sus-inversiones-en-argentina', evidence: 'Planta inaugurada en octubre de 2022.' },
    },
    {
        id: 'oldelval-duplicar',
        name: 'Proyecto Duplicar de Oldelval',
        company: 'Oleoductos del Valle',
        sector: 'Infraestructura energética',
        amountUsdMillions: 750,
        announcement: { date: '2022-09-16', url: 'https://www.argentina.gob.ar/noticias/energia-firmo-la-prorroga-que-hara-duplicar-la-capacidad-de-transporte-para-vaca-muerta' },
        confirmation: { date: '2023-02-14', url: 'https://www.argentina.gob.ar/noticias/royon-inauguro-un-nuevo-oleoducto-que-amplia-la-capacidad-de-transporte-desde-vaca-muerta', evidence: 'Construcción en ejecución.' },
    },
    {
        id: 'fenix-offshore-gas',
        name: 'Proyecto offshore de gas Fénix',
        company: 'TotalEnergies, Wintershall Dea y Pan American Energy',
        sector: 'Energía',
        amountUsdMillions: 700,
        announcement: { date: '2022-09-22', url: 'https://www.argentina.gob.ar/noticias/confirmaron-una-inversion-de-700-millones-de-dolares-para-el-desarrollo-del-proyecto-fenix' },
        confirmation: { date: '2022-09-22', url: 'https://www.argentina.gob.ar/noticias/confirmaron-una-inversion-de-700-millones-de-dolares-para-el-desarrollo-del-proyecto-fenix', evidence: 'Decisión final de inversión confirmada.' },
    },
    {
        id: 'volkswagen-cordoba-trucks-buses',
        name: 'Producción de camiones y buses en Córdoba',
        company: 'Volkswagen Group Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 50,
        announcement: { date: '2022-12-15', url: 'https://www.argentina.gob.ar/noticias/volkswagen-internacional-elige-argentina-para-produccion-de-camiones' },
        confirmation: { date: '2024-05-13', url: 'https://www.argentina.gob.ar/noticias/volkswagen-group-argentina-anuncio-el-inicio-de-la-produccion-en-serie-de-vw-camiones-y', evidence: 'Producción en serie iniciada.' },
    },
    {
        id: 'sierras-blancas-allen-pipeline',
        name: 'Oleoducto Sierras Blancas-Allen',
        company: 'Shell Argentina, Pan American Energy y Pluspetrol',
        sector: 'Infraestructura energética',
        amountUsdMillions: 100,
        announcement: { date: '2023-02-14', url: 'https://www.argentina.gob.ar/noticias/royon-inauguro-un-nuevo-oleoducto-que-amplia-la-capacidad-de-transporte-desde-vaca-muerta' },
        confirmation: { date: '2023-02-14', url: 'https://www.argentina.gob.ar/noticias/royon-inauguro-un-nuevo-oleoducto-que-amplia-la-capacidad-de-transporte-desde-vaca-muerta', evidence: 'Oleoducto inaugurado.' },
    },
    {
        id: 'ford-pacheco-ranger-engines',
        name: 'Producción local de motores para Ford Ranger',
        company: 'Ford Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 80,
        announcement: { date: '2023-03-06', url: 'https://www.argentina.gob.ar/noticias/ford-argentina-le-anuncio-al-ministro-massa-inversion-por-80-millones-de-dolares-para' },
        confirmation: null,
    },
    {
        id: 'toyota-hiace-zarate',
        name: 'Producción de Toyota Hiace en Zárate',
        company: 'Toyota Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 50,
        announcement: { date: '2023-06-12', url: 'https://www.argentina.gob.ar/noticias/por-primera-vez-en-23-anos-toyota-argentina-produce-un-nuevo-vehiculo-en-el-pais' },
        confirmation: { date: '2024-02-15', url: 'https://www.argentina.gob.ar/noticias/toyota-anuncia-inversiones-para-producir-su-tercer-modelo-en-argentina', evidence: 'Producción local implementada.' },
    },
    {
        id: 'mercedes-benz-zarate-industrial-center',
        name: 'Centro industrial de camiones y buses de Zárate',
        company: 'Mercedes-Benz Camiones y Buses Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 110,
        announcement: { date: '2024-03-20', url: 'https://www.argentina.gob.ar/noticias/mercedes-benz-camiones-y-buses-argentina-construira-una-nueva-planta-de-produccion-en' },
        confirmation: { date: '2024-03-20', url: 'https://www.argentina.gob.ar/noticias/mercedes-benz-camiones-y-buses-argentina-construira-una-nueva-planta-de-produccion-en', evidence: 'Obras del centro industrial en ejecución.' },
    },
    {
        id: 'stellantis-cordoba-new-vehicle-family',
        name: 'Nueva familia de vehículos y motor en Ferreyra',
        company: 'Stellantis Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 385,
        announcement: { date: '2024-09-05', url: 'https://www.media.stellantis.com/ar-es/corporate/press/stellantis-anuncia-la-inversion-para-una-nueva-familia-de-vehiculos-y-un-nuevo-motor-en-su-planta-de-cordoba' },
        confirmation: { date: '2025-05-13', url: 'https://www.media.stellantis.com/ar-es/corporate/press/stellantis-inicia-la-produccion-de-la-pick-up-fiat-titano-en-su-polo-industrial-cordoba', evidence: 'Producción de la Fiat Titano iniciada.' },
    },
    {
        id: 'renault-santa-isabel-pickup',
        name: 'Pickup de media tonelada de Santa Isabel',
        company: 'Renault Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 350,
        announcement: { date: '2024-09-17', url: 'https://prensa.renault.com.ar/comunicado/RENAULT%20ARGENTINA%20ANUNCIA%20UNA%20INVERSI%C3%93N%20DE%20350%20MILLONES%20DE%20D%C3%93LARES%20PARA%20PRODUCIR%20UNA%20PICK%20UP%20DE%20MEDI' },
        confirmation: { date: '2025-03-20', url: 'https://prensa.renault.com.ar/comunicado/emblema-de-la-industria-nacional-argentina-fabrica-santa-isabel-celebro-sus-70-anos-con-un-repaso-por-su-historia-presente-y-futuro', evidence: 'Transformación de la planta e incorporación de infraestructura iniciadas.' },
    },
    {
        id: 'volkswagen-pacheco-new-pickup',
        name: 'Nueva pickup de Volkswagen',
        company: 'Volkswagen Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 580,
        announcement: { date: '2025-04-03', url: 'https://www.argentina.gob.ar/noticias/volkswagen-argentina-anuncia-una-inversion-de-usd-580-millones-para-producir-una-nueva' },
        confirmation: null,
    },
    {
        id: 'calcatreu-development',
        name: 'Calcatreu',
        company: 'Patagonia Gold Corp.',
        sector: 'Minería',
        amountUsdMillions: 40,
        announcement: { date: '2025-04-14', url: 'https://patagoniagold.com/wp-content/uploads/2025/08/Patagonia-Gold-June-30-2025-MDA-VF.pdf' },
        confirmation: { date: '2025-05-30', url: 'https://patagoniagold.com/wp-content/uploads/2025/08/Patagonia-Gold-June-30-2025-MDA-VF.pdf', evidence: 'Financiamiento cerrado y fondos restringidos al desarrollo de Calcatreu.' },
    },
    {
        id: 'adium-san-juan-expansion',
        name: 'Ampliación de planta farmacéutica de San Juan',
        company: 'Adium Argentina',
        sector: 'Industria farmacéutica',
        amountUsdMillions: 50,
        announcement: { date: '2025-06-25', url: 'https://adiumpharma.com/general/adium-reafirma-compromiso-argentina-anuncia-inversion-historica-planta-san-juan/' },
        confirmation: null,
    },
    {
        id: 'mercado-libre-tres-de-febrero',
        name: 'Centro de almacenamiento de Tres de Febrero',
        company: 'Mercado Libre y Grupo Posadas',
        sector: 'Logística',
        amountUsdMillions: 65,
        announcement: { date: '2025-07-14', url: 'https://news.mercadolibre.com/centro-de-almacenamiento-3-de-febrero-argentina' },
        confirmation: { date: '2025-07-14', url: 'https://news.mercadolibre.com/centro-de-almacenamiento-3-de-febrero-argentina', evidence: 'Construcción iniciada.' },
    },
    {
        id: 'alma-gba-storage',
        name: 'Almacenamiento eléctrico Alma-GBA',
        company: 'Adjudicatarios privados, Edenor y Edesur',
        sector: 'Energía',
        amountUsdMillions: 540,
        announcement: { date: '2025-09-01', url: 'https://www.argentina.gob.ar/noticias/el-gobierno-nacional-adjudico-660-mw-de-almacenamiento-electrico-en-el-amba-superando-en-30' },
        confirmation: { date: '2025-09-01', url: 'https://www.argentina.gob.ar/noticias/el-gobierno-nacional-adjudico-660-mw-de-almacenamiento-electrico-en-el-amba-superando-en-30', evidence: 'Licitación adjudicada con contratos a celebrar y CAMMESA como garante de pago.' },
    },
    {
        id: 'ford-pacheco-ranger-phev',
        name: 'Producción de Ranger híbrida enchufable',
        company: 'Ford Argentina',
        sector: 'Industria automotriz',
        amountUsdMillions: 170,
        announcement: { date: '2025-10-29', url: 'https://web.archive.org/web/20251105193913id_/https://media.ford.com/content/fordmedia/fsa/ar/es/news/2025/10/ford-anuncia-la-produccion-de-la-nueva-ranger-hibrida-enchufable.html' },
        confirmation: null,
    },
    {
        id: 'mercado-libre-escobar',
        name: 'Centro de almacenamiento de Escobar',
        company: 'Mercado Libre y Plaza Logística',
        sector: 'Logística',
        amountUsdMillions: 115,
        announcement: { date: '2026-03-18', url: 'https://news.mercadolibre.com/centro-de-almacenamiento-escobar-argentina' },
        confirmation: { date: '2026-03-18', url: 'https://news.mercadolibre.com/centro-de-almacenamiento-escobar-argentina', evidence: 'Contrato vinculante de desarrollo built-to-suit.' },
    },
    {
        id: 'irsa-mercado-libre-polo-dot',
        name: 'Ampliación de oficinas en Polo DOT',
        company: 'IRSA y Mercado Libre',
        sector: 'Infraestructura corporativa',
        amountUsdMillions: 50,
        announcement: { date: '2026-03-26', url: 'https://news.mercadolibre.com/mercado-libre-invierte-en-oficinas-en-polo-dot-argentina-2026' },
        confirmation: { date: '2026-03-26', url: 'https://news.mercadolibre.com/mercado-libre-invierte-en-oficinas-en-polo-dot-argentina-2026', evidence: 'Acuerdo firmado y construcción iniciada.' },
    },
    {
        id: 'alma-sadi-storage',
        name: 'Almacenamiento eléctrico Alma-SADI',
        company: 'Genneia, DQD Energy, 360 Energy Solar, Aluar e Intermepro',
        sector: 'Energía',
        amountUsdMillions: 700,
        announcement: { date: '2026-07-07', url: 'https://www.argentina.gob.ar/noticias/el-gobierno-nacional-adjudico-700-mw-de-almacenamiento-electrico-en-baterias-para' },
        confirmation: { date: '2026-07-07', url: 'https://www.argentina.gob.ar/noticias/el-gobierno-nacional-adjudico-700-mw-de-almacenamiento-electrico-en-baterias-para', evidence: 'Adjudicación formalizada mediante la Resolución 155/2026.' },
    },
] as const;

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

const EVALUATION_BY_MONTH = new Map(
    RIGI_EVALUATION_OBSERVATIONS.map(observation => [`${observation.observedAt.slice(0, 7)}-01`, observation.evaluationAmountUsdMillions]),
);
const RIGI_APPROVED_BY_MONTH = new Map<string, number>(MONTHLY_APPROVED_USD_MILLIONS);
const TIMELINE_MONTHS = buildMonthlyDates('2017-01-01', RIGI_INVESTMENTS.updatedAt.slice(0, 7) + '-01');

let approvedAccumulated = 0;
let underEvaluation = 0;

export const RIGI_INVESTMENT_CHART_DATA: ChartDataRow[] = TIMELINE_MONTHS.map(date => {
    const [year, month] = date.split('-');
    approvedAccumulated += RIGI_APPROVED_BY_MONTH.get(date) ?? 0;
    underEvaluation = EVALUATION_BY_MONTH.get(date) ?? underEvaluation;
    const monthKey = date.slice(0, 7);
    const activeNonRigi = NON_RIGI_INVESTMENTS.filter(investment => investment.announcement.date.slice(0, 7) <= monthKey);
    const confirmed = activeNonRigi.filter(investment => investment.confirmation && investment.confirmation.date.slice(0, 7) <= monthKey);
    const confirmedIds = new Set(confirmed.map(investment => investment.id));

    return {
        fecha: `${MONTHS[Number(month) - 1]} ${year.slice(2)}`,
        iso_fecha: date,
        aprobadas: approvedAccumulated,
        en_evaluacion: underEvaluation,
        anunciadas: activeNonRigi.filter(investment => !confirmedIds.has(investment.id)).reduce((total, investment) => total + investmentAmountAt(investment, monthKey), 0),
        confirmadas: confirmed.reduce((total, investment) => total + investmentAmountAt(investment, monthKey), 0),
    };
});

function buildMonthlyDates(start: string, end: string): string[] {
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    const dates: string[] = [];

    for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); month++) {
        if (month === 13) {
            year++;
            month = 1;
        }
        dates.push(`${year}-${String(month).padStart(2, '0')}-01`);
    }

    return dates;
}

function investmentAmountAt(investment: NonRigiInvestment, month: string): number {
    const revision = investment.revisions?.findLast(item => item.date.slice(0, 7) <= month);
    return revision?.amountUsdMillions ?? investment.amountUsdMillions;
}
