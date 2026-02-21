import React, { useState } from 'react';
import { Lock, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthScreenProps {
    onDemoLogin: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onDemoLogin }) => {
    const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            if (view === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else if (view === 'register') {
                await createUserWithEmailAndPassword(auth, email, password);
            } else if (view === 'forgot') {
                await sendPasswordResetEmail(auth, email);
                setSuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
                setLoading(false);
                return;
            }
        } catch (err: any) {
            let msg = err.message;
            if(msg.includes('api-key-not-valid')) msg = "API Anahtarı geçersiz.";
            else if(msg.includes('invalid-credential')) msg = "Hatalı e-posta veya şifre.";
            else if(msg.includes('email-already-in-use')) msg = "Bu e-posta zaten kullanımda.";
            else if(msg.includes('weak-password')) msg = "Şifre en az 6 karakter olmalı.";
            else if(msg.includes('user-not-found')) msg = "Bu e-posta ile kayıtlı kullanıcı bulunamadı.";
            setError(msg.replace('Firebase:', '').trim());
        } finally {
            if(view !== 'forgot') setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl w-full max-w-sm animate-fade-in border border-slate-100 dark:border-slate-700">
                <div className="flex justify-center mb-6">
                    <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-4 rounded-2xl shadow-lg shadow-blue-500/30">
                        <Lock className="text-white w-8 h-8" />
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-center mb-2 text-slate-800 dark:text-white">
                    {view === 'login' ? 'Hoş Geldiniz' : view === 'register' ? 'Hesap Oluştur' : 'Şifre Sıfırla'}
                </h2>
                <p className="text-center text-slate-500 text-sm mb-8">Müşteri Takip Pro'ya devam edin</p>

                {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm mb-4 flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0"/> <span>{error}</span></div>}
                {success && <div className="bg-green-50 border border-green-200 text-green-600 p-3 rounded-xl text-sm mb-4 flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0"/> <span>{success}</span></div>}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">E-POSTA</label>
                        <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" placeholder="ornek@mail.com" />
                    </div>
                    {view !== 'forgot' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">ŞİFRE</label>
                            <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" placeholder="******" />
                        </div>
                    )}
                    
                    {view === 'login' && (
                        <div className="text-right">
                            <button type="button" onClick={() => { setView('forgot'); setError(''); setSuccess(''); }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Şifremi Unuttum?</button>
                        </div>
                    )}

                    <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all flex justify-center items-center gap-2 transform hover:scale-[1.02]">
                        {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (view === 'login' ? 'Giriş Yap' : view === 'register' ? 'Kayıt Ol' : 'Bağlantı Gönder')}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                    <button onClick={onDemoLogin} type="button" className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-600">
                        <EyeOff size={16}/> Demo Modu (Girişsiz Dene)
                    </button>
                    
                    <div className="text-center text-sm">
                        {view === 'login' ? (
                            <button onClick={() => { setView('register'); setError(''); }} className="text-blue-600 hover:underline font-bold">Hesabınız yok mu? Kayıt Olun</button>
                        ) : (
                            <button onClick={() => { setView('login'); setError(''); }} className="text-blue-600 hover:underline font-bold">Giriş Yap ekranına dön</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;