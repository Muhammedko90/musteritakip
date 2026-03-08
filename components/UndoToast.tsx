import React from 'react';
import { RotateCcw, X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  message: string;
  actionLabel?: string;
  onUndo: () => void;
  onClose: () => void;
};

const UndoToast: React.FC<Props> = ({ isOpen, message, actionLabel = 'Geri Al', onUndo, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[130] flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl bg-slate-900/95 text-white rounded-3xl shadow-2xl border border-white/10 backdrop-blur-md px-5 py-4 flex items-center justify-between gap-4">
        <div className="text-sm font-bold truncate">{message}</div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onUndo}
            className="px-4 py-2 rounded-2xl bg-white text-slate-900 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center gap-2"
          >
            <RotateCcw size={16} />
            {actionLabel}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-white/10 transition-colors"
            title="Kapat"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UndoToast;

