import React, { useState } from 'react';
import { Calendar, CheckCircle, Trash2, Edit3, Undo2, ExternalLink, AlertCircle, ChevronDown, ChevronUp, ListTodo, History, Clock } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Note, ThemeColor } from '../types';
import { formatDateKey } from '../utils/helpers';

interface Props {
    notes: Note[];
    activeTheme: ThemeColor;
    handleToggleComplete: (e: React.MouseEvent, id: number) => void;
    handleDeleteNote: (e: React.MouseEvent, id: number) => void;
    openEditModal: (note: Note) => void;
    handleDragStart: (e: React.DragEvent, id: number) => void;
}

const KanbanView: React.FC<Props> = ({ notes, activeTheme, handleToggleComplete, handleDeleteNote, openEditModal, handleDragStart }) => {
    const todayStr = formatDateKey(new Date());

    // Initial state: Overdue expanded, others collapsed
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        overdue: true,
        active: false,
        completed: false
    });

    const pending = notes.filter(n => !n.completed && n.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const overdue = notes.filter(n => !n.completed && n.date < todayStr).sort((a, b) => a.date.localeCompare(b.date));
    const done = notes.filter(n => n.completed).sort((a,b) => b.date.localeCompare(a.date));

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const addToGoogleCalendar = (note: Note) => {
        const startDateTime = `${note.date}T${note.time}:00`;
        const startDate = new Date(startDateTime);
        const endDateTime = new Date(startDate.getTime() + 60*60000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const formattedStart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(note.customer)}&details=${encodeURIComponent(note.content)}&dates=${formattedStart}/${endDateTime}`;
        window.open(url, '_blank');
    };
    
    const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

    // Reusable Row Component
    const NoteRow = ({ index, style, data }: any) => {
        const note = data[index];
        const isOverdue = !note.completed && note.date < todayStr;

        return (
            <div style={{ ...style, paddingBottom: 10, paddingRight: 8 }}>
                <div 
                    draggable={!note.completed}
                    onDragStart={(e) => handleDragStart(e, note.id)}
                    className={`bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-dark-border flex gap-3 group hover:shadow-md transition-all relative overflow-hidden h-full ${note.completed ? 'opacity-70' : ''}`}
                >
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${note.completed ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500 animate-pulse' : 'bg-orange-400'}`}></div>
                    <div className="flex-1 pl-2 flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 ${note.completed ? 'bg-emerald-50 text-emerald-600' : isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{note.time}</div>
                            <div className={`font-bold text-lg leading-tight truncate ${note.completed ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{note.customer}</div>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{note.content}</div>
                        <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-2 font-bold">
                            <Calendar size={12}/> {new Date(note.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                            {isOverdue && <span className="text-rose-500 flex items-center gap-1 uppercase tracking-tighter"><AlertCircle size={10}/> Gecikmiş</span>}
                        </div>
                    </div>

                    {/* FIXED ACTION BUTTONS */}
                    <div className="flex items-center gap-1 border-l border-slate-100 dark:border-slate-700 pl-3 ml-2" onMouseDown={stopPropagation}>
                        <div className="flex flex-col sm:flex-row gap-1">
                            {!note.completed && (
                                <button
                                    type="button"
                                    onClick={() => addToGoogleCalendar(note)}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                    title="Takvime Ekle"
                                >
                                    <ExternalLink size={18}/>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={(e) => handleToggleComplete(e, note.id)}
                                className={`p-2 rounded-xl transition-all ${note.completed ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 hover:text-green-500 hover:bg-green-50'}`}
                                title={note.completed ? "Geri Al" : "Tamamla"}
                            >
                                {note.completed ? <Undo2 size={18}/> : <CheckCircle size={18}/>}
                            </button>
                            {!note.completed && (
                                <button
                                    type="button"
                                    onClick={() => openEditModal(note)}
                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                                    title="Düzenle"
                                >
                                    <Edit3 size={18}/>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={(e) => handleDeleteNote(e, note.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                title="Sil"
                            >
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const Section = ({ id, title, icon: Icon, color, data, isOpen }: any) => (
        <div className="bg-slate-100/50 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-dark-border overflow-hidden flex flex-col transition-all duration-300 shadow-sm mb-4">
            <button
                onClick={() => toggleSection(id)}
                className={`w-full p-5 flex items-center justify-between transition-all hover:bg-white/50 dark:hover:bg-white/5 ${isOpen ? 'border-b border-slate-200 dark:border-white/5 bg-white/30 dark:bg-black/10' : ''}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}><Icon size={20}/></div>
                    <div className="text-left">
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{data.length} KAYIT BULUNUYOR</p>
                    </div>
                </div>
                <div className="text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-white/5 transition-transform">
                    {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </div>
            </button>

            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'h-[400px] opacity-100' : 'h-0 opacity-0'} overflow-hidden`}>
                <div className="p-4 h-full">
                    {data.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 opacity-60">
                            <Icon size={40} className="mb-2 opacity-20"/>
                            <p className="text-sm font-bold">Bu kategoride kayıt bulunmuyor.</p>
                        </div>
                    ) : (
                        <AutoSizer>
                            {({ height, width }: any) => (
                                <List
                                    height={height}
                                    width={width}
                                    itemCount={data.length}
                                    itemSize={115}
                                    itemData={data}
                                    className="custom-scrollbar"
                                >
                                    {NoteRow}
                                </List>
                            )}
                        </AutoSizer>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full animate-fade-in pb-10">
            {/* 1. TOP: Overdue Appointments */}
            <Section
                id="overdue"
                title="Gecikmiş Randevular"
                icon={Clock}
                color="bg-rose-500"
                data={overdue}
                isOpen={expandedSections.overdue}
            />

            {/* 2. MIDDLE: All Active Appointments (Initially Closed) */}
            <Section
                id="active"
                title="Tüm Aktif Randevular"
                icon={ListTodo}
                color="bg-orange-500"
                data={pending}
                isOpen={expandedSections.active}
            />

            {/* 3. BOTTOM: Completed Appointments (Initially Closed) */}
            <Section
                id="completed"
                title="Tamamlananlar"
                icon={History}
                color="bg-emerald-500"
                data={done}
                isOpen={expandedSections.completed}
            />
        </div>
    );
};

export default KanbanView;