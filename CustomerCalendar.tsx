import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { 
    Calendar, StickyNote, Settings, LayoutDashboard, CalendarDays, Columns, 
    WifiOff, Info, User, Search, Plus
} from 'lucide-react';

import { db, auth } from './config/firebase';
import { Note, StickyNote as StickyNoteType, TelegramConfig, UserProfile, ThemeMode, CustomFieldDef, Language, CustomerProfile } from './types';
import { THEME_COLORS, NOTE_COLORS } from './constants';
import { formatDateKey, getStartOfWeek, getEndOfWeek } from './utils/helpers';
import { sendTelegramMessage, sendTelegramDocument, answerCallbackQuery } from './services/telegramService';

// Views
import CalendarView from './views/CalendarView';
import KanbanView from './views/KanbanView';
import DashboardView from './views/DashboardView';
import CustomersView from './views/CustomersView';

// Modals
import StickyNotesModal from './components/modals/StickyNotesModal';
import SettingsModal from './components/modals/SettingsModal';
import DayDetailModal from './components/modals/DayDetailModal';
import EditNoteModal, { EditScope } from './components/modals/EditNoteModal';
import ConfirmationModal from './components/modals/ConfirmationModal';
import NotificationModal from './components/modals/NotificationModal';
import CommandPalette from './components/CommandPalette';
import QuickAddModal from './components/modals/QuickAddModal';
import UndoToast from './components/UndoToast';
import CustomerCard from './components/CustomerCard';

interface Props {
    user: UserProfile;
}

