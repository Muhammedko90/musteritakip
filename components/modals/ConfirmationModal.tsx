import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<Props> = ({ 
    isOpen, onClose, onConfirm, title, message, 
    confirmText = "Evet, Sil", cancelText = "İptal", type = 'danger' 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-[scaleIn_0.2s_ease-out] border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${type === 'danger' ? 'bg-red-100 text-red-500 dark:bg-red-900/30' : 'bg-orange-100 text-orange-500'}`}>
                        <AlertTriangle size={32} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{message}</p>
                </div>
                <div className="flex border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }} 
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${type === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-blue-600 hover:bg-blue-50'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;