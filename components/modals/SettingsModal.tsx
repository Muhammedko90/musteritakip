import React, { useState, useRef } from 'react';
import { Settings, X, Download, Upload, MessageSquare, Palette, LogOut, Eraser, Plus, Trash } from 'lucide-react';
import { signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { THEME_COLORS } from '../../constants';
import { UserProfile, TelegramConfig, Note, StickyNote, CustomFieldDef, ThemeMode, Language } from '../../types';
import { formatDateKey } from '../../utils/helpers';

type SettingsUpdate = Partial<
    TelegramConfig & {
        themeMode: ThemeMode;
        accentColor: string;
        language: Language;
    }
>;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    telegramConfig: TelegramConfig;
    saveSettings: (config: SettingsUpdate) => void | Promise<void>;
    accentColor: string;
    themeMode: ThemeMode;
    language: Language;
    notes: Note[];
    stickyNotes: StickyNote[];
    setNotes: (n: Note[]) => void;
    setStickyNotes: (n: StickyNote[]) => void;
    customFields: CustomFieldDef[];
    setCustomFields: (fields: CustomFieldDef[]) => void;
}

const SettingsModal: React.FC<Props> = ({ 
    isOpen, onClose, user, telegramConfig, saveSettings,
    accentColor, themeMode, language,
    notes, stickyNotes, setNotes, setStickyNotes,
    customFields, setCustomFields
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [newFieldLabel, setNewFieldLabel] = useState('');

    const activeTheme = THEME_COLORS[accentColor] || THEME_COLORS.blue;

    const normalizeTime = (value: string, fallback: string): string => {
        const raw = (value || '').trim();
        if (!raw) return fallback;
        const parts = raw.split(':');
        let h = parseInt(parts[0] || '0', 10);
        let m = parseInt(parts[1] || '0', 10);
        if (isNaN(h) || h < 0) h = 0;
        if (h > 23) h = 23;
        if (isNaN(m) || m < 0) m = 0;
        if (m > 59) m = 59;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const [dailyHour, setDailyHour] = useState('09');
    const [dailyMinute, setDailyMinute] = useState('00');
    const [weeklyHour, setWeeklyHour] = useState('18');
    const [weeklyMinute, setWeeklyMinute] = useState('00');
    const [backupHour, setBackupHour] = useState('23');
    const [backupMinute, setBackupMinute] = useState('00');

    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minuteOptions = ['00', '15', '30', '45'];

    React.useEffect(() => {
        const d = normalizeTime(telegramConfig.dailySummaryTime || '09:00', '09:00').split(':');
        setDailyHour(d[0]);
        setDailyMinute(d[1]);
        const w = normalizeTime(telegramConfig.weeklySummaryTime || '18:00', '18:00').split(':');
        setWeeklyHour(w[0]);
        setWeeklyMinute(w[1]);
        const b = normalizeTime(telegramConfig.autoBackupTime || '23:00', '23:00').split(':');
        setBackupHour(b[0]);
        setBackupMinute(b[1]);
    }, [telegramConfig.dailySummaryTime, telegramConfig.weeklySummaryTime, telegramConfig.autoBackupTime]);

    if (!isOpen) return null;

    const downloadBackup = () => {
        const data = { notes, stickyNotes, telegramConfig, customFields, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `musteri_takip_yedek_${formatDateKey(new Date())}.json`; a.click();
    };

    const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setRestoreLoading(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.telegramConfig) saveSettings(data.telegramConfig);
                if (data.stickyNotes) setStickyNotes(data.stickyNotes);
                if (data.customFields) setCustomFields(data.customFields);
                if (data.notes && Array.isArray(data.notes)) {
                    if (user.isDemo) {
                        setNotes(data.notes);
                        alert("Yedek başarıyla yüklendi!");
                    } else {
                        const batch = writeBatch(db);
                        let counter = 0;
                        for (const note of data.notes) {
                            const noteRef = doc(db, "users", user.uid, "notes", String(note.id));
                            batch.set(noteRef, note);
                            counter++;
                            if(counter >= 400) { await batch.commit(); counter = 0; }
                        }
                        if(counter > 0) await batch.commit();
                        alert("Veritabanına aktarıldı!");
                    }
                }
            } catch (err) { alert("Hata oluştu!"); } finally { setRestoreLoading(false); }
        };
        reader.readAsText(file);
    };

    const handleDeleteAllData = async () => {
        if(!deletePassword) return;
        setDeleteLoading(true);
        try {
            if (auth.currentUser) {
                 const credential = EmailAuthProvider.credential(auth.currentUser.email!, deletePassword);
                 await reauthenticateWithCredential(auth.currentUser, credential);
            }
            if(user.isDemo) {
                setNotes([]);
                localStorage.removeItem(`customerNotes_${user.uid}`);
            } else {
                const batch = writeBatch(db);
                let counter = 0;
                for(const note of notes) {
                     batch.delete(doc(db, "users", user.uid, "notes", String(note.id)));
                     counter++;
                     if(counter >= 400) { await batch.commit(); counter = 0; }
                }
                if(counter > 0) await batch.commit();
            }
            alert("Silindi.");
            setShowDeleteConfirm(false); setDeletePassword('');
        } catch(e) { alert("Şifre hatası."); } finally { setDeleteLoading(false); }
    };

    const handleLogout = () => {
        if (user.isDemo) window.location.reload();
        else signOut(auth);
    };

    const addCustomField = () => {
        if(!newFieldLabel) return;
        const newField: CustomFieldDef = { id: Date.now().toString(), label: newFieldLabel, type: 'text' };
        setCustomFields([...customFields, newField]);
        setNewFieldLabel('');
    };

    const removeCustomField = (id: string) => {
        setCustomFields(customFields.filter(f => f.id !== id));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className={`bg-white ${activeTheme.darkCard} rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto transition-colors duration-300`} onClick={e => e.stopPropagation()}>
                <div className={`bg-slate-800 dark:bg-black/40 p-6 flex justify-between items-center text-white sticky top-0 z-10 backdrop-blur-md`}>
                    <h3 className="font-black text-xl flex items-center gap-3"><Settings size={22} /> Ayarlar</h3>
                    <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={22} /></button>
                </div>
                <div className="p-6 space-y-10 pb-12">

                    {/* Telegram Section */}
                    <div className="space-y-4">
                        <h4 className="font-black text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-3 flex items-center gap-2 uppercase tracking-tighter text-sm">
                             <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><MessageSquare size={16}/></div>
                             Telegram Bot Yönetimi
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Günlük/haftalık özet ve otomatik yedek, ayarladığınız saatlerde <strong>uygulama kapalıyken bile</strong> Telegram’a gönderilir.
                        </p>
                        <div className="space-y-4">
                            <div><label className="text-[10px] uppercase font-black text-slate-400 ml-1 mb-1 block">Bot Token</label><input type="text" className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-2xl text-sm bg-slate-50 dark:bg-black/20 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={telegramConfig.botToken} onChange={e => saveSettings({ botToken: e.target.value })} /></div>
                            <div><label className="text-[10px] uppercase font-black text-slate-400 ml-1 mb-1 block">Chat ID (Virgülle ayırın)</label><input type="text" className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-2xl text-sm bg-slate-50 dark:bg-black/20 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={telegramConfig.chatId} onChange={e => saveSettings({ chatId: e.target.value })} /></div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-600 dark:text-slate-300">Bot Aktif</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Anlık Bildirimler</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={telegramConfig.enabled} onChange={e => saveSettings({ enabled: e.target.checked })} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div></label>
                                </div>

                                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">Webhook modu</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Uygulama kapalıyken /start, /ekle, /tamamla vb. yanıtlanır</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={!!telegramConfig.webhookEnabled} onChange={e => saveSettings({ webhookEnabled: e.target.checked })} />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Sunucuda webhook tanımlıysa bu bot ile Chat ID kaydettiğinizde kapalıyken de yanıt alırsınız.</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">Günlük Özet</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                Her gün seçilen saatte özet
                                            </span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!telegramConfig.dailySummaryEnabled}
                                                onChange={e =>
                                                    saveSettings({ dailySummaryEnabled: e.target.checked })
                                                }
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
                                            Saat
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                                value={dailyHour}
                                                onChange={e => {
                                                    const h = e.target.value;
                                                    setDailyHour(h);
                                                    saveSettings({ dailySummaryTime: `${h}:${dailyMinute}` });
                                                }}
                                            >
                                                {hourOptions.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">:</span>
                                            <select
                                                className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                                value={dailyMinute}
                                                onChange={e => {
                                                    const m = e.target.value;
                                                    setDailyMinute(m);
                                                    saveSettings({ dailySummaryTime: `${dailyHour}:${m}` });
                                                }}
                                            >
                                                {minuteOptions.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">Türkiye saati</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">Haftalık Özet</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                Seçilen gün ve saatte özet
                                            </span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!telegramConfig.weeklySummaryEnabled}
                                                onChange={e =>
                                                    saveSettings({ weeklySummaryEnabled: e.target.checked })
                                                }
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                            value={
                                                typeof telegramConfig.weeklySummaryDay === 'number'
                                                    ? telegramConfig.weeklySummaryDay
                                                    : 0
                                            }
                                            onChange={e =>
                                                saveSettings({
                                                    weeklySummaryDay: Number(e.target.value),
                                                })
                                            }
                                        >
                                            <option value={0}>Pazar</option>
                                            <option value={1}>Pazartesi</option>
                                            <option value={2}>Salı</option>
                                            <option value={3}>Çarşamba</option>
                                            <option value={4}>Perşembe</option>
                                            <option value={5}>Cuma</option>
                                            <option value={6}>Cumartesi</option>
                                        </select>
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                                value={weeklyHour}
                                                onChange={e => {
                                                    const h = e.target.value;
                                                    setWeeklyHour(h);
                                                    saveSettings({ weeklySummaryTime: `${h}:${weeklyMinute}` });
                                                }}
                                            >
                                                {hourOptions.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">:</span>
                                            <select
                                                className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                                value={weeklyMinute}
                                                onChange={e => {
                                                    const m = e.target.value;
                                                    setWeeklyMinute(m);
                                                    saveSettings({ weeklySummaryTime: `${weeklyHour}:${m}` });
                                                }}
                                            >
                                                {minuteOptions.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">Türkiye saati</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Custom Fields Section */}
                    <div className="space-y-4">
                        <h4 className="font-black text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-3 flex items-center gap-2 uppercase tracking-tighter text-sm">
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><Plus size={16}/></div> 
                            Özel Veri Alanları
                        </h4>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Örn: Plaka, Ücret..." className="flex-1 px-4 py-3 border border-slate-200 dark:border-white/10 rounded-2xl text-sm bg-slate-50 dark:bg-black/20 dark:text-white outline-none focus:ring-2 focus:ring-green-500 transition-all" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} />
                            <button onClick={addCustomField} className="bg-green-500 hover:bg-green-600 text-white px-5 rounded-2xl font-black text-xs uppercase transition-colors">Ekle</button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                            {customFields.map(field => (
                                <div key={field.id} className="flex justify-between items-center bg-slate-50 dark:bg-black/20 p-3 px-4 rounded-xl border border-slate-100 dark:border-white/5 group">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{field.label}</span>
                                    <button onClick={() => removeCustomField(field.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h4 className="font-black text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-3 flex items-center gap-2 uppercase tracking-tighter text-sm">
                            <div className="p-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg"><Palette size={16}/></div> 
                            Görünüm & Tema
                        </h4>

                        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${THEME_COLORS[accentColor]?.gradient || THEME_COLORS.purple.gradient} shadow-sm`} />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">Tema Modu</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                            {themeMode === 'dark' ? 'Karanlık' : 'Aydınlık'}
                                        </span>
                                    </div>
                                </div>
                                <div className="inline-flex bg-white/80 dark:bg-slate-900/60 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => saveSettings({ themeMode: 'light' })}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                                            themeMode === 'light'
                                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        Aydınlık
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => saveSettings({ themeMode: 'dark' })}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                                            themeMode === 'dark'
                                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        Karanlık
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">Uygulama Dili</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                        {language === 'en' ? 'English' : 'Türkçe'}
                                    </span>
                                </div>
                                <div className="inline-flex bg-white/80 dark:bg-slate-900/60 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => saveSettings({ language: 'tr' })}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                                            language === 'tr'
                                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        Türkçe
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => saveSettings({ language: 'en' })}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                                            language === 'en'
                                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Backup Section */}
                    <div className="space-y-4">
                        <h4 className="font-black text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-3 flex items-center gap-2 uppercase tracking-tighter text-sm">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Download size={16}/></div>
                            Veri Yedekleme & Kurtarma
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={downloadBackup} className="bg-slate-50 dark:bg-black/20 hover:bg-slate-100 p-4 rounded-3xl font-black text-[10px] uppercase tracking-tighter flex flex-col items-center gap-2 border border-slate-200 dark:border-white/5 transition-all text-slate-600 dark:text-slate-300">
                                <Download size={22} className="text-blue-500 mb-1"/> Yedek İndir
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 dark:bg-black/20 hover:bg-slate-100 p-4 rounded-3xl font-black text-[10px] uppercase tracking-tighter flex flex-col items-center gap-2 border border-slate-200 dark:border-white/5 transition-all text-slate-600 dark:text-slate-300">
                                {restoreLoading ? <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-1"></div> : <Upload size={22} className="text-purple-500 mb-1"/>} Yedekten Yükle
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleRestoreBackup} className="hidden" accept=".json" />
                        </div>

                        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                                        Otomatik Yedek
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                        Seçilen sıklıkta otomatik yedek al
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={!!telegramConfig.autoBackupEnabled}
                                        onChange={e =>
                                            saveSettings({ autoBackupEnabled: e.target.checked })
                                        }
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
                                        Sıklık
                                    </span>
                                    <select
                                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                        value={telegramConfig.autoBackupFrequency || 'daily'}
                                        onChange={e =>
                                            saveSettings({
                                                autoBackupFrequency: e.target
                                                    .value as TelegramConfig['autoBackupFrequency'],
                                            })
                                        }
                                    >
                                        <option value="daily">Günlük</option>
                                        <option value="weekly">Haftalık</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
                                        Saat
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                            value={backupHour}
                                            onChange={e => {
                                                const h = e.target.value;
                                                setBackupHour(h);
                                                saveSettings({ autoBackupTime: `${h}:${backupMinute}` });
                                            }}
                                        >
                                            {hourOptions.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">:</span>
                                        <select
                                            className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                            value={backupMinute}
                                            onChange={e => {
                                                const m = e.target.value;
                                                setBackupMinute(m);
                                                saveSettings({ autoBackupTime: `${backupHour}:${m}` });
                                            }}
                                        >
                                            {minuteOptions.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                        <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">Türkiye saati</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
                                        Hedef
                                    </span>
                                    <select
                                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none"
                                        value={telegramConfig.autoBackupTarget || 'telegram'}
                                        onChange={e =>
                                            saveSettings({
                                                autoBackupTarget: e.target
                                                    .value as TelegramConfig['autoBackupTarget'],
                                            })
                                        }
                                    >
                                        <option value="telegram">Telegram</option>
                                        <option value="local">İndirilebilir Dosya</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="space-y-4 pt-4">
                        {!user.isDemo && !showDeleteConfirm && (
                            <button onClick={() => setShowDeleteConfirm(true)} className="w-full bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-100 dark:border-red-900/20 hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Eraser size={16} /> Tüm Verileri Sil</button>
                        )}
                        {showDeleteConfirm && (
                            <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-3xl border border-red-200 dark:border-red-900/50 space-y-4 animate-pulse">
                                <p className="text-xs text-red-600 dark:text-red-300 font-black uppercase tracking-tighter">DİKKAT: Kalıcı Silme İşlemi</p>
                                <input type="password" placeholder="Onay için hesap şifreniz" className="w-full px-4 py-3 border border-red-200 dark:border-red-800 bg-white dark:bg-black/20 dark:text-white rounded-xl text-sm outline-none" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={() => {setShowDeleteConfirm(false); setDeletePassword('');}} className="flex-1 bg-white dark:bg-black/40 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10">İptal</button>
                                    <button onClick={handleDeleteAllData} disabled={deleteLoading || !deletePassword} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-black uppercase transition-colors">{deleteLoading ? 'Bekleyin...' : 'Hepsini Sil'}</button>
                                </div>
                            </div>
                        )}
                        <button onClick={handleLogout} className="w-full bg-slate-800 dark:bg-white/10 hover:bg-slate-900 text-white dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg"><LogOut size={18} /> Güvenli Çıkış Yap</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;