export function addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function dateRange(first: string, last: string): string[] {
    const dates: string[] = [];
    for (let date = first; date <= last; date = addDays(date, 1)) {
        dates.push(date);
    }
    return dates;
}