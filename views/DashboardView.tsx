import React from 'react';
import {
    Users, CheckCircle, Clock, SendHorizonal, StickyNote as StickyIcon,
    CalendarDays, Pin, Check
} from 'lucide-react';
import { Note, ThemeColor, StickyNote } from '../types';

interface Props {
    notes: Note[];
    stickyNotes: StickyNote[];
    activeTheme: ThemeColor;
    handleSendTelegram: (type: 'notes' | 'appointments' | 'completed' | 'week' | 'backup') => void;
}

const DashboardView: React.FC<Props> = ({ notes, stickyNotes, activeTheme, handleSendTelegram }) => {
    const stats = React.useMemo(() => {
        const total = notes.length;
        const completed = notes.filter(n => n.completed).length;
        return { total, completed, pending: total - completed };
    }, [notes]);

    const pinnedNotes = React.useMemo(() => {
        return stickyNotes.filter(n => n.pinned && !n.archived);
    }, [stickyNotes]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className={`p-4 rounded-2xl ${activeTheme.light} ${activeTheme.text} dark:bg-slate-800 dark:text-white`}><Users size={28}/></div>
                    <div><p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Toplam Kayıt</p><p className="text-4xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p></div>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl"><CheckCircle size={28}/></div>
                    <div><p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Tamamlanan</p><p className="text-4xl font-bold text-slate-800 dark:text-slate-100">{stats.completed}</p></div>
                </div>
                <div className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-dark-border flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl"><Clock size={28}/></div>
                    <div><p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Bekleyen</p><p className="text-4xl font-bold text-slate-800 dark:text-slate-100">{stats.pending}</p></div>
                </div>
            </div>

            {/* Pinned Notes Section */}
            {pinnedNotes.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 px-1">
                        <Pin size={20} className="text-blue-500 fill-blue-500"/> Sabitlenmiş Notlar
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pinnedNotes.map(note => (
                            <div key={note.id}
                                 className="p-5 rounded-[2rem] border border-slate-200 dark:border-dark-border shadow-sm flex flex-col gap-3 min-h-[160px] relative overflow-hidden group"
                                 style={{ backgroundColor: note.color?.startsWith('#') ? `${note.color}15` : undefined }}
                            >
                                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: note.color?.startsWith('#') ? note.color : undefined }}></div>
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black text-slate-800 dark:text-slate-100 leading-tight pr-6">{note.title || "Başlıksız Not"}</h4>
                                    <Pin size={14} className="text-blue-500 absolute top-5 right-5"/>
                                </div>
                                <div className="space-y-1.5 flex-1">
                                    {note.blocks.slice(0, 4).map(block => (
                                        <div key={block.id} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {block.type === 'todo' && (
                                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${block.done ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                    {block.done && <Check size={10} className="text-white"/>}
                                                </div>
                                            )}
                                            <span className={`truncate ${block.done ? 'line-through opacity-50' : ''}`}>{block.content}</span>
                                        </div>
                                    ))}
                                    {note.blocks.length > 4 && <p className="text-[10px] text-slate-400 mt-1">+{note.blocks.length - 4} satır daha...</p>}
                                </div>
                                {note.reminderDate && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                        <Clock size={10}/> Hatırlatıcı: {new Date(note.reminderDate).toLocaleDateString('tr-TR')} {note.reminderTime}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Telegram Actions */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-dark-border">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2 px-1">
                    <SendHorizonal size={22} className="text-blue-500"/> Telegram Hızlı İşlemler
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button onClick={() => handleSendTelegram('notes')} className="flex flex-col items-center justify-center gap-3 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-blue-100/50 transition-all border border-blue-100 dark:border-blue-900/20 group">
                        <div className="p-3 bg-white dark:bg-blue-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><StickyIcon size={24}/></div>
                        Notlarımı Gönder
                    </button>
                    <button onClick={() => handleSendTelegram('appointments')} className="flex flex-col items-center justify-center gap-3 bg-purple-50/50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-purple-100/50 transition-all border border-purple-100 dark:border-purple-900/20 group">
                        <div className="p-3 bg-white dark:bg-purple-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><CalendarDays size={24}/></div>
                        Bekleyen Randevular
                    </button>
                    <button onClick={() => handleSendTelegram('completed')} className="flex flex-col items-center justify-center gap-3 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-emerald-100/50 transition-all border border-emerald-100 dark:border-emerald-900/20 group">
                        <div className="p-3 bg-white dark:bg-emerald-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><CheckCircle size={24}/></div>
                        Tamamlanan İşler
                    </button>
                    <button onClick={() => handleSendTelegram('backup')} className="flex flex-col items-center justify-center gap-3 bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-orange-100/50 transition-all border border-orange-100 dark:border-orange-900/20 group">
                        <div className="p-3 bg-white dark:bg-orange-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><SendHorizonal size={24}/></div>
                        Telegram'a Yedekle
                    </button>
                </div>

                <div className="mt-8 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        Bot üzerinden <b>/id</b> veya <b>/notlarım</b> komutlarını kullanabilirsiniz.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