const CustomerCalendar: React.FC<Props> = ({ user }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [stickyNotes, setStickyNotes] = useState<StickyNoteType[]>([]);
    const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [cloudError, setCloudError] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'dashboard' | 'customers'>('calendar');
    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [language, setLanguage] = useState<Language>('tr');
    const [customerProfiles, setCustomerProfiles] = useState<Record<string, CustomerProfile>>({});
    const [accentColor, setAccentColor] = useState('purple'); 
    
    // Telegram State
    const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({ botToken: '', chatId: '', enabled: false });
    const [sentReminders, setSentReminders] = useState<Set<number>>(new Set());
    const [sentStickyReminders, setSentStickyReminders] = useState<Set<number>>(new Set());
    const lastUpdateIdRef = useRef(0);
    const botConversations = useRef<any>({});
    const lastDailySummaryRef = useRef<string | null>(null);
    const lastWeeklySummaryRef = useRef<string | null>(null);
    const lastBackupRef = useRef<string | null>(null);

    // Modals
    const [isDayDetailModalOpen, setIsDayDetailModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isStickyModalOpen, setIsStickyModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [quickAddDate, setQuickAddDate] = useState<Date>(new Date());
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    // Confirmation & Notification State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean,
        title: string,
        message: string,
        onConfirm: () => void,
        confirmText?: string,
        cancelText?: string,
        type?: 'danger' | 'warning' | 'info'
    }>({
        isOpen: false, title: '', message: '', onConfirm: () => {}, confirmText: undefined, cancelText: undefined, type: undefined
    });
    const [notificationModal, setNotificationModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'info' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });
    const [undoToast, setUndoToast] = useState<{
        isOpen: boolean;
        message: string;
        onUndo: (() => Promise<void>) | null;
    }>({ isOpen: false, message: '', onUndo: null });
    const undoTimerRef = useRef<number | null>(null);

    const notesRef = useRef(stickyNotes);
    const [customerCardName, setCustomerCardName] = useState<string | null>(null);
    const [firestoreRetryTrigger, setFirestoreRetryTrigger] = useState(0);
    const firestoreRetryDoneRef = useRef(false);
    const activeTheme = THEME_COLORS[accentColor] || THEME_COLORS.blue;

    const normalizeCustomerKey = (name: string): string =>
        name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '-');

    const buildReminderMessage = (note: Note): string => {
        const template =
            "🔔 <b>RANDEVU HATIRLATMA</b>\n👤 {{customer}}\n📅 {{date}} {{time}}\n📝 {{content}}";
        return template
            .replace("{{customer}}", note.customer || "")
            .replace("{{date}}", note.date || "")
            .replace("{{time}}", note.time || "")
            .replace("{{content}}", note.content || "");
    };

    const runScheduledBackup = async () => {
        const data = {
            notes,
            stickyNotes,
            telegramConfig,
            customFields,
            exportDate: new Date().toISOString(),
            userEmail: user.email,
        };
        const fileName = `yedek_${formatDateKey(new Date())}.json`;

        const target = telegramConfig.autoBackupTarget || 'telegram';

        if (target === 'telegram') {
            const caption = `📦 <b>Otomatik Sistem Yedeği</b>\n📅 Tarih: ${new Date().toLocaleString(
                'tr-TR'
            )}\n👤 Kullanıcı: ${user.email}`;
            await sendTelegramDocument(
                telegramConfig,
                JSON.stringify(data, null, 2),
                fileName,
                caption
            );
        } else {
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const texts = useMemo(() => {
        const base = {
            appTitle: language === 'en' ? 'Customer Tracker' : 'Müşteri Takip',
            navCalendar: language === 'en' ? 'Calendar' : 'Takvim',
            navKanban: language === 'en' ? 'Boards' : 'Panolar',
            navDashboard: language === 'en' ? 'Statistics' : 'İstatistik',
            navCustomers: language === 'en' ? 'Customers' : 'Müşteriler',
            navQuickAdd: language === 'en' ? 'Quick Add' : 'Hızlı Ekle',
            navSearch: language === 'en' ? 'Search' : 'Ara',
            navNotes: language === 'en' ? 'Notes' : 'Notlarım',
        };
        return base;
    }, [language]);

    // Firestore does not accept undefined; strip optional fields that are undefined
    const stripUndefined = <T extends Record<string, unknown>>(obj: T): T => {
        const out = {} as T;
        for (const k of Object.keys(obj)) {
            const v = (obj as Record<string, unknown>)[k];
            if (v !== undefined) (out as Record<string, unknown>)[k] = v;
        }
        return out;
    };

    // --- DB Helpers ---
    const saveNoteToDb = async (noteData: Note) => {
        if (user.isDemo) {
            setNotes(prev => [...prev, noteData]);
            return;
        }
        try {
            await setDoc(doc(db, "users", user.uid, "notes", String(noteData.id)), stripUndefined(noteData as Record<string, unknown>) as Note);
        } catch (e: any) {
            console.error("Firestore Error", e);
            setCloudError(true);
            if (e?.code === 'permission-denied') {
                console.debug('[Firestore] permission-denied on write. auth.currentUser:', auth.currentUser ? { uid: auth.currentUser.uid } : null, 'path uid:', user.uid);
                setNotificationModal({
                    isOpen: true,
                    title: 'İzin hatası',
                    message: 'Randevu kaydedilemedi. Lütfen çıkış yapıp tekrar giriş yapın. Hata sürerse Firebase Console\'da Firestore kurallarını deploy edin: firebase deploy --only firestore:rules',
                    type: 'error'
                });
            }
        }
    };

    const updateNoteInDb = async (id: number, data: Partial<Note>) => {
        if (user.isDemo) {
            setNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, ...data } : n));
            return;
        }
        try {
            await updateDoc(doc(db, "users", user.uid, "notes", String(id)), stripUndefined(data as Record<string, unknown>));
        } catch (e) { console.error("Update Error", e); }
    };

    const deleteNoteFromDb = async (id: number) => {
        if (user.isDemo) {
            setNotes(prev => prev.filter(n => String(n.id) !== String(id)));
            return;
        }
        try {
            await deleteDoc(doc(db, "users", user.uid, "notes", String(id)));
        } catch (e) { console.error("Delete Error", e); }
    };

    // --- Sticky Notes DB Helpers ---
    const addStickyNoteToDb = async (note: StickyNoteType) => {
        if (user.isDemo) {
            setStickyNotes(prev => [note, ...prev]);
            return;
        }
        try {
            await setDoc(doc(db, "users", user.uid, "sticky_notes", String(note.id)), stripUndefined(note as Record<string, unknown>) as StickyNoteType);
        } catch (e) { console.error("Sticky Add Error", e); }
    };

    const updateStickyNoteInDb = async (id: number, data: Partial<StickyNoteType>) => {
        if (user.isDemo) {
            setStickyNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, ...data } : n));
            return;
        }
        try {
            await updateDoc(doc(db, "users", user.uid, "sticky_notes", String(id)), stripUndefined(data as Record<string, unknown>));
        } catch (e) { console.error("Sticky Update Error", e); }
    };

    const deleteStickyNoteFromDb = async (id: number) => {
        if (user.isDemo) {
            setStickyNotes(prev => prev.filter(n => String(n.id) !== String(id)));
            return;
        }
        try {
            await deleteDoc(doc(db, "users", user.uid, "sticky_notes", String(id)));
        } catch (e) { console.error("Sticky Delete Error", e); }
    };

    const saveSettingsToDb = async (
        newConfig: Partial<TelegramConfig & { themeMode: ThemeMode; accentColor: string; language: Language }>
    ) => {
        const updatedConfig = { ...telegramConfig, ...newConfig };

        // Handle Telegram state updates (all TelegramConfig-related fields)
        const telegramPatch: Partial<TelegramConfig> = {};
        if ('botToken' in newConfig) telegramPatch.botToken = newConfig.botToken ?? telegramConfig.botToken;
        if ('chatId' in newConfig) telegramPatch.chatId = newConfig.chatId ?? telegramConfig.chatId;
        if ('enabled' in newConfig) telegramPatch.enabled = newConfig.enabled ?? telegramConfig.enabled;
        if ('webhookEnabled' in newConfig) telegramPatch.webhookEnabled = newConfig.webhookEnabled ?? telegramConfig.webhookEnabled;
        if ('dailySummaryEnabled' in newConfig) telegramPatch.dailySummaryEnabled = newConfig.dailySummaryEnabled;
        if ('dailySummaryTime' in newConfig) telegramPatch.dailySummaryTime = newConfig.dailySummaryTime;
        if ('weeklySummaryEnabled' in newConfig) telegramPatch.weeklySummaryEnabled = newConfig.weeklySummaryEnabled;
        if ('weeklySummaryDay' in newConfig) telegramPatch.weeklySummaryDay = newConfig.weeklySummaryDay;
        if ('weeklySummaryTime' in newConfig) telegramPatch.weeklySummaryTime = newConfig.weeklySummaryTime;
        if ('autoBackupEnabled' in newConfig) telegramPatch.autoBackupEnabled = newConfig.autoBackupEnabled;
        if ('autoBackupTime' in newConfig) telegramPatch.autoBackupTime = newConfig.autoBackupTime;
        if ('autoBackupTarget' in newConfig) telegramPatch.autoBackupTarget = newConfig.autoBackupTarget;
        if ('autoBackupFrequency' in newConfig) telegramPatch.autoBackupFrequency = newConfig.autoBackupFrequency;

        if (Object.keys(telegramPatch).length > 0) {
            setTelegramConfig(prev => ({ ...prev, ...telegramPatch }));
        }

        // Handle Theme state updates
        if ('themeMode' in newConfig && newConfig.themeMode) {
            setThemeMode(newConfig.themeMode);
            localStorage.setItem('appThemeMode', newConfig.themeMode);
            document.documentElement.classList.toggle('dark', newConfig.themeMode === 'dark');
        }
        if ('accentColor' in newConfig && newConfig.accentColor) {
            setAccentColor(newConfig.accentColor);
            localStorage.setItem('appAccentColor', newConfig.accentColor);
        }
        if ('language' in newConfig && newConfig.language) {
            setLanguage(newConfig.language);
            localStorage.setItem('appLanguage', newConfig.language);
        }

        if (user.isDemo) {
            localStorage.setItem('telegramConfig', JSON.stringify(updatedConfig));
        } else {
            try {
                const toWrite = Object.fromEntries(
                    Object.entries(updatedConfig).filter(([, v]) => v !== undefined)
                ) as Record<string, unknown>;
                await setDoc(doc(db, "users", user.uid, "settings", "config"), toWrite, { merge: true });
            } catch(e) { console.error("Settings Error", e); }
        }
    };

    const saveCustomFieldsToDb = async (fields: CustomFieldDef[]) => {
        setCustomFields(fields);
        if(user.isDemo) {
            localStorage.setItem('customFields', JSON.stringify(fields));
        } else {
            try {
                await setDoc(doc(db, "users", user.uid, "settings", "customFields"), { fields });
            } catch(e) { console.error("Custom Fields Error", e); }
        }
    }

    // --- INIT ---
    useEffect(() => {
        const savedThemeMode = (localStorage.getItem('appThemeMode') as ThemeMode | null) || null;
        const savedAccent = localStorage.getItem('appAccentColor') || null;
        const savedLanguage = (localStorage.getItem('appLanguage') as Language | null) || null;
        const savedTelegram = localStorage.getItem('telegramConfig');
        const savedCustomFields = localStorage.getItem('customFields');
        const savedProfilesRaw = localStorage.getItem(`customerProfiles_${user.uid}`);

        const initialTheme: ThemeMode = savedThemeMode || 'dark';
        const initialAccent = savedAccent || 'purple';
        const initialLanguage: Language = savedLanguage || 'tr';

        setThemeMode(initialTheme);
        setAccentColor(initialAccent);
        setLanguage(initialLanguage);
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');
        
        if (user.isDemo) {
            const savedSticky = localStorage.getItem('stickyNotes');
            if (savedSticky) {
                try {
                    const parsed = JSON.parse(savedSticky);
                    if (Array.isArray(parsed)) setStickyNotes(parsed);
                } catch(e) { /* ignore */ }
            }
            if (savedTelegram) setTelegramConfig(JSON.parse(savedTelegram));
            if (savedCustomFields) setCustomFields(JSON.parse(savedCustomFields));
            const savedNotes = localStorage.getItem(`customerNotes_${user.uid}`);
            if (savedNotes) setNotes(JSON.parse(savedNotes));
            if (savedProfilesRaw) {
                try {
                    const parsed = JSON.parse(savedProfilesRaw);
                    if (parsed && typeof parsed === 'object') {
                        setCustomerProfiles(parsed);
                    }
                } catch (e) {
                    /* ignore */
                }
            }
            setIsLoaded(true);
            return;
        }

        if (user && !user.isDemo) {
            const uid = user.uid;
            firestoreRetryDoneRef.current = false;
            const setPermissionError = () => setCloudError(true);
            const clearPermissionError = () => setCloudError(false);

            let cancelled = false;
            let teardown: (() => void) | undefined;
            const setupListeners = () => {
                if (cancelled) return;
                const qNotes = query(collection(db, "users", uid, "notes"));
            const unsubscribeNotes = onSnapshot(qNotes, (querySnapshot) => {
                const notesData: Note[] = [];
                querySnapshot.forEach((doc) => {
                    notesData.push({ ...doc.data() as Note, id: parseInt(doc.id) || parseInt(doc.data().id) || Number(doc.id) });
                });
                setNotes(notesData);
                clearPermissionError();
            }, (error: any) => {
                if (error?.code === 'permission-denied') {
                    setPermissionError();
                    console.debug('[Firestore] permission-denied. auth.currentUser:', auth.currentUser ? { uid: auth.currentUser.uid } : null, 'path uid:', uid);
                    if (!firestoreRetryDoneRef.current && auth.currentUser?.uid === uid) {
                        firestoreRetryDoneRef.current = true;
                        auth.currentUser.getIdToken(true).then(() => {
                            setTimeout(() => setFirestoreRetryTrigger(t => t + 1), 2500);
                        }).catch(() => {});
                    }
                }
            });

            const qSticky = query(collection(db, "users", uid, "sticky_notes"));
            const unsubscribeSticky = onSnapshot(qSticky, (querySnapshot) => {
                const stickyData: StickyNoteType[] = [];
                querySnapshot.forEach((doc) => {
                    stickyData.push({ ...doc.data() as StickyNoteType, id: parseInt(doc.id) || parseInt(doc.data().id) || Number(doc.id) });
                });
                setStickyNotes(stickyData.sort((a,b) => b.id - a.id));
                clearPermissionError();
            }, (err: any) => { if (err?.code === 'permission-denied') setPermissionError(); });

            getDoc(doc(db, "users", uid, "settings", "config")).then(snap => {
                if(snap.exists()) {
                    const data = snap.data();
                    setTelegramConfig({
                        botToken: data.botToken || '',
                        chatId: data.chatId || '',
                        enabled: data.enabled || false,
                        webhookEnabled: data.webhookEnabled || false,
                        dailySummaryEnabled: data.dailySummaryEnabled ?? false,
                        dailySummaryTime: data.dailySummaryTime,
                        weeklySummaryEnabled: data.weeklySummaryEnabled ?? false,
                        weeklySummaryDay: typeof data.weeklySummaryDay === 'number' ? data.weeklySummaryDay : 0,
                        weeklySummaryTime: data.weeklySummaryTime,
                        autoBackupEnabled: data.autoBackupEnabled ?? false,
                        autoBackupTime: data.autoBackupTime,
                        autoBackupTarget: data.autoBackupTarget,
                        autoBackupFrequency: data.autoBackupFrequency,
                    });
                    if(data.themeMode) {
                        setThemeMode(data.themeMode);
                        document.documentElement.classList.toggle('dark', data.themeMode === 'dark');
                    }
                    if(data.accentColor) setAccentColor(data.accentColor);
                    if (data.language) {
                        setLanguage(data.language as Language);
                        localStorage.setItem('appLanguage', data.language as Language);
                    }
                }
                clearPermissionError();
            }).catch((err: any) => { if (err?.code === 'permission-denied') setPermissionError(); });

            getDoc(doc(db, "users", uid, "settings", "customFields")).then(snap => {
                if(snap.exists() && snap.data().fields) setCustomFields(snap.data().fields);
                clearPermissionError();
            }).catch((err: any) => { if (err?.code === 'permission-denied') setPermissionError(); });

            const qCustomers = query(collection(db, "users", uid, "customers"));
            const unsubscribeCustomers = onSnapshot(qCustomers, snapshot => {
                const map: Record<string, CustomerProfile> = {};
                snapshot.forEach(docSnap => {
                    const data = docSnap.data() as CustomerProfile;
                    const id = data.id || docSnap.id;
                    map[id] = { ...data, id };
                });
                setCustomerProfiles(map);
                clearPermissionError();
            }, (err: any) => { if (err?.code === 'permission-denied') setPermissionError(); });

            setIsLoaded(true);
            return () => {
                unsubscribeNotes();
                unsubscribeSticky();
                unsubscribeCustomers();
            };
            };

            (async () => {
                if (auth.currentUser?.uid !== uid) {
                    setIsLoaded(true);
                    return;
                }
                try {
                    await auth.currentUser.getIdToken(true);
                } catch (_) { /* ignore */ }
                if (cancelled) return;
                teardown = setupListeners();
            })();

            return () => {
                cancelled = true;
                teardown?.();
            };
        }
    }, [user, firestoreRetryTrigger]);

    useEffect(() => {
        if (isLoaded) {
            if (user.isDemo) {
                localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
                localStorage.setItem(`customerNotes_${user.uid}`, JSON.stringify(notes));
                localStorage.setItem(
                    `customerProfiles_${user.uid}`,
                    JSON.stringify(customerProfiles)
                );
            }
            localStorage.setItem('appAccentColor', accentColor);
        }
    }, [notes, stickyNotes, isLoaded, user, accentColor, customerProfiles]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toggleTheme = () => {
        const next: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
        saveSettingsToDb({ themeMode: next });
    };

    // --- Telegram Reminders (Appointments & Sticky Notes) ---
    useEffect(() => {
        if (!telegramConfig.enabled || !telegramConfig.botToken) return;

        const checkReminders = () => {
            const now = new Date();
            const currentHourMinute = now.toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
            });
            const todayStr = formatDateKey(now);

            const getOffsetMinutes = (reminderBefore?: Note['reminderBefore']): number => {
                switch (reminderBefore) {
                    case '15m':
                        return 15;
                    case '1h':
                        return 60;
                    case '1d':
                        return 24 * 60;
                    default:
                        return 0;
                }
            };

            // Appointment Reminders
            notes.forEach(note => {
                if (note.completed) return;
                const noteDateTime = new Date(`${note.date}T${note.time || '00:00'}:00`);
                if (isNaN(noteDateTime.getTime())) return;

                const offset = getOffsetMinutes(note.reminderBefore);
                const remindAt = new Date(noteDateTime.getTime() - offset * 60000);
                const remindDateStr = formatDateKey(remindAt);
                const remindTimeStr = remindAt.toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                });

                if (
                    remindDateStr === todayStr &&
                    remindTimeStr === currentHourMinute &&
                    !sentReminders.has(note.id)
                ) {
                    const msg = buildReminderMessage(note);

                    // Genel yöneticilere
                    sendTelegramMessage(telegramConfig, msg);

                    // Müşteri bazlı bildirim: profilinde telegramChatId varsa ayrıca gönder
                    const profile =
                        customerProfiles[normalizeCustomerKey(note.customer)] || null;
                    if (profile?.telegramChatId) {
                        sendTelegramMessage(
                            telegramConfig,
                            msg,
                            null,
                            String(profile.telegramChatId)
                        );
                    }

                    setSentReminders(prev => new Set(prev).add(note.id));
                }
            });

            // Sticky Note Reminders
            stickyNotes.forEach(note => {
                if (note.reminderDate === todayStr && note.reminderTime === currentHourMinute && !note.archived && !sentStickyReminders.has(note.id)) {
                    let msg = `⏰ <b>HATIRLATICI: ${note.title || "Yapışkan Not"}</b>\n\n`;
                    note.blocks.forEach(block => {
                         msg += block.type === 'todo' ? `${block.done ? '✅' : '⬜'} ${block.content}\n` : `${block.content}\n`;
                    });
                    sendTelegramMessage(telegramConfig, msg);
                    setSentStickyReminders(prev => new Set(prev).add(note.id));
                }
            });

            // Daily summary
            if (
                telegramConfig.dailySummaryEnabled &&
                telegramConfig.dailySummaryTime === currentHourMinute &&
                lastDailySummaryRef.current !== todayStr
            ) {
                const todayNotes = notes.filter(n => n.date === todayStr);
                const pending = todayNotes.filter(n => !n.completed);
                const completed = todayNotes.filter(n => n.completed);

                let msg = "📅 <b>Günlük Özet</b>\n\n";
                msg += `Bugün toplam: ${todayNotes.length} kayıt\n`;
                msg += `Bekleyen: ${pending.length}\n`;
                msg += `Tamamlanan: ${completed.length}\n`;

                const upcoming = pending
                    .slice()
                    .sort(
                        (a, b) =>
                            (a.time || "").localeCompare(b.time || "")
                    )
                    .slice(0, 5);
                if (upcoming.length > 0) {
                    msg += "\nEn yakın randevular:\n";
                    upcoming.forEach(n => {
                        msg += `• ${n.time} - ${n.customer}\n`;
                    });
                }

                sendTelegramMessage(telegramConfig, msg);
                lastDailySummaryRef.current = todayStr;
            }

            // Weekly summary
            if (
                telegramConfig.weeklySummaryEnabled &&
                typeof telegramConfig.weeklySummaryDay === 'number' &&
                telegramConfig.weeklySummaryTime === currentHourMinute &&
                now.getDay() === telegramConfig.weeklySummaryDay &&
                lastWeeklySummaryRef.current !== todayStr
            ) {
                const d = new Date();
                const start = formatDateKey(getStartOfWeek(d));
                const end = formatDateKey(getEndOfWeek(d));
                const weekNotes = notes
                    .filter(n => n.date >= start && n.date <= end && !n.completed)
                    .sort(
                        (a, b) =>
                            a.date.localeCompare(b.date) ||
                            a.time.localeCompare(b.time)
                    );

                let msg = `📅 <b>Haftalık Özet</b>\n\nTarih aralığı: ${start} - ${end}\n`;
                msg += `Bekleyen kayıt sayısı: ${weekNotes.length}\n`;

                const preview = weekNotes.slice(0, 10);
                if (preview.length > 0) {
                    msg += "\nÖrnek kayıtlar:\n";
                    preview.forEach(n => {
                        msg += `• ${n.date} ${n.time} - ${n.customer}\n`;
                    });
                    if (weekNotes.length > preview.length) {
                        msg += `... ve ${weekNotes.length - preview.length} kayıt daha.`;
                    }
                } else {
                    msg += "\nBu hafta için bekleyen kayıt yok.";
                }

                sendTelegramMessage(telegramConfig, msg);
                lastWeeklySummaryRef.current = todayStr;
            }

            // Auto backup
            if (
                telegramConfig.autoBackupEnabled &&
                telegramConfig.autoBackupTime === currentHourMinute &&
                lastBackupRef.current !== todayStr
            ) {
                if (
                    telegramConfig.autoBackupFrequency === 'weekly' &&
                    typeof telegramConfig.weeklySummaryDay === 'number' &&
                    now.getDay() !== telegramConfig.weeklySummaryDay
                ) {
                    // Weekly, but not the chosen day
                } else {
                    runScheduledBackup();
                    lastBackupRef.current = todayStr;
                }
            }
        };
        const interval = setInterval(checkReminders, 30000);
        return () => clearInterval(interval);
    }, [notes, stickyNotes, telegramConfig, sentReminders, sentStickyReminders]);

    // Bot Polling (Only if Webhook is not used or as fallback)
    useEffect(() => {
        notesRef.current = stickyNotes;
        if (!isLoaded || !telegramConfig.enabled || !telegramConfig.botToken || telegramConfig.webhookEnabled) return;
        
        const pollTelegram = async () => {
            try {
                const offset = lastUpdateIdRef.current + 1;
                const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getUpdates?offset=${offset}&timeout=2`);
                const data = await res.json();
                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        lastUpdateIdRef.current = update.update_id;
                        if (update.callback_query) {
                            await processBotCallback(update.callback_query);
                        }
                        else {
                            const msg = update.message || update.channel_post;
                            if (msg && msg.text) {
                                const senderId = String(msg.chat.id);
                                const text = msg.text.trim();

                                if (text.startsWith('/id')) {
                                    await sendTelegramMessage(telegramConfig, `İd numaranız: <code>${senderId}</code>`, null, senderId);
                                    continue;
                                }

                                const allowedChatIds = telegramConfig.chatId ? telegramConfig.chatId.split(',').map(id => id.trim()) : [];
                                if (allowedChatIds.includes(senderId)) {
                                    await processBotMessage(text, senderId, notesRef.current);
                                }
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        };
        const interval = setInterval(pollTelegram, 2500);
        return () => clearInterval(interval);
    }, [isLoaded, telegramConfig, notes, stickyNotes]);

    const processBotCallback = async (callback: any) => {
        const data = callback.data; 
        const senderId = String(callback.message.chat.id);
        const [action, idStr] = data.split('_');
        const noteId = parseInt(idStr) || idStr; 

        if (action === 'complete') {
            const note = notes.find(n => String(n.id) == String(noteId));
            if (note) {
                const isCompleting = !note.completed;
                const updateData = { completed: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null };
                await updateNoteInDb(note.id, updateData);
                await answerCallbackQuery(telegramConfig.botToken, callback.id, isCompleting ? "İş Tamamlandı!" : "Geri Alındı");
                await sendTelegramMessage(telegramConfig, `${isCompleting ? '✅' : '↩️'} <b>İşlem Durumu Güncellendi</b>\n👤 ${note.customer}\nℹ️ Durum: ${isCompleting ? 'Tamamlandı' : 'Bekliyor'}`, null, senderId);
            }
        } else if (action === 'delete') {
            const note = notes.find(n => String(n.id) == String(noteId));
            if (note) {
                await deleteNoteFromDb(note.id);
                await answerCallbackQuery(telegramConfig.botToken, callback.id, "Kayıt Silindi");
                await sendTelegramMessage(telegramConfig, `🗑️ <b>Kayıt Silindi</b>\n👤 ${note.customer}`, null, senderId);
            }
        }
    };

    const processBotMessage = async (text: string, senderId: string, currentStickyNotes: StickyNoteType[]) => {
        if (!botConversations.current[senderId]) botConversations.current[senderId] = { state: 'IDLE', data: {} };
        const userState = botConversations.current[senderId];
        
        const showMainMenu = async () => {
            const keyboard = [
                [{ text: "📅 Randevu Ekle" }, { text: "🔍 Ara" }],
                [{ text: "📅 Tüm Randevular" }, { text: "📅 Bu Hafta" }],
                [{ text: "✅ Tamamlananlar" }, { text: "📝 Yapışkan Notlar" }],
                [{ text: "📊 Durum Raporu" }, { text: "📋 Bekleyen Listesi" }],
                [{ text: "🔍 Müşteri Ara" }],
                [{ text: "❌ İptal" }]
            ];
            await sendTelegramMessage(
                telegramConfig,
                "👋 <b>Ana Menü</b>\nNe yapmak istersiniz?",
                keyboard,
                senderId
            );
        };

        if (text === '/start' || text === '❌ İptal' || text === 'menü' || text === '/menu') {
            userState.state = 'IDLE'; userState.data = {};
            await showMainMenu();
            return;
        }

        const addCmdRegex = /^\/ekle\s+(.+?)\s+(\d{1,2}[./-]\d{1,2}[./-]\d{4})$/;
        const addMatch = text.match(addCmdRegex);
        if (addMatch) {
            const name = addMatch[1].trim();
            let dateRaw = addMatch[2];
            dateRaw = dateRaw.replace(/[\/-]/g, '.');
            const parts = dateRaw.split('.');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                const dateKey = `${year}-${month}-${day}`;
                const newRec: Note = { id: Date.now(), customer: name, content: "Telegram ile eklendi", date: dateKey, time: "09:00", completed: false, createdAt: new Date().toISOString() };
                await saveNoteToDb(newRec);
                const dObj = new Date(parseInt(year), parseInt(month)-1, parseInt(day));
                const dName = dObj.toLocaleDateString('tr-TR', { weekday: 'long' });
                await sendTelegramMessage(telegramConfig, `✅ <b>Kayıt Eklendi!</b>\n👤 ${name}\n📅 ${dateRaw} ${dName}`, null, senderId);
                return;
            }
        }

        if (text.startsWith('/tamamla ')) {
            const searchName = text.replace('/tamamla ', '').trim().toLowerCase();
            const target = notes.find(n => n.customer.toLowerCase().includes(searchName) && !n.completed);
            if (target) {
                await updateNoteInDb(target.id, { completed: true, completedAt: new Date().toISOString() });
                await sendTelegramMessage(telegramConfig, `✅ <b>İşlem Tamamlandı:</b>\n👤 ${target.customer}`, null, senderId);
            } else {
                await sendTelegramMessage(telegramConfig, `❌ <b>Bulunamadı</b> veya zaten tamamlanmış: "${searchName}"`, null, senderId);
            }
            return;
        }

        if (text.startsWith('/bul ') || text.startsWith('/ara ')) {
            const query = text.split(' ').slice(1).join(' ').toLowerCase();
            const results = notes.filter(n => n.customer.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)).slice(0, 5);
            if (results.length === 0) {
                 await sendTelegramMessage(telegramConfig, `🔍 "<b>${query}</b>" için sonuç bulunamadı.`, null, senderId);
            } else {
                 await sendTelegramMessage(telegramConfig, `🔍 <b>Arama Sonuçları:</b>`, null, senderId);
                 for (const n of results) {
                     await sendTelegramMessage(telegramConfig, 
                        `👤 <b>${n.customer}</b>\n📅 ${n.date} - ${n.time}\n📝 ${n.content}\n${n.completed ? '✅ Tamamlandı' : '⏳ Bekliyor'}`, 
                        null, senderId,
                        [[{ text: "✅ Tamamla", callback_data: `complete_${n.id}` }, { text: "🗑️ Sil", callback_data: `delete_${n.id}` }]]
                     );
                 }
            }
            return;
        }

        if (text === '/notlarım' || text === '/notlarim' || text === '📝 Yapışkan Notlar' || text === '📝 Notlarımı Getir') {
             if (!currentStickyNotes || currentStickyNotes.length === 0) {
                await sendTelegramMessage(telegramConfig, "📭 Listenizde hiç not bulunmuyor.", null, senderId);
            } else {
                let msg = "📝 <b>Yapışkan Notlarınız:</b>\n\n";
                currentStickyNotes.forEach((card, i) => {
                    msg += `📌 <b>${card.title || `Not ${i+1}`}</b>\n`;
                    if (card.blocks && card.blocks.length > 0) {
                        card.blocks.forEach(block => {
                            msg += block.type === 'todo' ? `${block.done ? '✅' : '⬜'} ${block.content}\n` : `${block.content}\n`;
                        });
                    }
                    msg += "\n";
                });
                if(msg === "📝 <b>Yapışkan Notlarınız:</b>\n\n") msg = "Notlarınızda hiç içerik yok.";
                await sendTelegramMessage(telegramConfig, msg, null, senderId);
            }
            return;
        }

        if (text === '/randevular' || text === '📅 Tüm Randevular' || text === '📅 Bugün/Yarın') {
            const allPending = notes
                .filter(n => !n.completed)
                .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

            if (allPending.length === 0) {
                await sendTelegramMessage(telegramConfig, "🎉 Hiç bekleyen randevunuz yok!", null, senderId);
            } else {
                let msg = "📅 <b>Tüm Bekleyen Randevular:</b>\n";
                let currentDay = "";
                const notesToShow = allPending.slice(0, 50);
                notesToShow.forEach(n => {
                     if (n.date !== currentDay) {
                        const dateObj = new Date(n.date);
                        msg += `\n🔻 <b>${dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</b>\n`;
                        currentDay = n.date;
                     }
                     msg += `   🕐 ${n.time} - ${n.customer}\n`;
                });
                if (allPending.length > 50) msg += `\n... ve ${allPending.length - 50} kayıt daha.`;
                await sendTelegramMessage(telegramConfig, msg, null, senderId);
            }
            return;
        }

        if (text === '/buhafta' || text === '📅 Bu Hafta') {
            const d = new Date();
            const start = formatDateKey(getStartOfWeek(d));
            const end = formatDateKey(getEndOfWeek(d));
            const weekNotes = notes.filter(n => n.date >= start && n.date <= end && !n.completed).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
            if (weekNotes.length === 0) {
                await sendTelegramMessage(telegramConfig, "📅 Bu hafta için kayıtlı iş yok.", null, senderId);
            } else {
                let msg = `📅 <b>Bu Hafta (${start} / ${end})</b>\n\n`;
                let currentDay = "";
                weekNotes.forEach(n => {
                    if (n.date !== currentDay) {
                        msg += `<b>${new Date(n.date).toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'short'})}</b>\n`;
                        currentDay = n.date;
                    }
                    msg += `   🕐 ${n.time} - ${n.customer}\n`;
                });
                await sendTelegramMessage(telegramConfig, msg, null, senderId);
            }
            return;
        }

        if (text === '/tamamlananlar' || text === '✅ Tamamlananlar') {
            const completed = notes.filter(n => n.completed).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);
            if (completed.length === 0) {
                 await sendTelegramMessage(telegramConfig, "📭 Henüz tamamlanan iş yok.", null, senderId);
            } else {
                let msg = "✅ <b>Son Tamamlanan 10 İş:</b>\n\n";
                completed.forEach(n => { msg += `👤 ${n.customer}\n   📅 ${n.date} - ${n.content}\n\n`; });
                await sendTelegramMessage(telegramConfig, msg, null, senderId);
            }
            return;
        }

        if (text === '/ara' || text === '🔍 Ara') {
             userState.state = 'WAITING_SEARCH';
             await sendTelegramMessage(telegramConfig, "🔍 <b>Aramak istediğiniz müşteri adı veya notu yazın:</b>", [[{ text: "❌ İptal" }]], senderId);
             return;
        }

        if (text.startsWith('/musteri ')) {
            const queryText = text.replace('/musteri ', '').trim().toLowerCase();
            const matchedName = notes
                .map(n => n.customer.trim())
                .filter(Boolean)
                .find(name => name.toLowerCase().includes(queryText));

            if (!matchedName) {
                await sendTelegramMessage(
                    telegramConfig,
                    `🔍 "<b>${queryText}</b>" adına ait müşteri bulunamadı.`,
                    null,
                    senderId
                );
                return;
            }

            const customerNotes = notes
                .filter(n => n.customer.trim() === matchedName)
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                .slice(-5);

            let msg = `👤 <b>${matchedName}</b> için son kayıtlar:\n\n`;
            customerNotes.forEach(n => {
                msg += `📅 ${n.date} ${n.time} - ${n.completed ? '✅' : '⏳'} ${n.content}\n`;
            });

            const profile =
                customerProfiles[normalizeCustomerKey(matchedName)] || null;
            if (profile?.note) {
                msg += `\n📝 Profil Notu: ${profile.note}`;
            }

            await sendTelegramMessage(telegramConfig, msg, null, senderId);
            return;
        }

        switch (userState.state) {
            case 'IDLE':
                if (text === '📅 Randevu Ekle') {
                    userState.state = 'WAITING_NAME';
                    await sendTelegramMessage(telegramConfig, "👤 <b>Müşteri adı nedir?</b>", [[{text:"❌ İptal"}]], senderId);
                } else if (text === '📊 Durum Raporu') {
                    const todayCount = notes.filter(n => n.date === formatDateKey(new Date())).length;
                    await sendTelegramMessage(telegramConfig, `📈 <b>Rapor:</b>\n\nBugün: ${todayCount} Randevu\nToplam: ${notes.length} Kayıt`, null, senderId);
                } else if (text === '📋 Listele' || text === '📋 Bekleyen Listesi') {
                    const pendingNotes = notes.filter(n => !n.completed).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 10); 
                    if (pendingNotes.length === 0) await sendTelegramMessage(telegramConfig, "🎉 Hiç bekleyen işiniz yok.", null, senderId);
                    else {
                        const buttons = pendingNotes.map(n => [{ text: `🔹 ${n.customer} (${n.date})` }]);
                        buttons.push([{text: "❌ İptal"}]);
                        userState.state = 'WAITING_SELECT_TASK';
                        await sendTelegramMessage(telegramConfig, "👇 İşlem yapmak istediğiniz kayda tıklayın:", buttons, senderId);
                    }
                } else if (text === '🔍 Müşteri Ara') {
                    userState.state = 'WAITING_CUSTOMER_SEARCH';
                    await sendTelegramMessage(
                        telegramConfig,
                        "🔍 <b>Müşteri adı yazın:</b>",
                        [[{ text: "❌ İptal" }]],
                        senderId
                    );
                }
                break;
            case 'WAITING_SEARCH':
                 const query = text.toLowerCase();
                 const results = notes.filter(n => n.customer.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)).slice(0, 5);
                 userState.state = 'IDLE';
                 if (results.length === 0) {
                     await sendTelegramMessage(telegramConfig, `🔍 "<b>${text}</b>" bulunamadı.`, null, senderId);
                     await showMainMenu();
                 } else {
                     await sendTelegramMessage(telegramConfig, `🔍 <b>"${text}" için sonuçlar:</b>`, null, senderId);
                     for (const n of results) {
                        await sendTelegramMessage(telegramConfig, `👤 <b>${n.customer}</b>\n📅 ${n.date} - ${n.time}\n📝 ${n.content}\n${n.completed ? '✅ Tamamlandı' : '⏳ Bekliyor'}`, null, senderId, [[{ text: "✅ Tamamla", callback_data: `complete_${n.id}` }, { text: "🗑️ Sil", callback_data: `delete_${n.id}` }]]);
                     }
                     await showMainMenu();
                 }
                break;
            case 'WAITING_SELECT_TASK':
                 const extractName = text.replace('🔹 ', '').split(' (')[0];
                 const selectedNote = notes.find(n => n.customer === extractName || text.includes(n.customer));
                 if (selectedNote) {
                    await sendTelegramMessage(telegramConfig, `👤 <b>${selectedNote.customer}</b>\n📅 ${selectedNote.date} ${selectedNote.time}\n📝 ${selectedNote.content}\n\nNe yapmak istersiniz?`, null, senderId, [[{ text: "✅ Tamamla", callback_data: `complete_${selectedNote.id}` }], [{ text: "🗑️ Sil", callback_data: `delete_${selectedNote.id}` }]]);
                    userState.state = 'IDLE'; await showMainMenu();
                 } else { userState.state = 'IDLE'; await showMainMenu(); }
                break;
            case 'WAITING_CUSTOMER_SEARCH': {
                const queryName = text.toLowerCase();
                const uniqueNames = Array.from(
                    new Set(notes.map(n => n.customer.trim()).filter(Boolean))
                );
                const matched = uniqueNames.filter(name =>
                    name.toLowerCase().includes(queryName)
                );

                if (matched.length === 0) {
                    await sendTelegramMessage(
                        telegramConfig,
                        `🔍 "<b>${text}</b>" adına ait müşteri bulunamadı.`,
                        null,
                        senderId
                    );
                    userState.state = 'IDLE';
                    await showMainMenu();
                    break;
                }

                const targetName = matched[0];
                const customerNotes = notes
                    .filter(n => n.customer.trim() === targetName)
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                    .slice(-5);

                let msg = `👤 <b>${targetName}</b> için son kayıtlar:\n\n`;
                customerNotes.forEach(n => {
                    msg += `📅 ${n.date} ${n.time} - ${n.completed ? '✅' : '⏳'} ${n.content}\n`;
                });

                const profile =
                    customerProfiles[normalizeCustomerKey(targetName)] || null;
                if (profile?.note) {
                    msg += `\n📝 Profil Notu: ${profile.note}`;
                }

                await sendTelegramMessage(telegramConfig, msg, null, senderId);
                userState.state = 'IDLE';
                await showMainMenu();
                break;
            }
            case 'WAITING_NAME':
                userState.data.name = text; userState.state = 'WAITING_DESC';
                await sendTelegramMessage(telegramConfig, `📝 <b>${text}</b> için işlem nedir?`, [[{text:"Kart Çekimi"}, {text:"Havale"}], [{text:"Ödeme"}], [{text:"❌ İptal"}]], senderId);
                break;
            case 'WAITING_DESC':
                userState.data.desc = text; userState.state = 'WAITING_DATE';
                await sendTelegramMessage(telegramConfig, "📅 <b>Tarih?</b>", [[{text:"Bugün"}, {text:"Yarın"}], [{text:"❌ İptal"}]], senderId);
                break;
            case 'WAITING_DATE':
                let finalDateStr = formatDateKey(new Date());
                let displayDate = new Date();

                if (text === 'Bugün') {
                    // Default is already today
                } else if (text === 'Yarın') {
                    displayDate.setDate(displayDate.getDate() + 1);
                    finalDateStr = formatDateKey(displayDate);
                } else {
                    const dateMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
                    if (dateMatch) {
                        const day = dateMatch[1].padStart(2, '0');
                        const month = dateMatch[2].padStart(2, '0');
                        const year = dateMatch[3];
                        finalDateStr = `${year}-${month}-${day}`;
                        displayDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    }
                }

                const dName = displayDate.toLocaleDateString('tr-TR', { weekday: 'long' });
                const dDisplay = displayDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

                const newRec: Note = {
                    id: Date.now(),
                    customer: userState.data.name,
                    content: userState.data.desc,
                    date: finalDateStr,
                    time: "09:00",
                    completed: false,
                    createdAt: new Date().toISOString()
                };
                await saveNoteToDb(newRec);
                await sendTelegramMessage(telegramConfig, `✅ <b>Kayıt Başarılı!</b>\n👤 ${newRec.customer}\n📅 ${dDisplay} ${dName}`, null, senderId);
                userState.state = 'IDLE'; await showMainMenu();
                break;
        }
    };

    // --- Actions ---
    const buildRecurrenceBatch = (note: Note, recurrence: string): Note[] => {
        const batchNotes = [note];
        if (recurrence === 'monthly') {
            for (let i = 1; i <= 11; i++) {
                const d = new Date(note.date); d.setMonth(d.getMonth() + i);
                batchNotes.push({ ...note, id: Date.now() + i, date: formatDateKey(d), recurrenceId: note.id });
            }
        } else if (recurrence === 'yearly') {
            for (let i = 1; i <= 4; i++) {
                const d = new Date(note.date); d.setFullYear(d.getFullYear() + i);
                batchNotes.push({ ...note, id: Date.now() + i, date: formatDateKey(d), recurrenceId: note.id });
            }
        }
        return batchNotes;
    };

    const findTimeConflicts = (candidates: Note[], ignoreIds: Set<number> = new Set()): Note[] => {
        const candidateKeys = new Set(
            candidates.map(c => `${c.date}__${c.time}`)
        );
        return notes.filter(n => !ignoreIds.has(n.id) && candidateKeys.has(`${n.date}__${n.time}`));
    };

    const doAddNotes = async (batchNotes: Note[], recurrence: string, rootNote: Note) => {
        for (const n of batchNotes) { await saveNoteToDb(n); }
        if (telegramConfig.enabled && telegramConfig.botToken) {
            const msg = `🆕 <b>Yeni Randevu</b>${recurrence !== 'none' ? ' (Tekrarlı)' : ''}\n👤 ${rootNote.customer}\n📅 ${new Date(rootNote.date).toLocaleDateString('tr-TR')} - ${rootNote.time}\n📝 ${rootNote.content}`;
            sendTelegramMessage(telegramConfig, msg);
        }
        setIsDayDetailModalOpen(false);
    };

    const handleAddNote = async (note: Note, recurrence: string, force: boolean = false) => {
        const batchNotes = buildRecurrenceBatch(note, recurrence);
        if (!force) {
            const conflicts = findTimeConflicts(batchNotes);
            if (conflicts.length > 0) {
                const sameSlot = conflicts
                    .filter(c => c.date === note.date && c.time === note.time)
                    .slice(0, 5);
                const sample = sameSlot.map(c => `- ${c.time} • ${c.customer}`).join('\n');
                setConfirmModal({
                    isOpen: true,
                    title: 'Saat Çakışması',
                    message:
                        `Bu tarih ve saatte zaten ${conflicts.length} kayıt var.\n\n` +
                        (sample ? `Örnek:\n${sample}\n\n` : '') +
                        `Devam edip kaydetmek ister misiniz?`,
                    type: 'warning',
                    confirmText: 'Evet, Kaydet',
                    cancelText: 'İptal',
                    onConfirm: async () => {
                        await doAddNotes(batchNotes, recurrence, note);
                    }
                });
                return;
            }
        }
        await doAddNotes(batchNotes, recurrence, note);
    };

    const handleDeleteNote = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation(); 
        const noteToDelete = notes.find(n => String(n.id) === String(id));
        setConfirmModal({
            isOpen: true,
            title: 'Kaydı Sil',
            message: 'Bu müşteri kaydını kalıcı olarak silmek istediğinize emin misiniz?',
            onConfirm: async () => {
                await deleteNoteFromDb(id);
                if (noteToDelete) {
                    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
                    setUndoToast({
                        isOpen: true,
                        message: `Silindi: ${noteToDelete.customer} (${noteToDelete.time})`,
                        onUndo: async () => {
                            await saveNoteToDb(noteToDelete);
                            if (telegramConfig.enabled && telegramConfig.botToken) {
                                sendTelegramMessage(
                                    telegramConfig,
                                    `↩️ <b>Kayıt Geri Alındı</b>\n👤 ${noteToDelete.customer}\n📅 ${noteToDelete.date}`
                                );
                            }
                        }
                    });
                    undoTimerRef.current = window.setTimeout(() => {
                        setUndoToast(prev => ({ ...prev, isOpen: false, onUndo: null }));
                    }, 9000);
                }
                if(telegramConfig.enabled && telegramConfig.botToken && noteToDelete) {
                     sendTelegramMessage(telegramConfig, `🗑️ <b>Kayıt Silindi</b>\n👤 ${noteToDelete.customer}\n📅 ${noteToDelete.date}`);
                }
            }
        });
    };

    const handleToggleComplete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const note = notes.find(n => String(n.id) === String(id));
        if(note) {
            const before = { completed: note.completed, completedAt: note.completedAt ?? null };
            const isCompleting = !note.completed;
            const updateData = { completed: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null };
            await updateNoteInDb(id, updateData);
            if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
            setUndoToast({
                isOpen: true,
                message: `${isCompleting ? 'Tamamlandı' : 'Geri alındı'}: ${note.customer} (${note.time})`,
                onUndo: async () => {
                    await updateNoteInDb(id, before);
                }
            });
            undoTimerRef.current = window.setTimeout(() => {
                setUndoToast(prev => ({ ...prev, isOpen: false, onUndo: null }));
            }, 9000);
            if(telegramConfig.enabled && telegramConfig.botToken) {
                 const msg = isCompleting ? `✅ <b>İşlem Tamamlandı</b>\n👤 ${note.customer}\n📝 ${note.content}` : `↩️ <b>İşlem Geri Alındı</b>\n👤 ${note.customer}`;
                 sendTelegramMessage(telegramConfig, msg);
            }
        }
    };

    const updateNotesInDbBulk = async (updates: Array<{ id: number; data: Partial<Note> }>) => {
        if (updates.length === 0) return;
        if (user.isDemo) {
            const map = new Map(updates.map(u => [String(u.id), u.data]));
            setNotes(prev => prev.map(n => {
                const upd = map.get(String(n.id));
                return upd ? { ...n, ...upd } : n;
            }));
            return;
        }
        let batch = writeBatch(db);
        let counter = 0;
        for (const u of updates) {
            batch.update(doc(db, "users", user.uid, "notes", String(u.id)), stripUndefined(u.data as Record<string, unknown>));
            counter++;
            if (counter >= 400) { await batch.commit(); batch = writeBatch(db); counter = 0; }
        }
        if (counter > 0) await batch.commit();
    };

    const doUpdateNoteSingle = async (note: Note) => {
        await updateNoteInDb(note.id, note);
        if (telegramConfig.enabled && telegramConfig.botToken) {
            sendTelegramMessage(telegramConfig, `✏️ <b>Kayıt Düzenlendi</b>\n👤 ${note.customer}`);
        }
        setIsEditModalOpen(false); setEditingNote(null);
    };

    const doUpdateNoteSeries = async (note: Note) => {
        const seriesKey = note.recurrenceId ?? note.id;
        const seriesNotes = notes.filter(n => n.id === seriesKey || n.recurrenceId === seriesKey);
        const updates = seriesNotes.map(n => ({
            id: n.id,
            data: {
                customer: note.customer,
                content: note.content,
                time: note.time
            } satisfies Partial<Note>
        }));
        await updateNotesInDbBulk(updates);
        if (telegramConfig.enabled && telegramConfig.botToken) {
            sendTelegramMessage(telegramConfig, `🔁 <b>Seri Güncellendi</b>\n👤 ${note.customer}\n🕐 Saat: ${note.time}`);
        }
        setIsEditModalOpen(false); setEditingNote(null);
    };

    const handleUpdateNote = async (note: Note, scope: EditScope = 'single', force: boolean = false) => {
        if (scope === 'series') {
            const seriesKey = note.recurrenceId ?? note.id;
            const seriesNotes = notes.filter(n => n.id === seriesKey || n.recurrenceId === seriesKey);
            const candidates = seriesNotes.map(n => ({ ...n, customer: note.customer, content: note.content, time: note.time }));
            if (!force) {
                const ignoreIds = new Set(seriesNotes.map(n => n.id));
                const conflicts = findTimeConflicts(candidates, ignoreIds);
                if (conflicts.length > 0) {
                    const sample = conflicts.slice(0, 5).map(c => `- ${c.date} ${c.time} • ${c.customer}`).join('\n');
                    setConfirmModal({
                        isOpen: true,
                        title: 'Saat Çakışması (Seri)',
                        message:
                            `Seri güncellemesi bazı tarihlerde çakışma yaratıyor (${conflicts.length} kayıt).\n\n` +
                            (sample ? `Örnek:\n${sample}\n\n` : '') +
                            `Devam edip kaydetmek ister misiniz?`,
                        type: 'warning',
                        confirmText: 'Evet, Kaydet',
                        cancelText: 'İptal',
                        onConfirm: async () => {
                            await doUpdateNoteSeries(note);
                        }
                    });
                    return;
                }
            }
            await doUpdateNoteSeries(note);
            return;
        }

        if (!force) {
            const conflicts = findTimeConflicts([note], new Set([note.id]));
            if (conflicts.length > 0) {
                const sample = conflicts.slice(0, 5).map(c => `- ${c.time} • ${c.customer}`).join('\n');
                setConfirmModal({
                    isOpen: true,
                    title: 'Saat Çakışması',
                    message:
                        `Bu tarih ve saatte zaten ${conflicts.length} kayıt var.\n\n` +
                        (sample ? `Örnek:\n${sample}\n\n` : '') +
                        `Devam edip kaydetmek ister misiniz?`,
                    type: 'warning',
                    confirmText: 'Evet, Kaydet',
                    cancelText: 'İptal',
                    onConfirm: async () => {
                        await doUpdateNoteSingle(note);
                    }
                });
                return;
            }
        }
        await doUpdateNoteSingle(note);
    };

    const handleSendTelegram = async (type: 'notes' | 'appointments' | 'completed' | 'week' | 'backup' | 'all_pending') => {
        if(!telegramConfig.enabled || !telegramConfig.botToken) {
            return setNotificationModal({ isOpen: true, title: 'Hata', message: 'Telegram botu aktif değil veya token eksik.', type: 'error' });
        }

        if (type === 'notes') {
            let msg = "📝 <b>Yapışkan Notlarınız:</b>\n\n";
            stickyNotes.forEach((card, i) => {
                if(card.archived) return;
                msg += `📌 <b>${card.title || `Not ${i+1}`}</b>\n`;
                card.blocks.forEach(block => msg += `${block.type === 'todo' ? (block.done ? '✅' : '⬜') : ''} ${block.content}\n`);
                msg += "\n";
            });
            if(stickyNotes.length === 0) {
                return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Gönderilecek yapışkan not bulunamadı.', type: 'info' });
            }
            await sendTelegramMessage(telegramConfig, msg);
        } else if (type === 'appointments') {
            const today = formatDateKey(new Date());
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            const tmrStr = formatDateKey(tomorrow);

            const relevantNotes = notes.filter(n => (n.date === today || n.date === tmrStr) && !n.completed)
                .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

            if(!relevantNotes.length) {
                return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Bugün veya yarın için bekleyen randevunuz bulunmuyor.', type: 'info' });
            }
            
            let msg = "📅 <b>Bugün & Yarın Randevuları</b>\n\n";
            let currentDay = "";
            relevantNotes.forEach(n => {
                if (n.date !== currentDay) {
                    msg += `\n🔻 <b>${new Date(n.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</b>\n`;
                    currentDay = n.date;
                }
                msg += `🕐 ${n.time} - ${n.customer}\n`;
            });
            await sendTelegramMessage(telegramConfig, msg);
        } else if (type === 'all_pending') {
            const allPending = notes.filter(n => !n.completed)
                .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

            if(!allPending.length) {
                return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Bekleyen randevunuz bulunmuyor.', type: 'info' });
            }

            let msg = "📅 <b>Tüm Bekleyen Randevular</b>\n\n";
            let currentDay = "";
            allPending.forEach(n => {
                if (n.date !== currentDay) {
                    msg += `\n🔻 <b>${new Date(n.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</b>\n`;
                    currentDay = n.date;
                }
                msg += `🕐 ${n.time} - ${n.customer}\n`;
            });
            // Telegram has a message length limit, if it's too long we might need to split it, but for now simple send.
            await sendTelegramMessage(telegramConfig, msg);
        } else if (type === 'completed') {
             const doneNotes = notes.filter(n => n.completed).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 20);
             if(!doneNotes.length) {
                 return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Tamamlanan kayıt bulunamadı.', type: 'info' });
             }
             let msg = "✅ <b>Tamamlanan İşlemler</b>\n\n";
             doneNotes.forEach(n => msg += `👤 ${n.customer}\n└ ${n.content}\n\n`);
             await sendTelegramMessage(telegramConfig, msg);
        } else if (type === 'week') {
            const d = new Date();
            const start = formatDateKey(getStartOfWeek(d));
            const end = formatDateKey(getEndOfWeek(d));
            const weekNotes = notes.filter(n => n.date >= start && n.date <= end && !n.completed).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
            if(!weekNotes.length) {
                return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Bu hafta için bekleyen kayıt bulunmuyor.', type: 'info' });
            }
            let msg = `📅 <b>Bu Haftalık Liste (${new Date(start).toLocaleDateString('tr-TR')} - ${new Date(end).toLocaleDateString('tr-TR')})</b>\n\n`;
            weekNotes.forEach(n => msg += `${new Date(n.date).toLocaleDateString('tr-TR', {day:'numeric', month:'short'})} | ${n.time} - ${n.customer}\n`);
            await sendTelegramMessage(telegramConfig, msg);
        } else if (type === 'backup') {
            const data = {
                notes,
                stickyNotes,
                telegramConfig,
                customFields,
                exportDate: new Date().toISOString(),
                userEmail: user.email
            };
            const fileName = `yedek_${formatDateKey(new Date())}.json`;
            const caption = `📦 <b>Sistem Yedeği</b>\n📅 Tarih: ${new Date().toLocaleString('tr-TR')}\n👤 Kullanıcı: ${user.email}`;

            const success = await sendTelegramDocument(telegramConfig, JSON.stringify(data, null, 2), fileName, caption);

            if (success) {
                setNotificationModal({ isOpen: true, title: 'Başarılı', message: 'Yedek dosyası Telegram botuna gönderildi.', type: 'success' });
            } else {
                setNotificationModal({ isOpen: true, title: 'Hata', message: 'Yedek dosyası gönderilemedi.', type: 'error' });
            }
            return;
        }
        setNotificationModal({ isOpen: true, title: 'Başarılı', message: 'Bilgiler Telegram botuna gönderildi.', type: 'success' });
    };

    const openCustomerCard = (name: string) => {
        setCustomerCardName(name);
    };

    const saveCustomerProfileToDb = async (profile: CustomerProfile) => {
        const key = profile.id || normalizeCustomerKey(profile.name);
        const data: CustomerProfile = {
            ...profile,
            id: key,
            name: profile.name,
            updatedAt: new Date().toISOString(),
            createdAt: profile.createdAt || new Date().toISOString()
        };
        setCustomerProfiles(prev => ({ ...prev, [key]: data }));
        if (user.isDemo) {
            localStorage.setItem(`customerProfiles_${user.uid}`, JSON.stringify({ ...customerProfiles, [key]: data }));
            return;
        }
        await setDoc(doc(db, 'users', user.uid, 'customers', key), data, { merge: true });
    };

    return (
        <div className={`min-h-screen bg-[#F8FAFC] ${activeTheme.darkBg} font-sans pb-24 md:pb-10 flex flex-col transition-colors duration-300`}>
            <header className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl border-b border-slate-200 dark:border-dark-border sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-tr ${activeTheme.gradient} text-white p-2.5 rounded-xl shadow-lg ${activeTheme.shadow}`}><Calendar size={20} /></div>
                        <div><h1 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 leading-none tracking-tight">{texts.appTitle}</h1>
                        <div className="flex items-center gap-1.5 mt-0.5"><p className="text-[10px] text-slate-400 font-bold tracking-wider truncate max-w-[150px]">{user.email}</p>{user.isDemo && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded-full font-bold border border-amber-200">DEMO</span>}</div></div>
                    </div>
                    <div className="hidden md:flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-dark-border">
                                {['calendar', 'kanban', 'dashboard', 'customers'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode as any)}
                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                                    viewMode === mode
                                        ? `bg-white dark:bg-dark-card ${activeTheme.text} shadow-sm scale-105`
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                {mode === 'calendar'
                                    ? texts.navCalendar
                                    : mode === 'kanban'
                                    ? texts.navKanban
                                    : mode === 'dashboard'
                                    ? texts.navDashboard
                                    : texts.navCustomers}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => setIsCommandPaletteOpen(true)} className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all relative group" title="Ara (Ctrl+K)"><Search size={20} /></button>
                        <button onClick={() => setIsStickyModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-yellow-200 dark:border-yellow-900/30 hover:bg-yellow-100 transition-all shadow-sm group">
                            <StickyNote size={16} className="group-hover:rotate-12 transition-transform"/>
                            <span>{texts.navNotes}</span>
                            {stickyNotes.length > 0 && <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>}
                        </button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all relative group"><Settings size={20} />{telegramConfig.enabled && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-white dark:ring-dark-card"></span>}</button>
                    </div>
                </div>
            </header>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-dark-card/90 backdrop-blur-lg border-t border-slate-200 dark:border-dark-border z-40 px-4 py-3 flex justify-around items-center pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'calendar' ? activeTheme.text : 'text-slate-400'}`}
                >
                    <CalendarDays size={22} />
                    <span>{texts.navCalendar}</span>
                </button>
                <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'kanban' ? activeTheme.text : 'text-slate-400'}`}
                >
                    <Columns size={22} />
                    <span>{texts.navKanban}</span>
                </button>
                <button
                    onClick={() => {
                        setQuickAddDate(new Date());
                        setIsQuickAddOpen(true);
                    }}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-200"
                >
                    <Plus size={24} />
                    <span>{texts.navQuickAdd}</span>
                </button>
                <button
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-200"
                >
                    <Search size={22} />
                    <span>{texts.navSearch}</span>
                </button>
                <button
                    onClick={() => setViewMode('customers')}
                    className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'customers' ? activeTheme.text : 'text-slate-400'}`}
                >
                    <User size={22} />
                    <span>{texts.navCustomers}</span>
                </button>
                <button
                    onClick={() => setViewMode('dashboard')}
                    className={`flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${viewMode === 'dashboard' ? activeTheme.text : 'text-slate-400'}`}
                >
                    <LayoutDashboard size={22} />
                    <span>İstatistik</span>
                </button>
            </div>

            <div className="flex flex-col">
                {user.isDemo && <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 px-4 py-2 text-center"><p className="text-xs text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2"><Info size={14}/><span>Demo modundasınız. Veriler cihazda saklanır.</span></p></div>}
                {cloudError && !user.isDemo && <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/30 px-4 py-2 text-center"><p className="text-xs text-orange-800 dark:text-orange-200 flex items-center justify-center gap-2 font-medium flex-wrap"><WifiOff size={14}/><span>İzin hatası. Veriler cihazda saklanıyor.</span><button type="button" onClick={() => setFirestoreRetryTrigger(t => t + 1)} className="ml-2 px-2 py-0.5 rounded bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100 text-xs font-semibold hover:bg-orange-300 dark:hover:bg-orange-700">Yenile</button></p></div>}
            </div>

            <main className="max-w-7xl mx-auto w-full px-4 mt-6 flex-1 flex flex-col">
                {viewMode === 'calendar' && <CalendarView notes={notes} currentDate={currentDate} setCurrentDate={setCurrentDate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setIsDayDetailModalOpen={setIsDayDetailModalOpen} handleToggleComplete={handleToggleComplete} handleDragStart={(e, id) => e.dataTransfer.setData('text/plain', String(id))} handleDrop={async (e, dateStr) => {
                     const id = parseInt(e.dataTransfer.getData('text/plain'));
                     if(id) await updateNoteInDb(id, { date: dateStr });
                }} activeTheme={activeTheme} openQuickAdd={(d) => { setQuickAddDate(d); setIsQuickAddOpen(true); }} />}
                
                {viewMode === 'kanban' && <KanbanView notes={notes} activeTheme={activeTheme} handleToggleComplete={handleToggleComplete} handleDeleteNote={handleDeleteNote} openEditModal={(note) => { setEditingNote(note); setIsEditModalOpen(true); }} handleDragStart={(e, id) => e.dataTransfer.setData('text/plain', String(id))} onOpenCustomerCard={openCustomerCard} />}
                
                {viewMode === 'dashboard' && <DashboardView notes={notes} activeTheme={activeTheme} handleSendTelegram={handleSendTelegram} />}

                {viewMode === 'customers' && (
                    <CustomersView
                        notes={notes}
                        activeTheme={activeTheme}
                        profiles={customerProfiles}
                        onOpenCustomerCard={openCustomerCard}
                    />
                )}
            </main>

            {/* MODALS */}
            {isStickyModalOpen && <StickyNotesModal isOpen={isStickyModalOpen} onClose={() => setIsStickyModalOpen(false)} notes={stickyNotes} onAdd={addStickyNoteToDb} onUpdate={updateStickyNoteInDb} onDelete={deleteStickyNoteFromDb} />}
            
            {isSettingsModalOpen && (
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    user={user}
                    telegramConfig={telegramConfig}
                    saveSettings={saveSettingsToDb}
                    accentColor={accentColor}
                    themeMode={themeMode}
                    language={language}
                    notes={notes}
                    stickyNotes={stickyNotes}
                    setNotes={setNotes}
                    setStickyNotes={setStickyNotes}
                    customFields={customFields}
                    setCustomFields={saveCustomFieldsToDb}
                />
            )}
            
            {isDayDetailModalOpen && <DayDetailModal isOpen={isDayDetailModalOpen} onClose={() => setIsDayDetailModalOpen(false)} selectedDate={selectedDate} notes={notes} activeTheme={activeTheme} accentColor={accentColor} onAddNote={handleAddNote} onToggleComplete={handleToggleComplete} onDeleteNote={handleDeleteNote} onEditNote={(note) => { setEditingNote(note); setIsEditModalOpen(true); setIsDayDetailModalOpen(false); }} customFields={customFields} onOpenCustomerCard={openCustomerCard} />}
            
            {isEditModalOpen && editingNote && (
                <EditNoteModal
                    isOpen={isEditModalOpen}
                    onClose={() => { setIsEditModalOpen(false); setEditingNote(null); }}
                    note={editingNote}
                    isPartOfSeries={
                        Boolean(editingNote.recurrenceId) ||
                        notes.some(n => n.recurrenceId === editingNote.id)
                    }
                    onUpdate={(n, scope) => handleUpdateNote(n, scope)}
                    activeTheme={activeTheme}
                    accentColor={accentColor}
                />
            )}

            {isQuickAddOpen && (
                <QuickAddModal
                    isOpen={isQuickAddOpen}
                    onClose={() => setIsQuickAddOpen(false)}
                    selectedDate={quickAddDate}
                    notes={notes}
                    activeTheme={activeTheme}
                    accentColor={accentColor}
                    onAdd={(note) => handleAddNote(note, 'none')}
                />
            )}
            
            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                notes={notes}
                onSelectNote={(note) => {
                    setSelectedDate(new Date(note.date));
                    setIsDayDetailModalOpen(true);
                }}
                activeTheme={activeTheme}
                onOpenCustomerCard={openCustomerCard}
            />

            <ConfirmationModal
                isOpen={confirmModal.isOpen} 
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                onConfirm={confirmModal.onConfirm} 
                title={confirmModal.title} 
                message={confirmModal.message} 
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                type={confirmModal.type}
            />

            <NotificationModal
                isOpen={notificationModal.isOpen}
                onClose={() => setNotificationModal(prev => ({ ...prev, isOpen: false }))}
                title={notificationModal.title}
                message={notificationModal.message}
                type={notificationModal.type}
            />

            <UndoToast
                isOpen={undoToast.isOpen}
                message={undoToast.message}
                onClose={() => setUndoToast(prev => ({ ...prev, isOpen: false, onUndo: null }))}
                onUndo={async () => {
                    const fn = undoToast.onUndo;
                    setUndoToast(prev => ({ ...prev, isOpen: false, onUndo: null }));
                    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
                    if (fn) await fn();
                }}
            />

            {customerCardName && (
                <CustomerCard
                    customer={customerCardName}
                    notes={notes}
                    customFields={customFields}
                    activeTheme={activeTheme}
                    profile={
                        customerProfiles[
                            normalizeCustomerKey(customerCardName)
                        ] || null
                    }
                    onSaveProfile={async (p) =>
                        saveCustomerProfileToDb({
                            ...p,
                            id: p.id || normalizeCustomerKey(customerCardName),
                            name: customerCardName,
                        })
                    }
                    onClose={() => setCustomerCardName(null)}
                />
            )}
        </div>
    );
};

export default CustomerCalendar;