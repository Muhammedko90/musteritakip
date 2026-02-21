import React, { useState, useRef } from 'react';
import { Settings, X, Download, Upload, MessageSquare, Palette, Sun, Moon, LogOut, Eraser, Check, Plus, Trash } from 'lucide-react';
import { signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { THEME_COLORS } from '../../constants';
import { UserProfile, TelegramConfig, Note, StickyNote, ThemeMode, CustomFieldDef } from '../../types';
import { formatDateKey } from '../../utils/helpers';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    telegramConfig: TelegramConfig;
    saveSettings: (config: TelegramConfig) => void;
    themeMode: ThemeMode;
    toggleTheme: () => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    notes: Note[];
    stickyNotes: StickyNote[];
    setNotes: (n: Note[]) => void;
    setStickyNotes: (n: StickyNote[]) => void;
    customFields: CustomFieldDef[];
    setCustomFields: (fields: CustomFieldDef[]) => void;
}

const SettingsModal: React.FC<Props> = ({ 
    isOpen, onClose, user, telegramConfig, saveSettings, themeMode, toggleTheme, 
    accentColor, setAccentColor, notes, stickyNotes, setNotes, setStickyNotes,
    customFields, setCustomFields
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [newFieldLabel, setNewFieldLabel] = useState('');

    const activeTheme = THEME_COLORS[accentColor] || THEME_COLORS.blue;

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
            <div className={`bg-white ${activeTheme.darkCard} rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto transition-colors duration-300`} onClick={e => e.stopPropagation()}>
                <div className={`bg-slate-800 dark:bg-black/40 p-5 flex justify-between items-center text-white sticky top-0 z-10 backdrop-blur-md`}>
                    <h3 className="font-bold text-xl flex items-center gap-2"><Settings size={22} /> Ayarlar</h3>
                    <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={22} /></button>
                </div>
                <div className="p-6 space-y-8">

                    {/* Custom Fields Section */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><Plus size={16}/></div> 
                            Özel Alanlar
                        </h4>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Alan adı (Örn: Plaka, Ücret)" className="flex-1 px-3 py-2 border rounded-xl text-sm bg-white dark:bg-black/20 dark:border-white/10 dark:text-white outline-none" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} />
                            <button onClick={addCustomField} className="bg-green-500 text-white p-2 rounded-xl font-bold text-sm">Ekle</button>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {customFields.map(field => (
                                <div key={field.id} className="flex justify-between items-center bg-slate-50 dark:bg-black/20 p-2 px-3 rounded-lg border border-slate-100 dark:border-white/5">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{field.label}</span>
                                    <button onClick={() => removeCustomField(field.id)} className="text-red-400 hover:text-red-500"><Trash size={14}/></button>
                                </div>
                            ))}
                            {customFields.length === 0 && <p className="text-xs text-slate-400 text-center italic">Henüz özel alan eklenmemiş.</p>}
                        </div>
                    </div>
                    
                    {/* Data Backup Section */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Download size={16}/></div> 
                            Veri Yedekleme
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={downloadBackup} className="bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-black/30 p-3 rounded-2xl font-bold flex flex-col items-center gap-2 text-xs border border-slate-200 dark:border-white/5 transition-all text-slate-700 dark:text-slate-300">
                                <Download size={24} className="text-blue-500 mb-1"/> Yedek İndir
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-black/30 p-3 rounded-2xl font-bold flex flex-col items-center gap-2 text-xs border border-slate-200 dark:border-white/5 transition-all text-slate-700 dark:text-slate-300">
                                {restoreLoading ? <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-1"></div> : <Upload size={24} className="text-purple-500 mb-1"/>} Yedekten Yükle
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleRestoreBackup} className="hidden" accept=".json" />
                        </div>
                    </div>

                    {/* Telegram Section */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-2 flex items-center gap-2">
                             <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><MessageSquare size={16}/></div>
                             Telegram Botu
                        </h4>
                        <div className="space-y-3">
                            <div><label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Bot Token</label><input type="text" className="w-full px-4 py-3 border rounded-xl text-sm bg-white dark:bg-black/20 dark:border-white/10 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400" value={telegramConfig.botToken} onChange={e => saveSettings({...telegramConfig, botToken: e.target.value})} /></div>
                            <div><label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Chat ID</label><input type="text" className="w-full px-4 py-3 border rounded-xl text-sm bg-white dark:bg-black/20 dark:border-white/10 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400" value={telegramConfig.chatId} onChange={e => saveSettings({...telegramConfig, chatId: e.target.value})} /></div>
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Bot Aktif</span>
                                <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={telegramConfig.enabled} onChange={e => saveSettings({...telegramConfig, enabled: e.target.checked})} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div></label>
                            </div>
                        </div>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b dark:border-white/10 pb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg"><Palette size={16}/></div> 
                            Görünüm
                        </h4>
                        
                        <div className="bg-slate-100 dark:bg-black/20 p-1.5 rounded-2xl flex relative cursor-pointer shadow-inner">
                            {/* Animated Background Slide */}
                            <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-white/10 rounded-xl shadow-sm transition-all duration-300 ease-spring ${themeMode === 'dark' ? 'translate-x-full left-1.5' : 'left-1.5'}`}></div>
                            
                            <button onClick={() => themeMode === 'dark' && toggleTheme()} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold relative z-10 transition-colors duration-300 ${themeMode === 'light' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300'}`}>
                                <Sun size={18} className={`transition-transform duration-300 ${themeMode === 'light' ? 'text-orange-500 scale-110' : 'scale-90 opacity-50'}`} /> 
                                Aydınlık
                            </button>
                            <button onClick={() => themeMode === 'light' && toggleTheme()} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold relative z-10 transition-colors duration-300 ${themeMode === 'dark' ? 'text-white' : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300'}`}>
                                <Moon size={18} className={`transition-transform duration-300 ${themeMode === 'dark' ? 'text-blue-400 -rotate-12 scale-110' : 'scale-90 opacity-50'}`} />
                                Karanlık
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {Object.keys(THEME_COLORS).map(key => {
                                const theme = THEME_COLORS[key];
                                const isActive = accentColor === key;
                                return (
                                    <button 
                                        key={key} 
                                        onClick={() => setAccentColor(key)} 
                                        className={`group relative p-3 rounded-2xl border-2 transition-all duration-300 flex items-center gap-3 overflow-hidden ${isActive ? `border-${key}-500 bg-${key}-50 dark:bg-white/10` : 'border-transparent bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-black/30'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} shadow-md group-hover:scale-110 transition-transform flex items-center justify-center text-white shrink-0`}>
                                            {isActive && <Check size={18} strokeWidth={3} className="animate-[scaleIn_0.2s_ease-out]" />}
                                        </div>
                                        <div className="flex flex-col items-start min-w-0">
                                            <span className={`text-xs font-extrabold truncate w-full text-left ${isActive ? 'text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{theme.name}</span>
                                            <span className={`text-[10px] font-medium opacity-70 ${isActive ? `text-${key}-700 dark:text-${key}-300` : 'text-slate-400'}`}>
                                                {isActive ? 'Seçili' : 'Uygula'}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                        {!user.isDemo && !showDeleteConfirm && (
                            <button onClick={() => setShowDeleteConfirm(true)} className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-red-100 dark:border-red-900/30 transition-all"><Eraser size={16} /> Tüm Verileri Sil</button>
                        )}
                        {showDeleteConfirm && (
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-900/50 space-y-3 animate-pulse">
                                <p className="text-xs text-red-600 dark:text-red-300 font-bold">DİKKAT: Veriler silinecek.</p>
                                <input type="password" placeholder="Hesap Şifresi" className="w-full px-4 py-2 border border-red-200 dark:border-red-800 bg-white dark:bg-black/20 dark:text-white rounded-lg text-sm outline-none" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={() => {setShowDeleteConfirm(false); setDeletePassword('');}} className="flex-1 bg-white dark:bg-black/20 text-slate-600 dark:text-slate-300 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-white/10">İptal</button>
                                    <button onClick={handleDeleteAllData} disabled={deleteLoading || !deletePassword} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-xs font-bold transition-colors">{deleteLoading ? 'Siliniyor...' : 'Onayla'}</button>
                                </div>
                            </div>
                        )}
                        <button onClick={handleLogout} className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-black/20 dark:hover:bg-black/30 text-slate-600 dark:text-slate-300 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><LogOut size={18} /> Çıkış Yap</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;