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
    fecha DATE UNIQUE NOT NULL,
    compra_dolares DECIMAL,
    tc DECIMAL,
    bcra DECIMAL,
    vencimientos DECIMAL DEFAULT 0,
    licitado DECIMAL DEFAULT 0,
    resultado_fiscal DECIMAL DEFAULT 0,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emision_normalized (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
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

-- ============================================
-- EMAE (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS emae_raw (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
    emae DECIMAL,
    emae_desestacionalizado DECIMAL,
    emae_tendencia DECIMAL,
    fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emae_normalized (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
    emae DECIMAL,
    emae_desestacionalizado DECIMAL,
    emae_tendencia DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BMA (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS bma_raw (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
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
    fecha DATE UNIQUE NOT NULL,
    base_monetaria DECIMAL,
    pasivos_remunerados DECIMAL,
    depositos_tesoro DECIMAL,
    bma_amplia DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- RECAUDACION (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS recaudacion_raw (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
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
    fecha DATE UNIQUE NOT NULL,
    mes VARCHAR(2),
    year INTEGER,
    pct_pbi DECIMAL,
    last_update TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PODER ADQUISITIVO (mensual)
-- ============================================
CREATE TABLE IF NOT EXISTS poder_adquisitivo_raw (
    id SERIAL PRIMARY KEY,
    fecha DATE UNIQUE NOT NULL,
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
    fecha DATE UNIQUE NOT NULL,
    blanco DECIMAL,
    negro DECIMAL,
    privado DECIMAL,
    publico DECIMAL,
    ripte DECIMAL,
    jubilacion DECIMAL,
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

-- ============================================
-- RATE LIMITS (durable API throttling)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_time TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time ON rate_limits(reset_time);
