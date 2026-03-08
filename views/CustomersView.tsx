import React, { useMemo, useState } from 'react';
import { User, Users, Search, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Note, ThemeColor, CustomerProfile } from '../types';

interface Props {
  notes: Note[];
  activeTheme: ThemeColor;
  profiles?: Record<string, CustomerProfile>;
  onOpenCustomerCard: (customer: string) => void;
}

type CustomerSummary = {
  name: string;
  total: number;
  pending: number;
  completed: number;
  lastDate: string | null;
  lastTime: string | null;
  profileNote?: string;
};

const CustomersView: React.FC<Props> = ({ notes, activeTheme, profiles = {}, onOpenCustomerCard }) => {
  const [query, setQuery] = useState('');

  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    notes.forEach(note => {
      const rawName = (note.customer || '').trim();
      if (!rawName) return;

      const key = rawName.toLocaleLowerCase('tr-TR');
      const existing = map.get(key);

      const base: CustomerSummary =
        existing || {
          name: rawName,
          total: 0,
          pending: 0,
          completed: 0,
          lastDate: null,
          lastTime: null,
          profileNote: undefined,
        };

      base.total += 1;
      if (note.completed) {
        base.completed += 1;
      } else {
        base.pending += 1;
      }

      // Güncellenen son tarih/saat
      const currentKey = `${base.lastDate || ''}T${base.lastTime || ''}`;
      const candidateKey = `${note.date}T${note.time || '00:00'}`;

      if (!base.lastDate || new Date(candidateKey).getTime() > new Date(currentKey).getTime()) {
        base.lastDate = note.date;
        base.lastTime = note.time || null;
      }

      map.set(key, base);
    });

    let list = Array.from(map.values()).map(item => {
      const profile =
        Object.values(profiles).find(
          p => p.name.toLocaleLowerCase('tr-TR') === item.name.toLocaleLowerCase('tr-TR')
        ) || undefined;
      return {
        ...item,
        profileNote: profile?.note,
      };
    });

    if (query.trim()) {
      const q = query.trim().toLocaleLowerCase('tr-TR');
      list = list.filter(c => c.name.toLocaleLowerCase('tr-TR').includes(q));
    }

    // Önce en çok bekleyen, sonra alfabetik
    return list.sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return a.name.localeCompare(b.name, 'tr-TR');
    });
  }, [notes, query]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl bg-gradient-to-tr ${activeTheme.gradient} text-white shadow-lg ${activeTheme.shadow}`}
          >
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
              Müşteriler
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
              Tüm müşterileriniz tek ekranda
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <User size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-bold">
            Henüz müşteri kaydı bulunmuyor.
          </p>
          <p className="text-xs mt-1 max-w-xs text-center">
            Takvime kayıt ekledikçe müşteriler burada otomatik olarak listelenecek.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(customer => (
            <button
              key={customer.name}
              type="button"
              onClick={() => onOpenCustomerCard(customer.name)}
              className="group text-left bg-white dark:bg-dark-card rounded-3xl p-4 border border-slate-200 dark:border-dark-border hover:border-blue-400/70 hover:shadow-md transition-all flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${activeTheme.light} ${activeTheme.text}`}>
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">
                    {customer.name}
                  </p>
                  <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                    {customer.total} KAYIT • {customer.pending} BEKLEYEN
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} />
                  <span className="font-bold">
                    Son işlem: {formatDate(customer.lastDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {customer.pending > 0 ? (
                    <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-300">
                      <AlertCircle size={11} /> Bekleyen {customer.pending}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-300">
                      <CheckCircle2 size={11} /> Hepsi Tamamlandı
                    </span>
                  )}
                </div>
              </div>

              {customer.profileNote && (
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {customer.profileNote}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomersView;

