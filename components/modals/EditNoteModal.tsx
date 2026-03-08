import React, { useMemo, useState } from 'react';
import { Edit3, X } from 'lucide-react';
import { Note, ThemeColor } from '../../types';

export type EditScope = 'single' | 'series';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    note: Note;
    isPartOfSeries: boolean;
    onUpdate: (note: Note, scope: EditScope) => void;
    activeTheme: ThemeColor;
    accentColor: string;
}

const EditNoteModal: React.FC<Props> = ({ isOpen, onClose, note, isPartOfSeries, onUpdate, activeTheme, accentColor }) => {
    const [formData, setFormData] = useState<Note>({ ...note });
    const [scope, setScope] = useState<EditScope>('single');

    const effectiveScope = useMemo<EditScope>(() => (isPartOfSeries ? scope : 'single'), [isPartOfSeries, scope]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate(formData, effectiveScope);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className={`bg-white ${activeTheme.darkCard} rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors duration-300`} onClick={e => e.stopPropagation()}>
                <div className={`${activeTheme.primary} p-5 text-white flex justify-between items-center shadow-md`}><h3 className="font-bold text-lg flex items-center gap-2"><Edit3 size={20}/> Kaydı Düzenle</h3><button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full"><X size={20} /></button></div>
                <form onSubmit={handleSubmit} className="p-6 bg-slate-50 dark:bg-transparent space-y-4">
                    {isPartOfSeries && (
                        <div className="bg-white/80 dark:bg-black/20 border border-slate-200 dark:border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Düzenleme Kapsamı</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setScope('single')}
                                    className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${effectiveScope === 'single' ? `${activeTheme.primary} text-white shadow-sm` : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                                >
                                    Sadece Bu
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScope('series')}
                                    className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${effectiveScope === 'series' ? `${activeTheme.primary} text-white shadow-sm` : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                                >
                                    Tüm Seri
                                </button>
                            </div>
                            {effectiveScope === 'series' && (
                                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                    Seri düzenlemede <b>tarih</b> değişmez; müşteri, açıklama ve saat seriye uygulanır.
                                </div>
                            )}
                        </div>
                    )}
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Müşteri Adı</label><input type="text" className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none" style={{'--tw-ring-color': `var(--theme-${accentColor})`} as React.CSSProperties} value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Yapılacak İşlem</label><textarea rows={3} className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none resize-none" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Tarih</label><input type="date" disabled={effectiveScope === 'series'} className={`w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none ${effectiveScope === 'series' ? 'opacity-60 cursor-not-allowed' : ''}`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Saat</label><input type="time" className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} /></div>
                    </div>
                    <button type="submit" className={`w-full ${activeTheme.primary} ${activeTheme.hover} text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02]`}>Değişiklikleri Kaydet</button>
                </form>
            </div>
        </div>
    );
};

export default EditNoteModal;