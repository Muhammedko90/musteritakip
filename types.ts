export interface Note {
    id: number;
    customer: string;
    content: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    completed: boolean;
    completedAt?: string | null;
    createdAt?: string;
    customValues?: Record<string, string>; // Field ID -> Value
    recurrenceId?: number; // Group ID for recurring events
}

export interface CustomFieldDef {
    id: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[]; // For select type
}

export interface Block {
    id: number;
    type: 'text' | 'todo';
    content: string;
    done: boolean;
}

export interface StickyNote {
    id: number;
    color: string;
    title: string;
    blocks: Block[];
}

export interface TelegramConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
}

export interface UserProfile {
    uid: string;
    email: string | null;
    isDemo?: boolean;
}

export interface ThemeColor {
    name: string;
    primary: string;
    hover: string;
    text: string;
    ring: string;
    light: string;
    border: string;
    gradient: string;
    shadow: string;
    darkBg: string;
    darkCard: string;
}

export type ViewMode = 'calendar' | 'kanban' | 'dashboard';
export type ThemeMode = 'light' | 'dark';