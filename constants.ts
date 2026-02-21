import { ThemeColor } from './types';

export const THEME_COLORS: Record<string, ThemeColor> = {
    blue: { 
        name: 'Okyanus Mavisi', 
        primary: 'bg-blue-600', 
        hover: 'hover:bg-blue-700', 
        text: 'text-blue-600', 
        ring: 'ring-blue-500', 
        light: 'bg-blue-50', 
        border: 'border-blue-200', 
        gradient: 'from-blue-600 to-indigo-600', 
        shadow: 'shadow-blue-500/30',
        darkBg: 'dark:bg-slate-900',
        darkCard: 'dark:bg-slate-800'
    },
    purple: { 
        name: 'Kraliyet Moru', 
        primary: 'bg-purple-600', 
        hover: 'hover:bg-purple-700', 
        text: 'text-purple-600', 
        ring: 'ring-purple-500', 
        light: 'bg-purple-50', 
        border: 'border-purple-200', 
        gradient: 'from-purple-600 to-fuchsia-600', 
        shadow: 'shadow-purple-500/30',
        darkBg: 'dark:bg-[#0f0a19]', // Deep purple dark
        darkCard: 'dark:bg-[#1d1430]' 
    },
    rose: { 
        name: 'Gül Pembesi', 
        primary: 'bg-rose-600', 
        hover: 'hover:bg-rose-700', 
        text: 'text-rose-600', 
        ring: 'ring-rose-500', 
        light: 'bg-rose-50', 
        border: 'border-rose-200', 
        gradient: 'from-rose-600 to-pink-600', 
        shadow: 'shadow-rose-500/30',
        darkBg: 'dark:bg-[#140508]', // Deep rose dark
        darkCard: 'dark:bg-[#290d14]'
    },
    orange: { 
        name: 'Gün Batımı', 
        primary: 'bg-orange-500', 
        hover: 'hover:bg-orange-600', 
        text: 'text-orange-600', 
        ring: 'ring-orange-500', 
        light: 'bg-orange-50', 
        border: 'border-orange-200', 
        gradient: 'from-orange-500 to-amber-500', 
        shadow: 'shadow-orange-500/30',
        darkBg: 'dark:bg-[#120804]', // Deep orange dark
        darkCard: 'dark:bg-[#241109]'
    }
};

export const NOTE_COLORS = [
    'bg-yellow-200 dark:bg-yellow-600/30 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-600/50',
    'bg-blue-200 dark:bg-blue-600/30 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-600/50',
    'bg-green-200 dark:bg-green-600/30 text-green-900 dark:text-green-100 border-green-300 dark:border-green-600/50',
    'bg-pink-200 dark:bg-pink-600/30 text-pink-900 dark:text-pink-100 border-pink-300 dark:border-pink-600/50',
    'bg-purple-200 dark:bg-purple-600/30 text-purple-900 dark:text-purple-100 border-purple-300 dark:border-purple-600/50'
];

export const QUICK_DESCRIPTIONS = ["KART ÇEKİLECEK", "ÖDEME ATACAK", "NAKİT ÖDEME", "HAVALE/EFT", "RANDEVU", "TESLİMAT"];