import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { UserProfile } from './types';
import AuthScreen from './components/AuthScreen';
import CustomerCalendar from './CustomerCalendar';

const App: React.FC = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser({ uid: currentUser.uid, email: currentUser.email });
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDemoLogin = () => {
        setUser({ uid: 'demo_user_123', email: 'demo@modu.com', isDemo: true });
        setLoading(false);
    };

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-4">
            <div className="animate-spin h-10 w-10 border-4 border-blue-600 rounded-full border-t-transparent"></div>
        </div>
    );

    return user ? <CustomerCalendar user={user} /> : <AuthScreen onDemoLogin={handleDemoLogin} />;
};

export default App;