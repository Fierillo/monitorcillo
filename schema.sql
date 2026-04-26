-- ============================================
-- MONITORCILLO - NEON SCHEMA
-- ============================================

-- ============================================
-- CATALOG (indicadores)
-- ============================================
CREATE TABLE IF NOT EXISTS indicators_catalog (
    id VARCHAR(50) PRIMARY KEY,
    indicador VARCHAR(255),
    referencia TEXT,
    dato VARCHAR(50),
    fecha VARCHAR(20),
    fuente VARCHAR(100),
    trend VARCHAR(20),
    category VARCHAR(50),
    has_details BOOLEAN DEFAULT false,
    source_url TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- EMISION (diaria)
-- ============================================
CREATE TABLE IF NOT EXISTS emision_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    compra_dolares DECIMAL,
    tc DECIMAL,
    bcra DECIMAL,
    vencimientos DECIMAL DEFAULT 0,
    licitado DECIMAL DEFAULT 0,
    licitaciones DECIMAL DEFAULT 0,
    resultado_fiscal DECIMAL DEFAULT 0,
    total DECIMAL,
    acumulado DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emision_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    bcra DECIMAL,
    tc DECIMAL,
    compra_dolares DECIMAL,
    vencimientos DECIMAL,
    licitado DECIMAL,
    licitaciones DECIMAL,
    resultado_fiscal DECIMAL,
    total DECIMAL,
    acumulado DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS bcra DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS tc DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS compra_dolares DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS vencimientos DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS licitado DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS licitaciones DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS resultado_fiscal DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS total DECIMAL;
ALTER TABLE emision_normalized ADD COLUMN IF NOT EXISTS acumulado DECIMAL;
ALTER TABLE emision_normalized DROP COLUMN IF EXISTS data;

-- ============================================
-- EMAE (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS emae_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    emae DECIMAL,
    emae_desestacionalizado DECIMAL,
    emae_tendencia DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emae_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    emae DECIMAL,
    emae_desestacionalizado DECIMAL,
    emae_tendencia DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS emae DECIMAL;
ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS emae_desestacionalizado DECIMAL;
ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS emae_tendencia DECIMAL;
ALTER TABLE emae_normalized DROP COLUMN IF EXISTS data;

-- ============================================
-- BMA (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS bma_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    base_monetaria DECIMAL,
    pases DECIMAL,
    leliq DECIMAL,
    lefi DECIMAL,
    otros DECIMAL,
    depositos_tesoro DECIMAL,
    pbi_trimestral DECIMAL,
    emae_desestacionalizado DECIMAL,
    ipc_nucleo DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bma_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    base_monetaria DECIMAL,
    pasivos_remunerados DECIMAL,
    depositos_tesoro DECIMAL,
    bma_amplia DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

ALTER TABLE bma_normalized ADD COLUMN IF NOT EXISTS base_monetaria DECIMAL;
ALTER TABLE bma_normalized ADD COLUMN IF NOT EXISTS pasivos_remunerados DECIMAL;
ALTER TABLE bma_normalized ADD COLUMN IF NOT EXISTS depositos_tesoro DECIMAL;
ALTER TABLE bma_normalized ADD COLUMN IF NOT EXISTS bma_amplia DECIMAL;
ALTER TABLE bma_normalized DROP COLUMN IF EXISTS data;

ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS base_monetaria DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS pases DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS leliq DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS lefi DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS otros DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS depositos_tesoro DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS pbi_trimestral DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS emae_desestacionalizado DECIMAL;
ALTER TABLE bma_raw ADD COLUMN IF NOT EXISTS ipc_nucleo DECIMAL;
ALTER TABLE bma_raw DROP COLUMN IF EXISTS base;
ALTER TABLE bma_raw DROP COLUMN IF EXISTS tesoro;

-- ============================================
-- RECAUDACION (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS recaudacion_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    mes VARCHAR(2),
    year INTEGER,
    recaudacion_total DECIMAL,
    pbi_trimestral DECIMAL,
    emae_desestacionalizado DECIMAL,
    ipc_nucleo DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recaudacion_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    mes VARCHAR(2),
    year INTEGER,
    pct_pbi DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

ALTER TABLE recaudacion_normalized ADD COLUMN IF NOT EXISTS mes VARCHAR(2);
ALTER TABLE recaudacion_normalized ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE recaudacion_normalized ADD COLUMN IF NOT EXISTS pct_pbi DECIMAL;
ALTER TABLE recaudacion_normalized DROP COLUMN IF EXISTS data;

ALTER TABLE recaudacion_raw ADD COLUMN IF NOT EXISTS recaudacion_total DECIMAL;
ALTER TABLE recaudacion_raw ADD COLUMN IF NOT EXISTS pbi_trimestral DECIMAL;
ALTER TABLE recaudacion_raw ADD COLUMN IF NOT EXISTS emae_desestacionalizado DECIMAL;
ALTER TABLE recaudacion_raw ADD COLUMN IF NOT EXISTS ipc_nucleo DECIMAL;

-- ============================================
-- PODER ADQUISITIVO (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS poder_adquisitivo_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    ipc_nucleo DECIMAL,
    salario_registrado DECIMAL,
    salario_no_registrado DECIMAL,
    salario_privado DECIMAL,
    salario_publico DECIMAL,
    ripte DECIMAL,
    jubilacion_minima DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poder_adquisitivo_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    blanco DECIMAL,
    negro DECIMAL,
    privado DECIMAL,
    publico DECIMAL,
    ripte DECIMAL,
    jubilacion DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

ALTER TABLE poder_adquisitivo_normalized ADD COLUMN IF NOT EXISTS blanco DECIMAL;
ALTER TABLE poder_adquisitivo_normalized ADD COLUMN IF NOT EXISTS negro DECIMAL;
ALTER TABLE poder_adquisitivo_normalized ADD COLUMN IF NOT EXISTS privado DECIMAL;
ALTER TABLE poder_adquisitivo_normalized ADD COLUMN IF NOT EXISTS publico DECIMAL;
ALTER TABLE poder_adquisitivo_normalized ADD COLUMN IF NOT EXISTS ripte DECIMAL;
ALTER TABLE poder_adquisitivo_normalized ADD COLUMN IF NOT EXISTS jubilacion DECIMAL;
ALTER TABLE poder_adquisitivo_normalized DROP COLUMN IF EXISTS data;

ALTER TABLE poder_adquisitivo_raw ADD COLUMN IF NOT EXISTS ipc_nucleo DECIMAL;
ALTER TABLE poder_adquisitivo_raw ADD COLUMN IF NOT EXISTS salario_registrado DECIMAL;
ALTER TABLE poder_adquisitivo_raw ADD COLUMN IF NOT EXISTS salario_no_registrado DECIMAL;
ALTER TABLE poder_adquisitivo_raw ADD COLUMN IF NOT EXISTS salario_privado DECIMAL;
ALTER TABLE poder_adquisitivo_raw ADD COLUMN IF NOT EXISTS salario_publico DECIMAL;
ALTER TABLE poder_adquisitivo_raw ADD COLUMN IF NOT EXISTS jubilacion_minima DECIMAL;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_indicators_catalog_id ON indicators_catalog(id);
CREATE INDEX IF NOT EXISTS idx_emision_fecha ON emision_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_emae_fecha ON emae_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_bma_fecha ON bma_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_recaudacion_fecha ON recaudacion_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_poder_fecha ON poder_adquisitivo_raw(fecha);

-- ============================================
-- MANUAL OVERRIDES (datos manuales que prevalecen sobre API)
-- ============================================
CREATE TABLE IF NOT EXISTS manual_overrides (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,  -- 'otros' o 'tesoro'
    month VARCHAR(7) NOT NULL,       -- formato 'YYYY-MM'
    value DECIMAL NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category, month)
);

CREATE INDEX IF NOT EXISTS idx_manual_overrides_month ON manual_overrides(month);
