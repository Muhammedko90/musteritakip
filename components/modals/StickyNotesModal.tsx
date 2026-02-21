import React, { useState } from 'react';
import { StickyNote as StickyIcon, Plus, X, Maximize2, Minimize2, Trash2, Type, CheckSquare, Check } from 'lucide-react';
import { StickyNote, Block } from '../../types';
import { NOTE_COLORS } from '../../constants';
import AutoResizeTextarea from '../AutoResizeTextarea';
import ConfirmationModal from './ConfirmationModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    notes: StickyNote[];
    onAdd: (note: StickyNote) => void;
    onUpdate: (id: number, updates: Partial<StickyNote>) => void;
    onDelete: (id: number) => void;
}

const StickyNotesModal: React.FC<Props> = ({ isOpen, onClose, notes, onAdd, onUpdate, onDelete }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, noteId: number | null}>({ isOpen: false, noteId: null });

    if (!isOpen) return null;

    const handleAddCard = () => {
        const randomColor = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
        const newNote: StickyNote = {
            id: Date.now(), 
            color: randomColor, 
            title: '', 
            blocks: [{ id: Date.now() + 1, type: 'text', content: '', done: false }] 
        };
        onAdd(newNote);
    };

    const deleteCard = (id: number) => {
        setConfirmModal({ isOpen: true, noteId: id });
    };

    const handleConfirmDelete = () => {
        if (confirmModal.noteId) {
            onDelete(confirmModal.noteId);
            setConfirmModal({ isOpen: false, noteId: null });
        }
    };

    const addBlock = (cardId: number, type: 'text' | 'todo') => {
        // Use String comparison for robustness
        const card = notes.find(n => String(n.id) == String(cardId));
        if (card) onUpdate(card.id, { blocks: [...card.blocks, { id: Date.now(), type, content: '', done: false }] });
    };

    const updateBlock = (cardId: number, blockId: number, updates: Partial<Block>) => {
        const card = notes.find(n => String(n.id) == String(cardId));
        if (card) onUpdate(card.id, { blocks: card.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) });
    };

    const deleteBlock = (cardId: number, blockId: number) => {
        const card = notes.find(n => String(n.id) == String(cardId));
        if (card) onUpdate(card.id, { blocks: card.blocks.filter(b => b.id !== blockId) });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className={`bg-slate-100 dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isMaximized ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[85vh]'}`} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-800 dark:bg-black p-5 px-6 flex justify-between items-center text-white shadow-md shrink-0">
                    <h3 className="font-bold text-xl flex items-center gap-2"><StickyIcon size={24} /> Yapışkan Notlar</h3>
                    <div className="flex gap-2">
                        <button onClick={handleAddCard} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"><Plus size={16} /> Yeni Not</button>
                        <div className="w-px h-8 bg-white/20 mx-1"></div>
                        <button onClick={() => setIsMaximized(!isMaximized)} className="hover:bg-white/20 p-2 rounded-full transition-colors hidden md:block">
                            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-[#f3f4f6] dark:bg-slate-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
                        {notes.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center text-slate-400 py-20">
                                <StickyIcon size={64} className="opacity-10 mb-4"/>
                                <p className="text-lg">Henüz not eklemediniz.</p>
                            </div>
                        ) : (
                            notes.map((card) => (
                                <div key={card.id} className={`rounded-3xl shadow-md flex flex-col h-[28rem] transition-transform hover:-translate-y-1 border ${card.color} relative group/card`}>
                                    <div className="p-4 pb-2 border-b border-black/5 dark:border-white/5 flex justify-between items-start gap-2">
                                        <input type="text" className="flex-1 bg-transparent border-none outline-none font-extrabold text-lg placeholder-black/30 dark:placeholder-white/30" placeholder="Ana Başlık..." value={card.title || ''} onChange={(e) => onUpdate(card.id, { title: e.target.value })} />
                                        <button onClick={() => deleteCard(card.id)} className="text-black/30 hover:text-red-500 hover:bg-white/30 p-1.5 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {(!card.blocks || card.blocks.length === 0) && <div className="h-full flex items-center justify-center text-black/30 text-sm italic select-none">Boş Not</div>}
                                        {card.blocks && card.blocks.map(block => (
                                            <div key={block.id} className="group/block relative flex items-start gap-2">
                                                {block.type === 'todo' && (
                                                    <button onClick={() => updateBlock(card.id, block.id, { done: !block.done })} className={`mt-0.5 shrink-0 w-4 h-4 rounded border border-black/20 dark:border-white/20 flex items-center justify-center transition-all ${block.done ? 'bg-slate-700 border-slate-700' : 'bg-white/40 hover:bg-white'}`}>
                                                        {block.done && <Check size={12} className="text-white"/>}
                                                    </button>
                                                )}
                                                <AutoResizeTextarea value={block.content} onChange={(e) => updateBlock(card.id, block.id, { content: e.target.value })} placeholder={block.type === 'todo' ? "Görev yazın..." : "Metin yazın..."} isDone={block.type === 'todo' && block.done} className="text-sm font-medium placeholder-black/30 dark:placeholder-white/30" />
                                                <button onClick={() => deleteBlock(card.id, block.id)} className="absolute right-0 top-0.5 opacity-0 group-hover/block:opacity-100 text-black/30 hover:text-red-500 transition-opacity p-0.5"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-3 border-t border-black/5 dark:border-white/5 flex gap-2 opacity-50 group-hover/card:opacity-100 transition-opacity">
                                        <button onClick={() => addBlock(card.id, 'text')} className="flex-1 py-2 bg-white/40 hover:bg-white/70 dark:bg-black/10 dark:hover:bg-black/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"><Type size={14}/> Yazı</button>
                                        <button onClick={() => addBlock(card.id, 'todo')} className="flex-1 py-2 bg-white/40 hover:bg-white/70 dark:bg-black/10 dark:hover:bg-black/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"><CheckSquare size={14}/> Kutu</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <ConfirmationModal 
                    isOpen={confirmModal.isOpen} 
                    onClose={() => setConfirmModal({ isOpen: false, noteId: null })} 
                    onConfirm={handleConfirmDelete} 
                    title="Yapışkan Notu Sil" 
                    message="Bu notu ve içindeki tüm blokları silmek istediğinize emin misiniz?" 
                />
            </div>
        </div>
    );
};

export default StickyNotesModal;