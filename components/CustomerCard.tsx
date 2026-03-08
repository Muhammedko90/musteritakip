import React, { useMemo, useState } from 'react';
import { X, User, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Note, CustomFieldDef, ThemeColor, CustomerProfile } from '../types';
import { formatDateKey } from '../utils/helpers';

type Props = {
  customer: string;
  notes: Note[];
  customFields: CustomFieldDef[];
  activeTheme: ThemeColor;
  profile?: CustomerProfile | null;
  onSaveProfile?: (profile: CustomerProfile) => Promise<void> | void;
  onClose: () => void;
};

const CustomerCard: React.FC<Props> = ({
  customer,
  notes,
  customFields,
  activeTheme,
  profile,
  onSaveProfile,
  onClose,
}) => {
  const customerNotes = useMemo(() => {
    const filtered = notes.filter(n => n.customer === customer);
    const getTs = (n: Note) => {
      if (n.createdAt) return new Date(n.createdAt).getTime();
      return new Date(`${n.date}T${n.time || '00:00'}`).getTime();
    };
    return filtered.sort((a, b) => getTs(b) - getTs(a));
  }, [customer, notes]);

  const stats = useMemo(() => {
    const total = customerNotes.length;
    const pending = customerNotes.filter(n => !n.completed).length;
    const completed = total - pending;
    return { total, pending, completed };
  }, [customerNotes]);

  const amountInfo = useMemo(() => {
    const amountFieldIds = customFields
      .filter(
        f =>
          f.type === 'number' ||
          /tutar|ücret|ücret|fiyat|bor[cç]/i.test(f.label || '')
      )
      .map(f => f.id);

    if (amountFieldIds.length === 0) {
      return { hasAmount: false, totalAll: 0, totalPending: 0 };
    }

    const parseAmount = (raw: string | undefined): number => {
      if (!raw) return 0;
      const normalized = raw.replace(/[^\d,.\-]/g, '').replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    };

    let totalAll = 0;
    let totalPending = 0;

    customerNotes.forEach(n => {
      amountFieldIds.forEach(id => {
        const v = n.customValues?.[id];
        const amt = parseAmount(v);
        if (!amt) return;
        totalAll += amt;
        if (!n.completed) totalPending += amt;
      });
    });

    return { hasAmount: true, totalAll, totalPending };
  }, [customerNotes, customFields]);

  const lastNotes = customerNotes.slice(0, 5);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

  const initialProfile: CustomerProfile = useMemo(
    () => ({
      id: profile?.id || '',
      name: profile?.name || customer,
      note: profile?.note || '',
      phone: profile?.phone,
      telegramChatId: profile?.telegramChatId,
      createdAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
    }),
    [profile, customer]
  );

  const [editingProfile, setEditingProfile] = useState<CustomerProfile>(initialProfile);

  const handleSaveProfile = async () => {
    if (!onSaveProfile) return;
    await onSaveProfile({
      ...editingProfile,
      name: editingProfile.name || customer,
    });
  };

  if (!customerNotes.length) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl shadow-2xl bg-white ${activeTheme.darkCard} border border-slate-200 dark:border-white/10 overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div
          className={`${activeTheme.primary} p-4 flex items-center justify-between text-white relative overflow-hidden`}
        >
          <div className="flex items-center gap-3 z-10">
            <div className="bg-white/20 rounded-2xl p-2">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight truncate">
                {customer}
              </h3>
              <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">
                Müşteri Özeti
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/15 text-white z-10"
          >
            <X size={18} />
          </button>
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />
        </div>

        <div className="p-4 space-y-4 bg-slate-50 dark:bg-black/10">
          {onSaveProfile && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-white/5 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Profil Notu
              </p>
              <textarea
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                rows={3}
                placeholder="Bu müşteriyle ilgili genel notlar (özel istekler, uyarılar...)"
                value={editingProfile.note || ''}
                onChange={e =>
                  setEditingProfile(prev => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                  placeholder="Telefon (opsiyonel)"
                  value={editingProfile.phone || ''}
                  onChange={e =>
                    setEditingProfile(prev => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                />
                <input
                  type="text"
                  className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                  placeholder="Telegram Chat ID (opsiyonel)"
                  value={editingProfile.telegramChatId || ''}
                  onChange={e =>
                    setEditingProfile(prev => ({
                      ...prev,
                      telegramChatId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Toplam Kayıt
              </p>
              <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                {stats.total}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Bekleyen
              </p>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-300">
                {stats.pending}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 text-center border border-slate-100 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tamamlanan
              </p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-300">
                {stats.completed}
              </p>
            </div>
          </div>

          {amountInfo.hasAmount && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Tutar Özeti (Tahmini)
              </p>
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>Toplam</span>
                <span>{formatCurrency(amountInfo.totalAll)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-300 mt-1">
                <span>Bekleyen</span>
                <span>{formatCurrency(amountInfo.totalPending)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Son İşlemler
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {lastNotes.map(n => {
                const isOverdue = !n.completed && n.date < formatDateKey(new Date());
                return (
                  <div
                    key={n.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-white/5 flex items-start gap-3"
                  >
                    <div className="mt-0.5">
                      <Calendar size={14} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                          <span>{formatDate(n.date)}</span>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <Clock size={10} className="text-slate-400" />
                          <span>{n.time}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          {n.completed ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                              <CheckCircle2 size={11} /> Tamamlandı
                            </span>
                          ) : isOverdue ? (
                            <span className="flex items-center gap-1 text-rose-500">
                              <AlertCircle size={11} /> Gecikmiş
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-500">
                              <Clock size={11} /> Bekliyor
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                        {n.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;

