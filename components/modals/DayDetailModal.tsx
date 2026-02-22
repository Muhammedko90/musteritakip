import React, { useState, useMemo, useEffect } from 'react';
import { CalendarDays, X, Plus, CheckCircle, Edit3, Trash2, Calendar, Repeat, ExternalLink, UserPlus, ListTodo, AlertCircle } from 'lucide-react';
import { Note, ThemeColor, CustomFieldDef } from '../../types';
import { QUICK_DESCRIPTIONS } from '../../constants';
import { formatDateKey } from '../../utils/helpers';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    notes: Note[];
    activeTheme: ThemeColor;
    accentColor: string;
    onAddNote: (note: Note, recurrence: string) => void;
    onToggleComplete: (e: React.MouseEvent, id: number) => void;
    onDeleteNote: (e: React.MouseEvent, id: number) => void;
    onEditNote: (note: Note) => void;
    customFields: CustomFieldDef[];
}

const DayDetailModal: React.FC<Props> = ({ 
    isOpen, onClose, selectedDate, notes, activeTheme, accentColor,
    onAddNote, onToggleComplete, onDeleteNote, onEditNote, customFields
}) => {
    const [newNote, setNewNote] = useState({ customer: '', content: '', time: '09:00' });
    const [customValues, setCustomValues] = useState<Record<string, string>>({});
    const [recurrence, setRecurrence] = useState<string>('none');
    
    const todayStr = useMemo(() => formatDateKey(new Date()), []);

    // Handle Escape Key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    const selectedDayNotes = useMemo(() => {
        const key = formatDateKey(selectedDate);
        return notes.filter(n => n.date === key).sort((a,b) => a.time.localeCompare(b.time));
    }, [notes, selectedDate]);

    const uniqueCustomers = useMemo(() => {
        const counts: Record<string, number> = {};
        notes.forEach(n => { if (n.customer) counts[n.customer] = (counts[n.customer] || 0) + 1; });
        return Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
    }, [notes]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.customer) return;
        const noteData: Note = {
            id: Date.now(),
            customer: newNote.customer,
            content: newNote.content || "Planlı Randevu",
            time: newNote.time,
            date: formatDateKey(selectedDate),
            completed: false,
            createdAt: new Date().toISOString(),
            customValues: customValues
        };
        onAddNote(noteData, recurrence);
        setNewNote({ customer: '', content: '', time: '09:00' });
        setCustomValues({});
        setRecurrence('none');
    };

    const addToGoogleCalendar = (note: Note) => {
        const startDateTime = `${note.date}T${note.time}:00`;
        const endDateTime = new Date(new Date(startDateTime).getTime() + 60*60000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const formattedStart = new Date(startDateTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(note.customer)}&details=${encodeURIComponent(note.content)}&dates=${formattedStart}/${endDateTime}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className={`bg-white ${activeTheme.darkCard} rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-[scaleIn_0.2s_ease-out] transition-colors duration-300`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={`${activeTheme.primary} p-5 text-white flex justify-between items-center shadow-lg relative overflow-hidden shrink-0`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
                    <div className="flex items-center gap-3 z-10">
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm"><CalendarDays size={20}/></div>
                        <div><h3 className="font-bold text-xl leading-none">{selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</h3><p className="text-white/80 text-xs mt-1 font-medium">{selectedDate.toLocaleDateString('tr-TR', { weekday: 'long' })}</p></div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors z-10"><X size={20} /></button>
                </div>

                {/* Split Content Body */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* LEFT SIDE: Form */}
                    <form onSubmit={handleSubmit} className="w-full md:w-[45%] p-6 bg-slate-50 dark:bg-black/20 border-r border-slate-200 dark:border-white/5 space-y-4 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                            <UserPlus size={18} className={activeTheme.text}/>
                            <h4 className="text-xs font-bold uppercase tracking-wider">Yeni Randevu Ekle</h4>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 relative">
                                <label className="text-[10px] font-bold text-slate-400 ml-1 mb-1 block uppercase tracking-tighter">Müşteri Adı</label>
                                <input required type="text" list="customer-list-detail" placeholder="İsim soyisim..." className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-slate-800 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none ring-slate-200 dark:ring-slate-700" style={{'--tw-ring-color': `var(--theme-${accentColor})`} as React.CSSProperties} value={newNote.customer} onChange={e => setNewNote({...newNote, customer: e.target.value})} />
                                <datalist id="customer-list-detail">{uniqueCustomers.map(c => (<option key={c} value={c} />))}</datalist>
                            </div>
                            <div className="w-full sm:w-32">
                                <label className="text-[10px] font-bold text-slate-400 ml-1 mb-1 block uppercase tracking-tighter">Saat</label>
                                <input type="time" className="w-full px-3 py-3 text-sm border-0 bg-white dark:bg-slate-800 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none text-center font-bold" value={newNote.time} onChange={e => setNewNote({...newNote, time: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 ml-1 mb-1 block uppercase tracking-tighter">İşlem Detayı</label>
                            <textarea placeholder="Yapılacak işlem..." rows={2} className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-slate-800 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none resize-none" value={newNote.content} onChange={e => setNewNote({...newNote, content: e.target.value})}></textarea>
                        </div>

                        {/* Custom Fields */}
                        {customFields.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                                {customFields.map(field => (
                                    <div key={field.id}>
                                        <label className="text-[10px] font-bold text-slate-400 ml-1 mb-1 block uppercase">{field.label}</label>
                                        <input
                                            type="text"
                                            placeholder="..."
                                            className="w-full px-3 py-3 text-xs border-0 bg-white dark:bg-slate-800 dark:text-white rounded-xl shadow-sm outline-none"
                                            value={customValues[field.id] || ''}
                                            onChange={e => setCustomValues({...customValues, [field.id]: e.target.value})}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 ml-1 mb-1 block uppercase tracking-tighter">Tekrarlama</label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                                <Repeat size={16} className="text-slate-400"/>
                                <select className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-bold outline-none w-full cursor-pointer" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                                    <option value="none" className="dark:bg-slate-800">Tekrarlama Yok</option>
                                    <option value="monthly" className="dark:bg-slate-800">Ayda 1 Tekrar</option>
                                    <option value="yearly" className="dark:bg-slate-800">Yılda 1 Tekrar</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {QUICK_DESCRIPTIONS.map(desc => (
                                <button key={desc} type="button" onClick={() => setNewNote({...newNote, content: desc})} className={`text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-3 py-2 rounded-lg transition-all text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700`}>{desc}</button>
                            ))}
                        </div>

                        <button type="submit" className={`w-full ${activeTheme.primary} ${activeTheme.hover} text-white py-4 rounded-2xl text-sm font-bold ${activeTheme.shadow} shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] mt-4`}><Plus size={20}/> Randevu Oluştur</button>
                    </form>

                    {/* RIGHT SIDE: List */}
                    <div className="w-full md:w-[55%] p-6 overflow-y-auto space-y-4 bg-white dark:bg-transparent custom-scrollbar">
                        <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                            <ListTodo size={18} className={activeTheme.text}/>
                            <h4 className="text-xs font-bold uppercase tracking-wider">Randevular ({selectedDayNotes.length})</h4>
                        </div>

                        {selectedDayNotes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-12 text-slate-400">
                                <div className="bg-slate-100 dark:bg-white/5 p-6 rounded-full mb-4"><Calendar size={48} className="opacity-20"/></div>
                                <p className="text-sm font-bold tracking-wide">Kayıt bulunmuyor.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {selectedDayNotes.map(note => {
                                    const isOverdue = !note.completed && note.date < todayStr;
                                    return (
                                        <div key={note.id} className={`group p-4 border rounded-2xl flex flex-col gap-3 hover:shadow-xl transition-all duration-300 border-l-4 ${note.completed ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-400 border-slate-100 dark:border-white/5' : isOverdue ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-500 border-rose-200 dark:border-rose-900/30 ring-2 ring-rose-500/20' : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-white/5'}`} style={{ borderLeftColor: note.completed ? '#10b981' : isOverdue ? '#ef4444' : `var(--theme-${accentColor})` }}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className={`${isOverdue ? 'bg-rose-100 text-rose-700' : `${activeTheme.light} ${activeTheme.text}`} dark:bg-white/10 dark:text-slate-300 text-[10px] px-2 py-1 rounded-lg font-black`}>{note.time}</span>
                                                        <h4 className={`font-extrabold text-base truncate ${note.completed ? 'line-through text-slate-400' : isOverdue ? 'text-rose-800 dark:text-rose-200' : 'text-slate-800 dark:text-slate-100'}`}>{note.customer}</h4>
                                                    </div>
                                                    <p className={`text-xs font-medium pl-1 leading-relaxed ${isOverdue ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-slate-500 dark:text-slate-400'}`}>{note.content}</p>
                                                    {isOverdue && <div className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 animate-pulse"><AlertCircle size={12}/> Gecikmiş Randevu</div>}
                                                </div>
                                                <div className="flex gap-1.5 pl-2">
                                                    <button onClick={() => addToGoogleCalendar(note)} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-blue-500 shadow-sm transition-all"><ExternalLink size={16}/></button>
                                                    <button onClick={(e)=>onToggleComplete(e, note.id)} className={`p-2 rounded-xl shadow-sm transition-all ${note.completed ? 'bg-green-100 text-green-600 dark:bg-green-900/40' : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-green-500'}`}><CheckCircle size={16}/></button>
                                                    <button onClick={() => onEditNote(note)} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-amber-500 shadow-sm transition-all"><Edit3 size={16}/></button>
                                                    <button onClick={(e)=>onDeleteNote(e, note.id)} className="p-2 rounded-xl bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 shadow-sm transition-all"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                            {note.customValues && Object.keys(note.customValues).length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                                    {Object.entries(note.customValues).map(([key, val]) => {
                                                        const fieldLabel = customFields.find(f => f.id === key)?.label || 'Alan';
                                                        return <span key={key} className="text-[9px] bg-white dark:bg-black/30 px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 font-bold border border-slate-50 dark:border-white/5"><b>{fieldLabel.toUpperCase()}:</b> {val}</span>
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DayDetailModal;
