import React, { useState } from 'react';
import { Plus, User, CheckCircle, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3X3, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { Note, ThemeColor } from '../types';
import { getDaysInMonth, getFirstDayOfMonth, isSameDay, formatDateKey, getCustomerColor, getStartOfWeek } from '../utils/helpers';

interface Props {
    notes: Note[];
    currentDate: Date;
    setCurrentDate: (d: Date) => void;
    selectedDate: Date;
    setSelectedDate: (d: Date) => void;
    setIsDayDetailModalOpen: (v: boolean) => void;
    handleToggleComplete: (e: React.MouseEvent, id: number) => void;
    handleDragStart: (e: React.DragEvent, id: number) => void;
    handleDrop: (e: React.DragEvent, dateStr: string) => void;
    activeTheme: ThemeColor;
}

const CalendarView: React.FC<Props> = ({ 
    notes, currentDate, setCurrentDate, selectedDate, setSelectedDate, 
    setIsDayDetailModalOpen, handleToggleComplete, handleDragStart, handleDrop, activeTheme 
}) => {
    const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const todayStr = formatDateKey(new Date());

    const upcomingPriority = React.useMemo(() => {
        return notes.filter(n => !n.completed && n.date >= todayStr)
            .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time)))[0] || null;
    }, [notes, todayStr]);

    // --- MONTH VIEW LOGIC ---
    const renderMonthView = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[100px]"></div>);

        for (let i = 1; i <= daysInMonth; i++) {
             const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
             const dateKey = formatDateKey(dayDate);
             const isSelected = isSameDay(dayDate, selectedDate);
             const isToday = isSameDay(dayDate, new Date());
             const isWeekend = dayDate.getDay() === 0;
             const dayNotes = notes.filter(n => n.date === dateKey);
             
             days.push(
                <div key={i} 
                     onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }} 
                     onDragLeave={e => e.currentTarget.classList.remove('drag-over')} 
                     onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleDrop(e, dateKey); }}
                     onClick={() => { setSelectedDate(dayDate); setIsDayDetailModalOpen(true); }} 
                     className={`min-h-[110px] rounded-2xl relative cursor-pointer p-2 flex flex-col transition-all duration-300 group border
                     ${isSelected ? `bg-white dark:bg-slate-800 ring-2 ${activeTheme.ring} shadow-lg scale-[1.02] z-10 border-transparent` : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg hover:-translate-y-1 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}
                     ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}`}>
                     
                     <div className="flex justify-between items-start mb-1.5">
                        <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isToday ? `${activeTheme.primary} text-white shadow-lg shadow-blue-500/30` : isWeekend ? 'text-red-400 bg-red-50 dark:bg-red-900/20' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50'}`}>{i}</span>
                        {dayNotes.length > 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${activeTheme.light} ${activeTheme.text} dark:bg-slate-700 dark:text-white`}>{dayNotes.length}</span>}
                     </div>
                     
                     <div className="flex flex-col gap-1.5 overflow-hidden">
                        {dayNotes.slice(0,2).map(n=> {
                            const isOverdue = !n.completed && n.date < todayStr;
                            return (
                                <div key={n.id} draggable="true" onDragStart={(e) => handleDragStart(e, n.id)}
                                     className={`text-[10px] truncate px-2 py-1 rounded-lg border-l-2 cursor-grab active:cursor-grabbing shadow-sm transition-transform hover:scale-[1.02] ${n.completed ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through border-slate-300' : isOverdue ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-500 font-bold' : getCustomerColor(n.customer)}`}>
                                    <span className="font-bold opacity-75 mr-1">{n.time}</span> {n.customer}
                                </div>
                            );
                        })}
                        {dayNotes.length > 2 && <div className="text-[10px] text-slate-400 pl-1 font-medium">+{dayNotes.length - 2} daha...</div>}
                     </div>
                     
                     <div className={`absolute bottom-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 ${activeTheme.light} ${activeTheme.text} dark:bg-slate-700 dark:text-white`}><Plus size={14} strokeWidth={3} /></div>
                </div>
             );
        }
        return (
            <>
                <div className="grid grid-cols-7 text-center pb-4 px-2">
                    {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, i) => (
                        <div key={day} className="flex justify-center">
                            <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${i >= 5 ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>{day}</span>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2 p-2 bg-slate-50/50 dark:bg-slate-900/20 rounded-b-[2rem] flex-1">
                    {days}
                </div>
            </>
        );
    };

    // --- WEEK VIEW LOGIC ---
    const renderWeekView = () => {
        const startOfWeek = getStartOfWeek(currentDate);
        const weekDays = [];
        for(let i=0; i<7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            weekDays.push(d);
        }

        return (
            <div className="flex flex-1 overflow-hidden rounded-b-[2rem] bg-slate-50/50 dark:bg-slate-900/20">
                <div className="grid grid-cols-7 flex-1 min-w-[800px] overflow-x-auto divide-x divide-slate-100 dark:divide-white/5">
                    {weekDays.map((day) => {
                         const dateKey = formatDateKey(day);
                         const isToday = isSameDay(day, new Date());
                         const dayNotes = notes.filter(n => n.date === dateKey).sort((a,b) => a.time.localeCompare(b.time));
                         const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                         return (
                            <div 
                                key={dateKey}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50/50'); }} 
                                onDragLeave={e => e.currentTarget.classList.remove('bg-blue-50/50')} 
                                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-blue-50/50'); handleDrop(e, dateKey); }}
                                className={`flex flex-col h-full transition-colors ${isToday ? 'bg-blue-50/20 dark:bg-blue-900/10' : 'hover:bg-white dark:hover:bg-slate-800/50'}`}
                            >
                                <div className={`p-3 text-center border-b border-slate-100 dark:border-white/5 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isWeekend ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {day.toLocaleDateString('tr-TR', { weekday: 'short' })}
                                    </div>
                                    <div 
                                        onClick={() => { setSelectedDate(day); setIsDayDetailModalOpen(true); }}
                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold cursor-pointer hover:scale-110 transition-transform ${isToday ? `${activeTheme.primary} text-white shadow-lg` : 'text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 shadow-sm'}`}
                                    >
                                        {day.getDate()}
                                    </div>
                                </div>
                                <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                                    {dayNotes.map(n => {
                                        const isOverdue = !n.completed && n.date < todayStr;
                                        return (
                                            <div
                                                key={n.id}
                                                draggable="true"
                                                onDragStart={(e) => handleDragStart(e, n.id)}
                                                onClick={() => { setSelectedDate(day); setIsDayDetailModalOpen(true); }}
                                                className={`p-2 rounded-xl border text-left cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all group ${n.completed ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60' : isOverdue ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30' : 'bg-white dark:bg-dark-card border-slate-100 dark:border-white/10'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${n.completed ? 'bg-slate-200 text-slate-500' : isOverdue ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : `${activeTheme.light} ${activeTheme.text}`}`}>
                                                        {n.time}
                                                    </span>
                                                    {n.completed ? <CheckCircle size={12} className="text-green-500"/> : isOverdue ? <AlertCircle size={12} className="text-rose-500 animate-pulse"/> : null}
                                                </div>
                                                <div className={`font-bold text-xs truncate mb-0.5 ${n.completed ? 'line-through text-slate-500' : isOverdue ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>{n.customer}</div>
                                                <div className={`text-[10px] truncate ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>{n.content}</div>
                                                {isOverdue && <div className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-rose-500">Gecikmiş Randevu</div>}
                                            </div>
                                        );
                                    })}
                                    <button 
                                        onClick={() => { setSelectedDate(day); setIsDayDetailModalOpen(true); }}
                                        className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                         );
                    })}
                </div>
            </div>
        );
    };

    const handleDateNav = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (calendarMode === 'month') {
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else {
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        }
        setCurrentDate(newDate);
    };

    return (
        <div className={`flex flex-col h-full gap-6 ${isFullscreen ? 'fixed inset-0 z-[100] bg-white dark:bg-slate-900 p-4 md:p-8' : ''}`}>
            {upcomingPriority && !isFullscreen && (
                <div className={`bg-gradient-to-r ${activeTheme.gradient} rounded-3xl p-6 text-white shadow-xl ${activeTheme.shadow} flex items-center justify-between shrink-0 animate-fade-in relative overflow-hidden`}>
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="cursor-pointer flex-1 z-10" onClick={() => { setSelectedDate(new Date(upcomingPriority.date)); setIsDayDetailModalOpen(true); }}>
                        <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-widest mb-2"><User size={14} /> Sıradaki Müşteri</div>
                        <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4"><h2 className="text-3xl font-extrabold tracking-tight">{upcomingPriority.customer}</h2><span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm w-fit">{upcomingPriority.time}</span></div>
                        <p className="text-white/90 text-sm font-medium mt-2 max-w-lg truncate opacity-90">{upcomingPriority.content}</p>
                    </div>
                    <button onClick={(e) => handleToggleComplete(e, upcomingPriority.id)} className="bg-white text-slate-800 hover:scale-110 p-4 rounded-full shadow-lg transition-transform ml-4 group z-10"><CheckCircle className={`w-8 h-8 ${activeTheme.text}`} /></button>
                </div>
            )}
            <div className={`bg-white/50 dark:bg-dark-card/50 backdrop-blur-sm rounded-[2rem] shadow-sm border border-slate-200/50 dark:border-dark-border/50 overflow-hidden flex flex-col flex-1 animate-fade-in ${isFullscreen ? 'bg-white dark:bg-slate-800' : ''}`}>
                <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <h2 className="font-extrabold text-3xl text-slate-800 dark:text-slate-100 capitalize tracking-tight">
                            {calendarMode === 'month' 
                                ? currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) 
                                : `Hafta: ${getStartOfWeek(currentDate).getDate()} - ${new Date(new Date(getStartOfWeek(currentDate)).setDate(getStartOfWeek(currentDate).getDate()+6)).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`
                            }
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex bg-white dark:bg-slate-800 rounded-2xl p-1 gap-1 border border-slate-200 dark:border-dark-border shadow-sm items-center">
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-500 dark:text-slate-400 mr-1"
                                title={isFullscreen ? 'Küçült' : 'Tam Ekran'}
                            >
                                {isFullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
                            </button>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            <button onClick={() => setCalendarMode('month')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${calendarMode === 'month' ? `${activeTheme.primary} text-white shadow-md` : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                <Grid3X3 size={16}/> Ay
                            </button>
                            <button onClick={() => setCalendarMode('week')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${calendarMode === 'week' ? `${activeTheme.primary} text-white shadow-md` : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                <CalendarIcon size={16}/> Hafta
                            </button>
                        </div>

                        <div className="flex bg-white dark:bg-slate-800 rounded-2xl p-1.5 gap-2 border border-slate-200 dark:border-dark-border shadow-sm">
                            <button onClick={() => handleDateNav('prev')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300"><ChevronLeft size={20}/></button>
                            <button onClick={() => setCurrentDate(new Date())} className="text-sm font-bold px-5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300">Bugün</button>
                            <button onClick={() => handleDateNav('next')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-300"><ChevronRight size={20}/></button>
                        </div>
                    </div>
                </div>
                
                {calendarMode === 'month' ? renderMonthView() : renderWeekView()}
            </div>
        </div>
    );
};

export default CalendarView;