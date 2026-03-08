import React from 'react';
import {
    Users, CheckCircle, Clock, SendHorizonal,
    CalendarDays, ListTodo
} from 'lucide-react';
import { Note, ThemeColor } from '../types';

interface Props {
    notes: Note[];
    activeTheme: ThemeColor;
    handleSendTelegram: (type: 'notes' | 'appointments' | 'completed' | 'week' | 'backup' | 'all_pending') => void;
}

const DashboardView: React.FC<Props> = ({ notes, activeTheme, handleSendTelegram }) => {
    const stats = React.useMemo(() => {
        const total = notes.length;
        const completed = notes.filter(n => n.completed).length;
        return { total, completed, pending: total - completed };
    }, [notes]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-2">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Genel Bakış</h2>
            </div>

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

            {/* Telegram Actions */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-dark-border">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2 px-1 uppercase tracking-tighter">
                    <SendHorizonal size={22} className="text-blue-500"/> Telegram Hızlı İşlemler
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <button onClick={() => handleSendTelegram('notes')} className="flex flex-col items-center justify-center gap-3 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-blue-100/50 transition-all border border-blue-100 dark:border-blue-900/20 group text-center">
                        <div className="p-3 bg-white dark:bg-blue-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><SendHorizonal size={24}/></div>
                        Notlarımı Gönder
                    </button>
                    <button onClick={() => handleSendTelegram('appointments')} className="flex flex-col items-center justify-center gap-3 bg-purple-50/50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-purple-100/50 transition-all border border-purple-100 dark:border-purple-900/20 group text-center">
                        <div className="p-3 bg-white dark:bg-purple-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><CalendarDays size={24}/></div>
                        Bugün & Yarın
                    </button>
                    <button onClick={() => handleSendTelegram('all_pending')} className="flex flex-col items-center justify-center gap-3 bg-rose-50/50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-rose-100/50 transition-all border border-rose-100 dark:border-rose-900/20 group text-center">
                        <div className="p-3 bg-white dark:bg-rose-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><ListTodo size={24}/></div>
                        Tüm Bekleyenler
                    </button>
                    <button onClick={() => handleSendTelegram('week')} className="flex flex-col items-center justify-center gap-3 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-indigo-100/50 transition-all border border-indigo-100 dark:border-indigo-900/20 group text-center">
                        <div className="p-3 bg-white dark:bg-indigo-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><Users size={24}/></div>
                        Haftalık Liste
                    </button>
                    <button onClick={() => handleSendTelegram('completed')} className="flex flex-col items-center justify-center gap-3 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-emerald-100/50 transition-all border border-emerald-100 dark:border-emerald-900/20 group text-center">
                        <div className="p-3 bg-white dark:bg-emerald-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><CheckCircle size={24}/></div>
                        Tamamlananlar
                    </button>
                    <button onClick={() => handleSendTelegram('backup')} className="flex flex-col items-center justify-center gap-3 bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300 p-6 rounded-3xl font-black text-xs uppercase tracking-tighter hover:bg-orange-100/50 transition-all border border-orange-100 dark:border-orange-900/20 group text-center">
                        <div className="p-3 bg-white dark:bg-orange-900/30 rounded-2xl shadow-sm group-hover:scale-110 transition-transform"><SendHorizonal size={24}/></div>
                        Full Yedekle
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