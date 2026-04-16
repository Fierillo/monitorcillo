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
    data JSONB,
    last_update TIMESTAMP DEFAULT NOW()
);

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
    data JSONB,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BMA (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS bma_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    base DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bma_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    data JSONB,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- RECAUDACION (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS recaudacion_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    mes VARCHAR(2),
    year INTEGER,
    pct_pbi DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recaudacion_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    data JSONB,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PODER ADQUISITIVO (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS poder_adquisitivo_raw (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    blanco DECIMAL,
    negro DECIMAL,
    privado DECIMAL,
    publico DECIMAL,
    ripte DECIMAL,
    jubilacion DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poder_adquisitivo_normalized (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(20) UNIQUE NOT NULL,
    data JSONB,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_indicators_catalog_id ON indicators_catalog(id);
CREATE INDEX IF NOT EXISTS idx_emision_fecha ON emision_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_emae_fecha ON emae_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_bma_fecha ON bma_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_recaudacion_fecha ON recaudacion_raw(fecha);
CREATE INDEX IF NOT EXISTS idx_poder_fecha ON poder_adquisitivo_raw(fecha);