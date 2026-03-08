import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, User, CheckCircle2, Clock, X } from 'lucide-react';
import { Note, ThemeColor } from '../types';
import { formatDateKey } from '../utils/helpers';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    notes: Note[];
    onSelectNote: (note: Note) => void;
    activeTheme: ThemeColor;
    onOpenCustomerCard?: (customer: string) => void;
}

const CommandPalette: React.FC<Props> = ({ isOpen, onClose, notes, onSelectNote, activeTheme, onOpenCustomerCard }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const today = formatDateKey(new Date());
    const lowerQuery = query.toLowerCase();

    const filteredNotes = notes
        .filter(n => {
            const customer = n.customer.toLowerCase();
            const content = n.content.toLowerCase();
            const dateObj = new Date(n.date);
            const displayDate = isNaN(dateObj.getTime())
                ? ''
                : dateObj.toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                  });

            return (
                customer.includes(lowerQuery) ||
                content.includes(lowerQuery) ||
                displayDate.includes(lowerQuery)
            );
        })
        .sort((a, b) => {
            const aOverdue = !a.completed && a.date < today;
            const bOverdue = !b.completed && b.date < today;

            // 1) Gecikmiş (tamamlanmamış ve geçmiş tarihli) randevular en üstte
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            // 2) Kalanları bugüne ve geleceğe göre öne al
            if (a.date >= today && b.date < today) return -1;
            if (a.date < today && b.date >= today) return 1;

            // 3) Aynı gruptakileri kendi içinde sırala
            if (aOverdue && bOverdue) {
                // Gecikmişler kendi içinde eski tarihten yeniye doğru
                return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
            }

            if (a.date >= today && b.date >= today) {
                // Bugün ve sonrası: en yakın tarih/saat en üstte
                return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
            }

            // Geçmiş & tamamlanmış kayıtlar: en yeni geçmiş en üstte
            return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
        })
        .slice(0, 10);
        
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col animate-[scaleIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center p-4 border-b border-slate-100 dark:border-slate-700">
                    <Search className="text-slate-400 mr-3" size={20} />
                    <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Müşteri, not veya tarih ara..." 
                        className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 dark:text-slate-100 placeholder-slate-400"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {query && filteredNotes.length === 0 && (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                            <Search size={40} className="mx-auto mb-3 opacity-20" />
                            <p>Sonuç bulunamadı.</p>
                        </div>
                    )}
                    {filteredNotes.map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => { onSelectNote(note); onClose(); }}
                            className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-l-4 border-transparent hover:border-blue-500 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${note.completed ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    <User size={18}/>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                onOpenCustomerCard && onOpenCustomerCard(note.customer);
                                            }}
                                            className="font-bold text-slate-800 dark:text-slate-200 hover:underline text-left"
                                        >
                                            {note.customer}
                                        </button>
                                        {note.completed ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                                <CheckCircle2 size={10}/> Tamamlandı
                                            </span>
                                        ) : (
                                            (() => {
                                                const isOverdue = note.date < today;
                                                return isOverdue ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                                        <Clock size={10}/> Gecikmiş
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                                        <Clock size={10}/> Bekliyor
                                                    </span>
                                                );
                                            })()
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[250px]">{note.content}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800">
                                <Calendar size={12} className="text-slate-400"/>
                                {formatDate(note.date)} <span className="text-slate-300 dark:text-slate-600">|</span> {note.time}
                            </div>
                        </div>
                    ))}
                    {!query && (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            <Search size={32} className="mx-auto mb-3 opacity-20" />
                            Aramak için müşteri adı veya işlem içeriği yazın...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;