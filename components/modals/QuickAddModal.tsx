import React, { useMemo, useState } from 'react';
import { Plus, X, UserPlus, AlertCircle } from 'lucide-react';
import { Note, ThemeColor } from '../../types';
import { formatDateKey } from '../../utils/helpers';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  notes: Note[];
  activeTheme: ThemeColor;
  accentColor: string;
  onAdd: (note: Note) => void;
};

const QuickAddModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedDate,
  notes,
  activeTheme,
  accentColor,
  onAdd
}) => {
  const [form, setForm] = useState<{ customer: string; time: string; content: string; reminderBefore: Note['reminderBefore'] }>({
    customer: '',
    time: '09:00',
    content: '',
    reminderBefore: 'none'
  });

  const uniqueCustomers = useMemo(() => {
    const sorted = [...notes].sort((a, b) => {
      const getTs = (n: Note) => {
        if (n.createdAt) return new Date(n.createdAt).getTime();
        return new Date(`${n.date}T${n.time || '00:00'}`).getTime();
      };
      return getTs(b) - getTs(a);
    });
    const seen = new Set<string>();
    const result: string[] = [];
    for (const n of sorted) {
      const name = (n.customer || '').trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push(name);
      if (result.length >= 10) break;
    }
    return result;
  }, [notes]);

  if (!isOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer.trim()) return;

    const noteData: Note = {
      id: Date.now(),
      customer: form.customer.trim(),
      content: form.content?.trim() || 'Planlı Randevu',
      time: form.time,
      date: formatDateKey(selectedDate),
      completed: false,
      createdAt: new Date().toISOString(),
      reminderBefore:
        form.reminderBefore && form.reminderBefore !== 'none'
          ? form.reminderBefore
          : undefined,
    };
    onAdd(noteData);
    onClose();
    setForm({ customer: '', time: '09:00', content: '', reminderBefore: 'none' });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-white ${activeTheme.darkCard} rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors duration-300`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`${activeTheme.primary} p-5 text-white flex justify-between items-center shadow-md`}>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <UserPlus size={20} /> Hızlı Randevu
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 bg-slate-50 dark:bg-transparent space-y-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Müşteri Adı</label>
            <input
              required
              type="text"
              list="customer-list-quickadd"
              className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none"
              style={{ '--tw-ring-color': `var(--theme-${accentColor})` } as React.CSSProperties}
              value={form.customer}
              onChange={e => setForm({ ...form, customer: e.target.value })}
              placeholder="İsim soyisim..."
            />
            <datalist id="customer-list-quickadd">
              {uniqueCustomers.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Saat</label>
              <input
                type="time"
                className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Kısa Not</label>
              <input
                type="text"
                className="w-full px-4 py-3 text-sm border-0 bg-white dark:bg-black/20 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-opacity-50 outline-none"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="Örn: Kart çekimi"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1">Hatırlatma Zamanı</label>
            <div className="flex items-center gap-2 bg-white dark:bg-black/20 rounded-xl px-3 py-2 shadow-sm border border-slate-200 dark:border-slate-700">
              <AlertCircle size={14} className="text-slate-400" />
              <select
                className="flex-1 bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                value={form.reminderBefore || 'none'}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    reminderBefore: e.target.value as Note['reminderBefore'],
                  }))
                }
              >
                <option value="none" className="dark:bg-slate-800">Sadece randevu saatinde</option>
                <option value="15m" className="dark:bg-slate-800">15 dakika önce</option>
                <option value="1h" className="dark:bg-slate-800">1 saat önce</option>
                <option value="1d" className="dark:bg-slate-800">1 gün önce</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full ${activeTheme.primary} ${activeTheme.hover} text-white py-3 rounded-xl text-sm font-bold shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2`}
          >
            <Plus size={18} /> Kaydet
          </button>
        </form>
      </div>
    </div>
  );
};

export default QuickAddModal;

