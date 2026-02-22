import React, { useState, useMemo } from 'react';
import {
    StickyNote as StickyIcon, Plus, X, Maximize2, Minimize2, Trash2,
    Type, CheckSquare, Check, Bell, Pin, Archive, Box, Palette
} from 'lucide-react';
import { StickyNote, Block } from '../../types';
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
    const [showArchived, setShowArchived] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, noteId: number | null}>({ isOpen: false, noteId: null });

    const filteredNotes = useMemo(() => {
        return notes.filter(n => showArchived ? n.archived : !n.archived);
    }, [notes, showArchived]);

    if (!isOpen) return null;

    const handleAddCard = () => {
        const newNote: StickyNote = {
            id: Date.now(), 
            color: '#fef08a', // Default yellow hex
            title: '', 
            blocks: [{ id: Date.now() + 1, type: 'text', content: '', done: false }],
            pinned: false,
            archived: false
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
        const card = notes.find(n => String(n.id) === String(cardId));
        if (card) onUpdate(card.id, { blocks: [...card.blocks, { id: Date.now(), type, content: '', done: false }] });
    };

    const updateBlock = (cardId: number, blockId: number, updates: Partial<Block>) => {
        const card = notes.find(n => String(n.id) === String(cardId));
        if (card) onUpdate(card.id, { blocks: card.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) });
    };

    const deleteBlock = (cardId: number, blockId: number) => {
        const card = notes.find(n => String(n.id) === String(id));
        if (card) onUpdate(card.id, { blocks: card.blocks.filter(b => b.id !== blockId) });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className={`bg-slate-100 dark:bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isMaximized ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[85vh]'}`} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-800 dark:bg-black p-5 px-6 flex justify-between items-center text-white shadow-md shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-xl flex items-center gap-2"><StickyIcon size={24} /> Yapışkan Notlar</h3>
                        <div className="flex bg-white/10 p-1 rounded-xl">
                            <button onClick={() => setShowArchived(false)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!showArchived ? 'bg-white text-slate-900 shadow-sm' : 'text-white/60 hover:text-white'}`}>Aktif</button>
                            <button onClick={() => setShowArchived(true)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${showArchived ? 'bg-white text-slate-900 shadow-sm' : 'text-white/60 hover:text-white'}`}>Arşiv</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAddCard} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"><Plus size={16} /> Yeni Not</button>
                        <div className="w-px h-8 bg-white/20 mx-1"></div>
                        <button onClick={() => setIsMaximized(!isMaximized)} className="hover:bg-white/20 p-2 rounded-full transition-colors hidden md:block">
                            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-[#f3f4f6] dark:bg-slate-900 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
                        {filteredNotes.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center text-slate-400 py-20">
                                <Box size={64} className="opacity-10 mb-4"/>
                                <p className="text-lg">{showArchived ? "Arşivlenmiş not bulunmuyor." : "Henüz not eklemediniz."}</p>
                            </div>
                        ) : (
                            filteredNotes.map((card) => {
                                const isHex = card.color?.startsWith('#');
                                return (
                                    <div key={card.id}
                                         className={`rounded-3xl shadow-md flex flex-col h-[30rem] transition-all hover:-translate-y-1 border relative group/card overflow-hidden ${!isHex ? card.color : ''}`}
                                         style={isHex ? { backgroundColor: card.color, borderColor: 'rgba(0,0,0,0.1)' } : {}}
                                    >
                                        <div className="p-4 pb-2 border-b border-black/5 flex justify-between items-center gap-2 bg-white/20">
                                            <input type="text" className="flex-1 bg-transparent border-none outline-none font-black text-lg placeholder-black/30 text-slate-900 min-w-0" placeholder="Başlık..." value={card.title || ''} onChange={(e) => onUpdate(card.id, { title: e.target.value })} />
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button onClick={() => onUpdate(card.id, { pinned: !card.pinned })} className={`p-1.5 rounded-lg transition-colors ${card.pinned ? 'text-blue-600 bg-white/50' : 'text-black/30 hover:text-blue-500 hover:bg-white/30'}`} title="Sabitle"><Pin size={16}/></button>
                                                <button onClick={() => onUpdate(card.id, { archived: !card.archived })} className="text-black/30 hover:text-amber-600 hover:bg-white/30 p-1.5 rounded-lg transition-colors" title={card.archived ? "Arşivden Çıkar" : "Arşivle"}><Archive size={16}/></button>
                                                <button onClick={() => deleteCard(card.id)} className="text-black/30 hover:text-red-500 hover:bg-white/30 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white/10">
                                            {(!card.blocks || card.blocks.length === 0) && <div className="h-full flex items-center justify-center text-black/30 text-sm italic select-none">İçerik yok</div>}
                                            {card.blocks && card.blocks.map(block => (
                                                <div key={block.id} className="group/block relative flex items-start gap-2">
                                                    {block.type === 'todo' && (
                                                        <button onClick={() => updateBlock(card.id, block.id, { done: !block.done })} className={`mt-0.5 shrink-0 w-4 h-4 rounded border border-black/20 flex items-center justify-center transition-all ${block.done ? 'bg-slate-800 border-slate-800' : 'bg-white/40 hover:bg-white'}`}>
                                                            {block.done && <Check size={12} className="text-white"/>}
                                                        </button>
                                                    )}
                                                    <AutoResizeTextarea value={block.content} onChange={(e) => updateBlock(card.id, block.id, { content: e.target.value })} placeholder={block.type === 'todo' ? "Görev..." : "Not..."} isDone={block.type === 'todo' && block.done} className="text-sm font-bold text-slate-900 placeholder-black/30" />
                                                    <button onClick={() => deleteBlock(card.id, block.id)} className="absolute right-0 top-0.5 opacity-0 group-hover/block:opacity-100 text-black/30 hover:text-red-500 transition-opacity p-0.5"><X size={14}/></button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="px-4 py-2 bg-black/5 flex flex-col gap-2 shrink-0">
                                            <div className="flex items-center gap-2 text-black/40">
                                                <Bell size={14}/>
                                                <input type="date" className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-800" value={card.reminderDate || ''} onChange={e => onUpdate(card.id, { reminderDate: e.target.value })} />
                                                <input type="time" className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-800" value={card.reminderTime || ''} onChange={e => onUpdate(card.id, { reminderTime: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="p-3 bg-black/10 flex justify-between items-center gap-2 opacity-50 group-hover/card:opacity-100 transition-opacity shrink-0">
                                            <div className="flex gap-1.5 flex-1">
                                                <button onClick={() => addBlock(card.id, 'text')} className="flex-1 py-2 bg-white/50 hover:bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm"><Type size={12}/> Metin</button>
                                                <button onClick={() => addBlock(card.id, 'todo')} className="flex-1 py-2 bg-white/50 hover:bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm"><CheckSquare size={12}/> Liste</button>
                                            </div>
                                            <div className="relative group/palette">
                                                <div className="p-2 bg-white/50 rounded-xl cursor-pointer hover:bg-white"><Palette size={16} className="text-slate-700" /></div>
                                                <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={isHex ? card.color : '#fef08a'} onChange={e => onUpdate(card.id, { color: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <ConfirmationModal 
                    isOpen={confirmModal.isOpen} 
                    onClose={() => setConfirmModal({ isOpen: false, noteId: null })} 
                    onConfirm={handleConfirmDelete} 
                    title="Notu Sil"
                    message="Bu notu tamamen silmek istediğinize emin misiniz?"
                />
            </div>
        </div>
    );
};

export default StickyNotesModal;
