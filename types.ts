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
    archived?: boolean;
    /**
     * Randevu saatinden ne kadar önce hatırlatma gönderileceği.
     * 'none' veya undefined ise randevu saatinde hatırlatılır.
     */
    reminderBefore?: 'none' | '15m' | '1h' | '1d';
    /**
     * Harici takvim etkinliği ile eşleştirmek için kullanılan ID (Google/Outlook).
     */
    externalCalendarId?: string;
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
    color: string; // Hex color
    title: string;
    blocks: Block[];
    reminderDate?: string | null; // YYYY-MM-DD
    reminderTime?: string | null; // HH:mm
    pinned?: boolean;
    archived?: boolean;
}

export interface TelegramConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
    webhookEnabled?: boolean;
    dailySummaryEnabled?: boolean;
    dailySummaryTime?: string; // HH:mm
    weeklySummaryEnabled?: boolean;
    weeklySummaryDay?: number; // 0-6 (Pazar=0)
    weeklySummaryTime?: string; // HH:mm
    autoBackupEnabled?: boolean;
    autoBackupTime?: string; // HH:mm
    autoBackupTarget?: 'telegram' | 'local';
    autoBackupFrequency?: 'daily' | 'weekly';
}

export interface UserProfile {
    uid: string;
    email: string | null;
    isDemo?: boolean;
}

export interface CustomerProfile {
    id: string; // normalized key
    name: string;
    note?: string;
    phone?: string;
    telegramChatId?: string;
    createdAt?: string;
    updatedAt?: string;
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

export type ViewMode = 'calendar' | 'kanban' | 'dashboard' | 'customers';
export type ThemeMode = 'light' | 'dark';
export type Language = 'tr' | 'en';