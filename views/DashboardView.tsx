import React from 'react';
import { Users, CheckCircle, Clock, SendHorizonal, StickyNote, CalendarDays } from 'lucide-react';
import { Note, ThemeColor } from '../types';

interface Props {
    notes: Note[];
    activeTheme: ThemeColor;
    handleSendTelegram: (type: 'notes' | 'appointments' | 'completed' | 'week') => void;
}

const DashboardView: React.FC<Props> = ({ notes, activeTheme, handleSendTelegram }) => {
    const stats = React.useMemo(() => {
        const total = notes.length;
        const completed = notes.filter(n => n.completed).length;
        return { total, completed, pending: total - completed };
    }, [notes]);

    return (
        <div className="space-y-6 animate-fade-in">
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

            <div className="bg-white dark:bg-dark-card p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-dark-border">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><SendHorizonal size={20} className="text-blue-500"/> Telegram İşlemleri</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={() => handleSendTelegram('notes')} className="flex items-center justify-center gap-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-4 rounded-2xl font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all border border-blue-100 dark:border-blue-900/30">
                        <StickyNote size={20}/> Notlarımı Gönder
                    </button>
                    <button onClick={() => handleSendTelegram('appointments')} className="flex items-center justify-center gap-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 p-4 rounded-2xl font-bold hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all border border-purple-100 dark:border-purple-900/30">
                        <CalendarDays size={20}/> Randevuları Gönder
                    </button>
                    <button onClick={() => handleSendTelegram('completed')} className="flex items-center justify-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle size={20}/> Tamamlananları Gönder
                    </button>
                    <button onClick={() => handleSendTelegram('week')} className="flex items-center justify-center gap-3 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 p-4 rounded-2xl font-bold hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all border border-orange-100 dark:border-orange-900/30">
                        <Users size={20}/> Bu Haftanın Kişileri
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">Bot üzerinden <b>/notlarım</b> yazarak da notlarınıza ulaşabilirsiniz.</p>
            </div>
        </div>
    );
};

export default DashboardView;