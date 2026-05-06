export function parseSalaryPublicationDate(html: string): string | null {
    const match = html.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\.\s*Índice de salarios/i);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const parsedYear = Number(match[3]);
    if (!day || !month || Number.isNaN(parsedYear)) return null;

    const year = match[3].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
