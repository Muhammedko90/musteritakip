export const formatDateKey = (date: Date): string => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset();
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString().split('T')[0];
};

export const getDaysInMonth = (date: Date): number => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

export const getFirstDayOfMonth = (date: Date): number => {
    let day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; 
};

export const isSameDay = (d1: Date, d2: Date): boolean => d1.toDateString() === d2.toDateString();

export const getCustomerColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const palettes = [
        'border-l-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100', 
        'border-l-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100', 
        'border-l-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100', 
        'border-l-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-900/30 dark:text-violet-100', 
        'border-l-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
    ];
    return palettes[Math.abs(hash) % palettes.length];
};

export const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

export const getEndOfWeek = (date: Date): Date => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
};