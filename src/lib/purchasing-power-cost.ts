import type { ChartDataRow, PoderAdquisitivoRawRow } from '@/types';

export const CABA_RENT_SERIES = [
    { date: '2020-06-01', value: 22758 },
    { date: '2021-06-01', value: 39211 },
    { date: '2022-06-01', value: 64581 },
    { date: '2023-06-01', value: 158328 },
    { date: '2024-06-01', value: 449915 },
    { date: '2025-06-01', value: 655294 },
    { date: '2026-06-01', value: 860106 },
] as const;

type RentObservation = { date: string; value: number };

export function calculateRentSalaryBurden(
    salaryData: PoderAdquisitivoRawRow[],
    rentData: readonly RentObservation[] = CABA_RENT_SERIES,
): ChartDataRow[] {
    const salaries = [...salaryData].sort((first, second) => first.fecha.localeCompare(second.fecha));
    const currentSalary = salaries.findLast(hasBothSalaries);
    if (!currentSalary) return [];

    const currentRegistered = Number(currentSalary.salario_registrado);
    const currentInformal = Number(currentSalary.salario_no_registrado);

    return rentData.flatMap(observation => {
        const matchingSalary = salaries.find(row => row.fecha === observation.date);
        const salary = matchingSalary && hasBothSalaries(matchingSalary)
            ? matchingSalary
            : observation.date > currentSalary.fecha ? currentSalary : null;
        if (!salary || !hasBothSalaries(salary)) return [];

        return [{
            fecha: observation.date.slice(0, 4),
            iso_fecha: observation.date,
            alquiler_registrado: observation.value * currentRegistered / Number(salary.salario_registrado),
            alquiler_informal: observation.value * currentInformal / Number(salary.salario_no_registrado),
            alquiler_observado: observation.value,
            salario_fecha: salary.fecha,
        }];
    });
}

function hasBothSalaries(row: PoderAdquisitivoRawRow): boolean {
    return toPositiveNumber(row.salario_registrado) !== null && toPositiveNumber(row.salario_no_registrado) !== null;
}

function toPositiveNumber(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}
