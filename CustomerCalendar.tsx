import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, setDoc, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { 
    Calendar, StickyNote, Settings, LayoutDashboard, CalendarDays, Columns, 
    WifiOff, Info, User, Search
} from 'lucide-react';

import { db, auth } from './config/firebase';
import { Note, StickyNote as StickyNoteType, TelegramConfig, UserProfile, ThemeMode, CustomFieldDef } from './types';
import { THEME_COLORS, NOTE_COLORS } from './constants';
import { formatDateKey, getStartOfWeek, getEndOfWeek } from './utils/helpers';
import { sendTelegramMessage, sendTelegramDocument, answerCallbackQuery } from './services/telegramService';

// Views
import CalendarView from './views/CalendarView';
import KanbanView from './views/KanbanView';
import DashboardView from './views/DashboardView';

// Modals
import StickyNotesModal from './components/modals/StickyNotesModal';
import SettingsModal from './components/modals/SettingsModal';
import DayDetailModal from './components/modals/DayDetailModal';
import EditNoteModal from './components/modals/EditNoteModal';
import ConfirmationModal from './components/modals/ConfirmationModal';
import NotificationModal from './components/modals/NotificationModal';
import CommandPalette from './components/CommandPalette';

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
    const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'dashboard'>('calendar');
    const [themeMode, setThemeMode] = useState<ThemeMode>('light');
    const [accentColor, setAccentColor] = useState('blue'); 
    
    // Telegram State
    const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({ botToken: '', chatId: '', enabled: false });
    const [sentReminders, setSentReminders] = useState<Set<number>>(new Set());
    const [sentStickyReminders, setSentStickyReminders] = useState<Set<number>>(new Set());
    const lastUpdateIdRef = useRef(0);
    const botConversations = useRef<any>({});

    // Modals
    const [isDayDetailModalOpen, setIsDayDetailModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isStickyModalOpen, setIsStickyModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    // Confirmation & Notification State
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
        isOpen: false, title: '', message: '', onConfirm: () => {}
    });
    const [notificationModal, setNotificationModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'info' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });

    const notesRef = useRef(stickyNotes);
    const activeTheme = THEME_COLORS[accentColor] || THEME_COLORS.blue;

    // --- DB Helpers ---
    const saveNoteToDb = async (noteData: Note) => {
        if (user.isDemo) {
            setNotes(prev => [...prev, noteData]);
            return;
        }
        try {
            await setDoc(doc(db, "users", user.uid, "notes", String(noteData.id)), noteData);
        } catch (e) {
            console.error("Firestore Error", e);
            setCloudError(true);
        }
    };

    const updateNoteInDb = async (id: number, data: Partial<Note>) => {
        if (user.isDemo) {
            setNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, ...data } : n));
            return;
        }
        try {
            await updateDoc(doc(db, "users", user.uid, "notes", String(id)), data);
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
            await setDoc(doc(db, "users", user.uid, "sticky_notes", String(note.id)), note);
        } catch (e) { console.error("Sticky Add Error", e); }
    };

    const updateStickyNoteInDb = async (id: number, data: Partial<StickyNoteType>) => {
        if (user.isDemo) {
            setStickyNotes(prev => prev.map(n => String(n.id) === String(id) ? { ...n, ...data } : n));
            return;
        }
        try {
            await updateDoc(doc(db, "users", user.uid, "sticky_notes", String(id)), data);
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

    const saveSettingsToDb = async (newConfig: Partial<TelegramConfig & {themeMode: ThemeMode, accentColor: string}>) => {
        const updatedConfig = { ...telegramConfig, ...newConfig };

        // Handle Telegram state updates
        if ('botToken' in newConfig || 'chatId' in newConfig || 'enabled' in newConfig || 'webhookEnabled' in newConfig) {
            setTelegramConfig(prev => ({ ...prev, ...newConfig }));
        }

        // Handle Theme state updates
        if ('themeMode' in newConfig) {
            setThemeMode(newConfig.themeMode!);
            localStorage.setItem('appThemeMode', newConfig.themeMode!);
            document.documentElement.classList.toggle('dark', newConfig.themeMode === 'dark');
        }
        if ('accentColor' in newConfig) {
            setAccentColor(newConfig.accentColor!);
            localStorage.setItem('appAccentColor', newConfig.accentColor!);
        }

        if(user.isDemo) {
            if ('botToken' in newConfig) localStorage.setItem('telegramConfig', JSON.stringify(updatedConfig));
        } else {
            try {
                await setDoc(doc(db, "users", user.uid, "settings", "config"), updatedConfig, { merge: true });
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
        const savedThemeMode = localStorage.getItem('appThemeMode');
        const savedAccent = localStorage.getItem('appAccentColor');
        const savedTelegram = localStorage.getItem('telegramConfig');
        const savedCustomFields = localStorage.getItem('customFields');
        
        if (savedThemeMode) { 
            setThemeMode(savedThemeMode as ThemeMode); 
            document.documentElement.classList.toggle('dark', savedThemeMode === 'dark'); 
        }
        if (savedAccent && THEME_COLORS[savedAccent]) setAccentColor(savedAccent);
        
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
            setIsLoaded(true);
            return;
        }

        if (user && !user.isDemo) {
            const qNotes = query(collection(db, "users", user.uid, "notes"));
            const unsubscribeNotes = onSnapshot(qNotes, (querySnapshot) => {
                const notesData: Note[] = [];
                querySnapshot.forEach((doc) => {
                    notesData.push({ ...doc.data() as Note, id: parseInt(doc.id) || parseInt(doc.data().id) || Number(doc.id) });
                });
                setNotes(notesData);
                setCloudError(false);
            }, (error: any) => {
                 if (error.code === 'permission-denied') setCloudError(true);
            });

            const qSticky = query(collection(db, "users", user.uid, "sticky_notes"));
            const unsubscribeSticky = onSnapshot(qSticky, (querySnapshot) => {
                const stickyData: StickyNoteType[] = [];
                querySnapshot.forEach((doc) => {
                    stickyData.push({ ...doc.data() as StickyNoteType, id: parseInt(doc.id) || parseInt(doc.data().id) || Number(doc.id) });
                });
                setStickyNotes(stickyData.sort((a,b) => b.id - a.id));
            });

            getDoc(doc(db, "users", user.uid, "settings", "config")).then(snap => {
                if(snap.exists()) {
                    const data = snap.data();
                    setTelegramConfig({
                        botToken: data.botToken || '',
                        chatId: data.chatId || '',
                        enabled: data.enabled || false,
                        webhookEnabled: data.webhookEnabled || false
                    });
                    if(data.themeMode) {
                        setThemeMode(data.themeMode);
                        document.documentElement.classList.toggle('dark', data.themeMode === 'dark');
                    }
                    if(data.accentColor) setAccentColor(data.accentColor);
                }
            });
            getDoc(doc(db, "users", user.uid, "settings", "customFields")).then(snap => {
                if(snap.exists() && snap.data().fields) setCustomFields(snap.data().fields);
            });

            setIsLoaded(true);
            return () => {
                unsubscribeNotes();
                unsubscribeSticky();
            };
        }
    }, [user]);

    useEffect(() => {
        if (isLoaded) {
            if (user.isDemo) localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
            localStorage.setItem('appAccentColor', accentColor);
            if (user.isDemo) localStorage.setItem(`customerNotes_${user.uid}`, JSON.stringify(notes));
        }
    }, [notes, stickyNotes, isLoaded, user, accentColor]);

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
        const newMode = themeMode === 'light' ? 'dark' : 'light';
        saveSettingsToDb({ themeMode: newMode });
    };

    // --- Telegram Reminders (Appointments & Sticky Notes) ---
    useEffect(() => {
        if (!telegramConfig.enabled || !telegramConfig.botToken) return;

        const checkReminders = () => {
            const now = new Date();
            const currentHourMinute = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const todayStr = formatDateKey(now);

            // Appointment Reminders
            notes.forEach(note => {
                if (note.date === todayStr && note.time === currentHourMinute && !note.completed && !sentReminders.has(note.id)) {
                    sendTelegramMessage(telegramConfig, `🔔 <b>BUGÜNÜN RANDEVUSU</b>\n👤 ${note.customer}\n🕐 Saat: ${note.time}\n📝 ${note.content}`);
                    setSentReminders(prev => new Set(prev).add(note.id));
                }
            });

            // Sticky Note Reminders
            stickyNotes.forEach(note => {
                if (note.reminderDate === todayStr && note.reminderTime === currentHourMinute && !note.archived && !sentStickyReminders.has(note.id)) {
                    let msg = `⏰ <b>HATIRLATICI: ${note.title || "Yapışkan Not"}</b>\n\n`;
                    note.blocks.forEach(b => {
                         msg += b.type === 'todo' ? `${b.done ? '✅' : '⬜'} ${b.content}\n` : `${b.content}\n`;
                    });
                    sendTelegramMessage(telegramConfig, msg);
                    setSentStickyReminders(prev => new Set(prev).add(note.id));
                }
            });
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
                [{ text: "📊 Durum Raporu" }, {text: "📋 Bekleyen Listesi"}],
                [{ text: "❌ İptal" }]
            ];
            await sendTelegramMessage(telegramConfig, "👋 <b>Ana Menü</b>\nNe yapmak istersiniz?", keyboard, senderId);
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
    const handleAddNote = async (note: Note, recurrence: string) => {
        const batchNotes = [note];
        if (recurrence === 'monthly') {
            for(let i=1; i<=11; i++) {
                const d = new Date(note.date); d.setMonth(d.getMonth() + i);
                batchNotes.push({...note, id: Date.now() + i, date: formatDateKey(d), recurrenceId: note.id});
            }
        } else if (recurrence === 'yearly') {
             for(let i=1; i<=4; i++) {
                const d = new Date(note.date); d.setFullYear(d.getFullYear() + i);
                batchNotes.push({...note, id: Date.now() + i, date: formatDateKey(d), recurrenceId: note.id});
            }
        }
        for (const n of batchNotes) { await saveNoteToDb(n); }
        if(telegramConfig.enabled && telegramConfig.botToken) {
            const msg = `🆕 <b>Yeni Randevu</b>${recurrence !== 'none' ? ' (Tekrarlı)' : ''}\n👤 ${note.customer}\n📅 ${new Date(note.date).toLocaleDateString('tr-TR')} - ${note.time}\n📝 ${note.content}`;
            sendTelegramMessage(telegramConfig, msg);
        }
        setIsDayDetailModalOpen(false);
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
            const isCompleting = !note.completed;
            const updateData = { completed: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null };
            await updateNoteInDb(id, updateData);
            if(telegramConfig.enabled && telegramConfig.botToken) {
                 const msg = isCompleting ? `✅ <b>İşlem Tamamlandı</b>\n👤 ${note.customer}\n📝 ${note.content}` : `↩️ <b>İşlem Geri Alındı</b>\n👤 ${note.customer}`;
                 sendTelegramMessage(telegramConfig, msg);
            }
        }
    };

    const handleUpdateNote = async (note: Note) => {
        await updateNoteInDb(note.id, note);
        if(telegramConfig.enabled && telegramConfig.botToken) {
            sendTelegramMessage(telegramConfig, `✏️ <b>Kayıt Düzenlendi</b>\n👤 ${note.customer}`);
        }
        setIsEditModalOpen(false); setEditingNote(null);
    };

    const handleSendTelegram = async (type: 'notes' | 'appointments' | 'completed' | 'week' | 'backup') => {
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
            const pendingNotes = notes.filter(n => !n.completed).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
            if(!pendingNotes.length) {
                return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Bekleyen randevunuz bulunmuyor.', type: 'info' });
            }
            
            let msg = "📅 <b>Bekleyen Randevular Listesi</b>\n\n";
            let currentDay = "";
            pendingNotes.slice(0, 30).forEach(n => {
                if (n.date !== currentDay) {
                    msg += `\n🔻 <b>${new Date(n.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</b>\n`;
                    currentDay = n.date;
                }
                msg += `🕐 ${n.time} - ${n.customer}\n`;
            });
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
            const weekNotes = notes.filter(n => n.date >= start && n.date <= end).sort((a,b) => a.date.localeCompare(b.date));
            if(!weekNotes.length) {
                return setNotificationModal({ isOpen: true, title: 'Bilgi', message: 'Bu hafta için kayıt bulunmuyor.', type: 'info' });
            }
            let msg = `📅 <b>Bu Hafta (${new Date(start).toLocaleDateString('tr-TR')} - ${new Date(end).toLocaleDateString('tr-TR')})</b>\n\n`;
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

    return (
        <div className={`min-h-screen bg-[#F8FAFC] ${activeTheme.darkBg} font-sans pb-24 md:pb-10 flex flex-col transition-colors duration-300`}>
            <header className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-xl border-b border-slate-200 dark:border-dark-border sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-tr ${activeTheme.gradient} text-white p-2.5 rounded-xl shadow-lg ${activeTheme.shadow}`}><Calendar size={20} /></div>
                        <div><h1 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 leading-none tracking-tight">Müşteri Takip</h1>
                        <div className="flex items-center gap-1.5 mt-0.5"><p className="text-[10px] text-slate-400 font-bold tracking-wider truncate max-w-[150px]">{user.email}</p>{user.isDemo && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded-full font-bold border border-amber-200">DEMO</span>}</div></div>
                    </div>
                    <div className="hidden md:flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-dark-border">
                        {['calendar', 'kanban', 'dashboard'].map(mode => (
                            <button key={mode} onClick={() => setViewMode(mode as any)} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${viewMode === mode ? `bg-white dark:bg-dark-card ${activeTheme.text} shadow-sm scale-105` : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>{mode === 'calendar' ? 'Takvim' : mode === 'kanban' ? 'Panolar' : 'İstatistik'}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => setIsCommandPaletteOpen(true)} className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all relative group" title="Ara (Ctrl+K)"><Search size={20} /></button>
                        <button onClick={() => setIsStickyModalOpen(true)} className="p-3 text-slate-500 dark:text-slate-400 hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-900/20 rounded-2xl transition-all relative group"><StickyNote size={20} />{stickyNotes.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-yellow-400 rounded-full ring-2 ring-white dark:ring-dark-card animate-pulse"></span>}</button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all relative group"><Settings size={20} />{telegramConfig.enabled && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-white dark:ring-dark-card"></span>}</button>
                    </div>
                </div>
            </header>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-dark-card/90 backdrop-blur-lg border-t border-slate-200 dark:border-dark-border z-40 px-6 py-4 flex justify-between items-center pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <button onClick={() => setViewMode('calendar')} className={`flex flex-col items-center gap-1 transition-colors ${viewMode === 'calendar' ? activeTheme.text : 'text-slate-400'}`}><CalendarDays size={24}/></button>
                <button onClick={() => setViewMode('kanban')} className={`flex flex-col items-center gap-1 transition-colors ${viewMode === 'kanban' ? activeTheme.text : 'text-slate-400'}`}><Columns size={24}/></button>
                <button onClick={() => setViewMode('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${viewMode === 'dashboard' ? activeTheme.text : 'text-slate-400'}`}><LayoutDashboard size={24}/></button>
            </div>

            <div className="flex flex-col">
                {user.isDemo && <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 px-4 py-2 text-center"><p className="text-xs text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2"><Info size={14}/><span>Demo modundasınız. Veriler cihazda saklanır.</span></p></div>}
                {cloudError && !user.isDemo && <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/30 px-4 py-2 text-center animate-pulse"><p className="text-xs text-orange-800 dark:text-orange-200 flex items-center justify-center gap-2 font-medium"><WifiOff size={14}/><span>İzin hatası. Veriler cihazda saklanıyor.</span></p></div>}
            </div>

            <main className="max-w-7xl mx-auto w-full px-4 mt-6 flex-1 flex flex-col">
                {viewMode === 'calendar' && <CalendarView notes={notes} currentDate={currentDate} setCurrentDate={setCurrentDate} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setIsDayDetailModalOpen={setIsDayDetailModalOpen} handleToggleComplete={handleToggleComplete} handleDragStart={(e, id) => e.dataTransfer.setData('text/plain', String(id))} handleDrop={async (e, dateStr) => {
                     const id = parseInt(e.dataTransfer.getData('text/plain'));
                     if(id) await updateNoteInDb(id, { date: dateStr });
                }} activeTheme={activeTheme} />}
                
                {viewMode === 'kanban' && <KanbanView notes={notes} activeTheme={activeTheme} handleToggleComplete={handleToggleComplete} handleDeleteNote={handleDeleteNote} openEditModal={(note) => { setEditingNote(note); setIsEditModalOpen(true); }} handleDragStart={(e, id) => e.dataTransfer.setData('text/plain', String(id))} />}
                
                {viewMode === 'dashboard' && <DashboardView notes={notes} stickyNotes={stickyNotes} activeTheme={activeTheme} handleSendTelegram={handleSendTelegram} />}
            </main>

            {/* MODALS */}
            {isStickyModalOpen && <StickyNotesModal isOpen={isStickyModalOpen} onClose={() => setIsStickyModalOpen(false)} notes={stickyNotes} onAdd={addStickyNoteToDb} onUpdate={updateStickyNoteInDb} onDelete={deleteStickyNoteFromDb} />}
            
            {isSettingsModalOpen && <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} user={user} telegramConfig={telegramConfig} saveSettings={saveSettingsToDb} themeMode={themeMode} toggleTheme={toggleTheme} accentColor={accentColor} setAccentColor={(color) => saveSettingsToDb({ accentColor: color })} notes={notes} stickyNotes={stickyNotes} setNotes={setNotes} setStickyNotes={setStickyNotes} customFields={customFields} setCustomFields={saveCustomFieldsToDb} />}
            
            {isDayDetailModalOpen && <DayDetailModal isOpen={isDayDetailModalOpen} onClose={() => setIsDayDetailModalOpen(false)} selectedDate={selectedDate} notes={notes} activeTheme={activeTheme} accentColor={accentColor} onAddNote={handleAddNote} onToggleComplete={handleToggleComplete} onDeleteNote={handleDeleteNote} onEditNote={(note) => { setEditingNote(note); setIsEditModalOpen(true); setIsDayDetailModalOpen(false); }} customFields={customFields} />}
            
            {isEditModalOpen && editingNote && <EditNoteModal isOpen={isEditModalOpen} onClose={() => {setIsEditModalOpen(false); setEditingNote(null);}} note={editingNote} onUpdate={handleUpdateNote} activeTheme={activeTheme} accentColor={accentColor} />}
            
            <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} notes={notes} onSelectNote={(note) => { setSelectedDate(new Date(note.date)); setIsDayDetailModalOpen(true); }} activeTheme={activeTheme} />

            <ConfirmationModal
                isOpen={confirmModal.isOpen} 
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                onConfirm={confirmModal.onConfirm} 
                title={confirmModal.title} 
                message={confirmModal.message} 
            />

            <NotificationModal
                isOpen={notificationModal.isOpen}
                onClose={() => setNotificationModal(prev => ({ ...prev, isOpen: false }))}
                title={notificationModal.title}
                message={notificationModal.message}
                type={notificationModal.type}
            />
        </div>
    );
};

export default CustomerCalendar;
