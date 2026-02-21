import React from 'react';
import { CheckCircle, Info, XCircle, Send, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'info' | 'error';
}

const NotificationModal: React.FC<Props> = ({
    isOpen, onClose, title, message, type = 'success'
}) => {
    if (!isOpen) return null;

    const iconMap = {
        success: <CheckCircle size={40} className="text-emerald-500" />,
        info: <Info size={40} className="text-blue-500" />,
        error: <XCircle size={40} className="text-red-500" />
    };

    const bgColorMap = {
        success: 'bg-emerald-50 dark:bg-emerald-900/20',
        info: 'bg-blue-50 dark:bg-blue-900/20',
        error: 'bg-red-50 dark:bg-red-900/20'
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden animate-[scaleIn_0.2s_ease-out] border border-slate-200 dark:border-slate-700 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <X size={20} />
                </button>

                <div className="p-8 text-center">
                    <div className={`mx-auto mb-5 w-20 h-20 rounded-3xl flex items-center justify-center ${bgColorMap[type]} shadow-inner`}>
                        {iconMap[type]}
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">{title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{message}</p>
                </div>

                <div className="p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all active:scale-95"
                    >
                        Tamam
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;