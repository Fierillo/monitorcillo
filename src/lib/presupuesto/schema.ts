export const PRESUPUESTO_RESOURCE_SERIES = [
    { key: 'tributarios', label: 'Tributarios', color: '#22C55E' },
    { key: 'aportes_ss', label: 'Aportes y contribuciones SS', color: '#84CC16' },
    { key: 'otros_ingresos', label: 'Otros ingresos corrientes', color: '#A3E635' },
    { key: 'recursos_capital', label: 'Recursos de capital', color: '#FACC15' },
] as const;

export const PRESUPUESTO_EXPENSE_SERIES = [
    { key: 'prestaciones_ss', label: 'Prestaciones de la SS', color: '#EF4444' },
    { key: 'consumo_operacion', label: 'Consumo y operación', color: '#F97316' },
    { key: 'transferencias', label: 'Transferencias corrientes', color: '#FB7185' },
    { key: 'intereses', label: 'Intereses', color: '#A855F7' },
    { key: 'gastos_capital', label: 'Gastos de capital', color: '#64748B' },
] as const;

export type PresupuestoResourceKey = typeof PRESUPUESTO_RESOURCE_SERIES[number]['key'];
export type PresupuestoExpenseKey = typeof PRESUPUESTO_EXPENSE_SERIES[number]['key'];
export type PresupuestoRubroKey = PresupuestoResourceKey | PresupuestoExpenseKey;

export const PRESUPUESTO_RESOURCE_KEYS = PRESUPUESTO_RESOURCE_SERIES.map(item => item.key) as PresupuestoResourceKey[];
export const PRESUPUESTO_EXPENSE_KEYS = PRESUPUESTO_EXPENSE_SERIES.map(item => item.key) as PresupuestoExpenseKey[];
export const PRESUPUESTO_RUBRO_KEYS = [...PRESUPUESTO_RESOURCE_KEYS, ...PRESUPUESTO_EXPENSE_KEYS] as PresupuestoRubroKey[];

export function toNegativeExpense(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? -Math.abs(numeric) : null;
}

export function withNegativeExpenses<T extends Record<string, unknown>>(row: T): T {
    return {
        ...row,
        ...Object.fromEntries(PRESUPUESTO_EXPENSE_KEYS.map(key => [key, toNegativeExpense(row[key])])),
    };
}
