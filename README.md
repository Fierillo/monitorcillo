<div align="center">
  <h1>Monitorcillo</h1>
  <p><strong>Monitor macroeconómico de la Argentina, actualizado con fuentes oficiales y diseñado para leer datos rápido.</strong></p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white">
    <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
    <img alt="Neon" src="https://img.shields.io/badge/Neon-Postgres-00E599?style=for-the-badge&logo=neon&logoColor=001B2E">
    <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white">
  </p>

  <p>
    <a href="https://github.com/Fierillo/monitorcillo/actions/workflows/sync.yml">
      <img alt="Sync Data" src="https://img.shields.io/github/actions/workflow/status/Fierillo/monitorcillo/sync.yml?branch=main&label=sync&style=flat-square">
    </a>
    <img alt="pnpm" src="https://img.shields.io/badge/pnpm-10.28.2-F69220?style=flat-square&logo=pnpm&logoColor=white">
    <a href="./LICENSE">
      <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
    </a>
  </p>
</div>

---

## Qué Es

Monitorcillo consolida indicadores económicos argentinos en una interfaz compacta, cacheada y lista para consultar. Toma datos de BCRA, INDEC, MECON y otras fuentes oficiales, los normaliza con reglas propias del proyecto y publica tablas y gráficos comparables.

## Indicadores

| Indicador | Fuente | Vista |
| --- | --- | --- |
| Base Monetaria Amplia | BCRA e INDEC | Serie mensual normalizada contra PBI real |
| Emisión / Absorción de Pesos | BCRA y MECON | Flujo diario y acumulado |
| Depósitos y préstamos | BCRA e INDEC | Stocks, tasas y morosidad |
| Recaudación tributaria | MECON | % de PBI real mensual y MM12 |
| Inflación (IPC) | INDEC, Equilibra e IPC Online | Variación mensual e interanual |
| Trabajo registrado (SIPA) | Secretaría de Trabajo | Asalariados registrados, desestacionalizado |
| Poder adquisitivo | INDEC, RIPTE y ANSES | Índices reales con mes base seleccionable |
| EMAE | INDEC | Agregado, desestacionalizado, tendencia y sectores MM12 |
| Deuda pública | MECON, BCRA e INDEC | Perfil de compromisos y deuda/PBI |
| Gasto público consolidado | MECON (DGSIAF y APNF) | Primario por nivel de gobierno más intereses (% PBI); 2026 acumulado + anualizado |
| Presupuesto nacional | ONP / datos.gob.ar | Recursos y gastos desagregados por rubro (% PBI) |
| Pobreza | INDEC y UTDT | Serie oficial semestral y nowcast mensual (gráfico interactivo UTDT) |
| Índice de Confianza en el Gobierno | UTDT | Serie mensual general y comparación por mandato |
| Balanza comercial | INDEC | ICA agregado (expo, impo, saldo) y desagregado por rubro/uso |
| Inversiones | MECON y prensa | Proyectos RIGI aprobados y en evaluación |
| Rutas nacionales | DNV | Concesión y estado del pavimento por tramo (carga manual) |

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS 4, Recharts, html-to-image |
| Datos | Neon Serverless Postgres |
| Sync | GitHub Actions, scripts Node con `tsx`, `pdf-parse` (UTDT), `tesseract.js` (OCR fallback) |
| Calidad | ESLint, Vitest, typecheck estricto |
| Deploy | Vercel |

## ¿Cómo funciona la publicación de datos?

```mermaid
flowchart TD
    sync["pnpm sync<br/>(GitHub Actions every 6h or local)"] --> chain
    subgraph chain["Source chain (firstUsable)"]
        api[API] -->|fail / empty / stale| page[Web page] -->|fail / empty / stale| csv[CSV] -->|fail / empty / stale| ocr[PDF / OCR]
    end
    chain --> raw[(raw tables)] --> norm[normalizers]
    norm --> normalized[("normalized tables<br/>current year upserted in place,<br/>marked partial until official")]
    chain -->|"publishedAt + period<br/>(from the source itself)"| pubs[("indicator_publications<br/>last publication per indicator")]
    sync --> cal["syncOfficialCalendars<br/>INDEC / BCRA REM / Tesoro calendars"]
    cal -->|"next releases (id, id#2, id#3)"| pubs
    pubs --> next{"upcoming official<br/>date stored?"}
    next -->|yes| official[official date]
    next -->|no| estimate["fixed-days estimate (*)<br/>last publication + rule in specs.ts"]
    normalized --> catalog["catalog builder<br/>latest point + nearest upcoming release<br/>stale = warning, not failure"]
    official --> catalog
    estimate --> catalog
    catalog --> ui[Next.js UI]
```

## Estructura

```text
src/
  app/              Next.js App Router, rutas públicas y API
  components/       Tabla principal, gráficos y vistas de indicadores
  lib/catalog/      Construcción del catálogo visible
  lib/db/           Acceso a Neon y mapeo de filas
  lib/emae/         Schema único del dominio EMAE
  lib/normalize/    Normalizadores por indicador
  lib/sync/         Jobs de sincronización y clientes externos
  types/            Contratos TypeScript compartidos
```

## Desarrollo

Requisitos:

- Node.js 22
- pnpm 10
- Base Neon compatible con `schema.sql`

Instalación:

```bash
pnpm install
cp .env.example .env
```

Variables principales:

| Variable | Uso |
| --- | --- |
| `NEON_URL` | Conexión Postgres serverless |
| `ADMIN_PASSWORD` | Acceso al panel admin (mínimo 16 caracteres) |
| `AUTH_SECRET` | Clave HMAC de la sesión admin, ≥ 32 caracteres (`openssl rand -hex 32`) |

Comandos:

```bash
pnpm dev       # servidor local
pnpm build     # build + typecheck
pnpm lint      # eslint
pnpm test:run  # tests unitarios
pnpm sync      # sincroniza fuentes oficiales
```

## Principios

- Una fuente de verdad por dominio.
- Normalizadores pequeños y auditables.
- Tipos derivados de estructuras reales, no strings duplicados.
- Documentación mínima: si algo cambia, debe cambiar el código.
- Deploy reproducible con `pnpm run build`.

## Pendientes

- Agregar gráfico de deuda.
- Agregar gráfico de reservas netas.

## Deploy

El proyecto está preparado para Vercel. La sincronización automática corre con GitHub Actions cada 6 horas y requiere `NEON_URL` configurado como secret del repositorio.

Antes de publicar:

```bash
pnpm run build
```
