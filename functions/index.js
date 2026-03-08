const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const v1 = require('firebase-functions/v1'); // V1 altyapısını uyumluluk için özel olarak çağırıyoruz
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Firebase Admin SDK'yı başlatıyoruz
admin.initializeApp();

// Telegram bot token'ını ortam değişkeninden okuyoruz (kodda tutulmamalı)
const TELEGRAM_WEBHOOK_BOT_TOKEN = process.env.TELEGRAM_WEBHOOK_BOT_TOKEN || '';

/**
 * Yardımcı Fonksiyon: Türkiye saatine göre tarih stringi üretir (YYYY-MM-DD)
 */
const getTrDateStr = (daysToAdd = 0) => {
    const now = new Date();
    // UTC+3 (Türkiye saati) + eklenecek gün sayısı
    const trTime = new Date(now.getTime() + (3 * 60 * 60 * 1000) + (daysToAdd * 24 * 60 * 60 * 1000));
    return trTime.toISOString().split('T')[0];
};

/** Türkiye saatinde şu anki Date (saat/dakika için) */
const getTrTime = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));

/** Saati normalize et: "9:0" -> "09:00" */
const normTime = (t) => {
    if (!t || typeof t !== 'string') return '';
    const parts = t.trim().split(':');
    const h = Math.min(23, Math.max(0, parseInt(parts[0] || '0', 10)));
    const m = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10)));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Haftanın başı (Pazartesi) ve sonu (Pazar) YYYY-MM-DD - Türkiye tarihine göre */
const getTrWeekRange = (trDate) => {
    const d = new Date(trDate);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (x) => {
        const y = x.getFullYear();
        const m = String(x.getMonth() + 1).padStart(2, '0');
        const day = String(x.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    return { start: fmt(monday), end: fmt(sunday) };
};

/**
 * 1. TELEGRAM WEBHOOK (Komutları İşleyen Zengin Asistan)
 */
exports.telegramWebhook = onRequest(async (req, res) => {
    const botToken = TELEGRAM_WEBHOOK_BOT_TOKEN;

    if (!botToken) {
        console.error('Telegram webhook bot token is not configured (TELEGRAM_WEBHOOK_BOT_TOKEN)');
        return res.sendStatus(500);
    }

    const sendMessageTo = async (targetChatId, messageText, replyMarkup = null) => {
        const payload = {
            chat_id: targetChatId,
            text: messageText,
            parse_mode: 'HTML'
        };
        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }

        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Mesaj gönderme hatası:", e);
        }
    };

    const answerCallback = async (callbackQueryId, text) => {
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
            });
        } catch (e) {
            console.error("Callback answer hatası:", e);
        }
    };

    // --- Inline button callbacks (callback_query) ---
    if (req.body && req.body.callback_query) {
        const cb = req.body.callback_query;
        const chatId = cb.message?.chat?.id?.toString();
        const data = cb.data || '';

        if (!chatId) return res.sendStatus(200);

        try {
            let userId = null;
            const settingsSnap = await admin.firestore().collectionGroup('settings').get();
            for (const sDoc of settingsSnap.docs) {
                if (sDoc.id === 'config') {
                    const s = sDoc.data();
                    if (s.chatId && String(s.chatId).includes(chatId)) {
                        userId = sDoc.ref.parent.parent.id;
                        break;
                    }
                }
            }
            if (!userId) {
                await answerCallback(cb.id, "Yetkisiz");
                await sendMessageTo(chatId, "⚠️ Yetkisiz erişim! Web uygulamasında Chat ID kaydedin.");
                return res.sendStatus(200);
            }

            const [action, idStr] = String(data).split('_');
            const noteId = idStr ? String(idStr) : null;
            if (!noteId) {
                await answerCallback(cb.id, "Geçersiz");
                return res.sendStatus(200);
            }

            const noteRef = admin.firestore().collection('users').doc(userId).collection('notes').doc(noteId);
            const snap = await noteRef.get();
            if (!snap.exists) {
                await answerCallback(cb.id, "Bulunamadı");
                return res.sendStatus(200);
            }
            const note = snap.data();

            if (action === 'complete') {
                await noteRef.update({
                    completed: true,
                    completedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                await answerCallback(cb.id, "Tamamlandı");
                await sendMessageTo(chatId, `✅ <b>Tamamlandı</b>\n👤 ${note.customer}\n🗓 ${note.date.split('-').reverse().join('.')} ${note.time}`);
            } else if (action === 'delete') {
                await noteRef.delete();
                await answerCallback(cb.id, "Silindi");
                await sendMessageTo(chatId, `🗑️ <b>Silindi</b>\n👤 ${note.customer}\n🗓 ${note.date.split('-').reverse().join('.')} ${note.time}`);
            } else {
                await answerCallback(cb.id, "Bilinmeyen işlem");
            }
        } catch (e) {
            console.error("Callback işlem hatası:", e);
        }

        return res.sendStatus(200);
    }

    // --- Normal messages ---
    if (!req.body || !req.body.message || !req.body.message.text) {
        return res.sendStatus(200);
    }

    const { chat, text } = req.body.message;
    const chatId = chat.id.toString();

    const sendMessage = async (messageText, replyMarkup = null) => sendMessageTo(chatId, messageText, replyMarkup);

    const mainMenuKeyboard = {
        keyboard: [
            [{ text: "📅 Randevu Ekle" }, { text: "🔍 Ara" }],
            [{ text: "📅 Tüm Randevular" }, { text: "📅 Bu Hafta" }],
            [{ text: "✅ Tamamlananlar" }, { text: "📝 Yapışkan Notlar" }],
            [{ text: "📊 Durum Raporu" }, { text: "📋 Bekleyen Listesi" }],
            [{ text: "❌ İptal" }, { text: "⬇️ Menüyü Kapat" }]
        ],
        resize_keyboard: true,
        is_persistent: true
    };

    try {
        await admin.firestore().collection('bot_updates').add({
            chatId: chatId,
            text: text,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const parts = text.trim().split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        if (command === '/id') {
            await sendMessage(`Chat ID Numaranız:\n<code>${chatId}</code>`);
            return res.sendStatus(200);
        }

        let userId = null;
        const settingsSnap = await admin.firestore().collectionGroup('settings').get();
        for (const sDoc of settingsSnap.docs) {
            if (sDoc.id === 'config') {
                const data = sDoc.data();
                if (data.chatId && String(data.chatId).includes(chatId)) {
                    userId = sDoc.ref.parent.parent.id; 
                    break;
                }
            }
        }

        const textLower = (text || '').trim().toLowerCase();
        if (command === '/start' || command === '/yardim' || command === '/menu' || text === '❌ İptal' || textLower === 'menü' || textLower === 'menu') {
            let menu = `🤖 <b>ASİSTAN ANA MENÜ</b>\n\n`;
            menu += `Aşağıdaki butonları kullanabilir veya manuel komut yazabilirsiniz:\n\n`;
            menu += `🔹 /ekle [İsim] [Tarih] [Saat] - Randevu Ekle\n`;
            menu += `🔹 /tamamla [İsim] - Bekleyen işi tamamlar\n`;
            menu += `🔹 /bul [Kelime] - Müşteri veya işlem ara\n`;
            menu += `🔹 /yedekal - Tüm verileri anında yedekle`;
            
            if (!userId) {
                menu += `\n\n⚠️ <b>DİKKAT:</b> Hesabınız bağlanmamış. Lütfen web uygulamasına E-posta ile giriş yaptığınızdan ve Ayarlar'a Chat ID'nizi kaydettiğinizden emin olun.`;
            }
            
            await sendMessage(menu, mainMenuKeyboard);
            return res.sendStatus(200);
        }

        if (!userId) {
            await sendMessage("⚠️ Yetkisiz erişim! Lütfen Chat ID numaranızı web uygulamasına kaydedin.");
            return res.sendStatus(200);
        }

        const todayStr = getTrDateStr(0);
        const notesRef = admin.firestore().collection('users').doc(userId).collection('notes');
        const sendNoteWithActions = async (n) => {
            const status = n.completed ? "✅ Tamamlandı" : "⏳ Bekliyor";
            const message =
                `👤 <b>${n.customer}</b>\n` +
                `🗓 ${n.date.split('-').reverse().join('.')} - ${n.time}\n` +
                `📌 Durum: ${status}\n` +
                (n.content ? `📝 ${n.content}` : '');

            const buttons = [];
            if (!n.completed) {
                buttons.push({ text: "✅ Tamamla", callback_data: `complete_${n.id}` });
            }
            buttons.push({ text: "🗑️ Sil", callback_data: `delete_${n.id}` });
            await sendMessage(message, { inline_keyboard: [buttons] });
        };

        // --- BUTON VE KOMUT MANTIKLARI (ZENGİN SÜRÜM) ---

        // 1. RANDEVU EKLEME
        if (command === '/ekle' || text === '📅 Randevu Ekle') {
            if (!args || text === '📅 Randevu Ekle') {
                await sendMessage("📝 <b>Hızlı Randevu Ekleme</b>\n\nFormat:\n<code>/ekle İsim Tarih Saat</code>\n\nÖrnekler:\n• <code>/ekle Ahmet Yılmaz 22.02.2026 15:30</code>\n• <code>/ekle Ayşe 19:00</code> (Tarih girilmezse bugüne ekler)\n\nLütfen bu formatta bir mesaj gönderin.");
                return res.sendStatus(200);
            }
            let argsArray = args.split(' ');
            let time = "09:00"; 
            let dateStr = todayStr; 
            let customer = args;

            let lastWord = argsArray[argsArray.length - 1];
            if (lastWord && /^\d{1,2}[:.]\d{2}$/.test(lastWord)) {
                time = lastWord.replace('.', ':'); 
                if (time.length === 4) time = "0" + time; 
                argsArray.pop(); 
                customer = argsArray.join(' ');
            }

            lastWord = argsArray[argsArray.length - 1];
            if (lastWord && /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(lastWord)) {
                const parts = lastWord.split(/[./-]/);
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                argsArray.pop(); 
                customer = argsArray.join(' ');
            }

            const noteId = Date.now();
            await notesRef.doc(String(noteId)).set({
                id: noteId,
                customer: customer,
                time: time,
                date: dateStr,
                completed: false,
                reminderSent: false,
                content: "Telegram üzerinden hızlı eklendi.",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const displayDate = `${dateStr.split('-')[2]}.${dateStr.split('-')[1]}.${dateStr.split('-')[0]}`;
            const isToday = (dateStr === todayStr);

            await sendMessage(`✅ Başarıyla eklendi!\n👤 <b>${customer}</b>\n🗓 Tarih: ${isToday ? 'Bugün' : displayDate}\n🕐 Saat: ${time}`);
        }

        // 2. ARAMA YAPMA
        else if (command === '/bul' || text === '🔍 Ara') {
            if (!args || text === '🔍 Ara') {
                await sendMessage("🔍 <b>Kayıt Arama</b>\n\nMesaj alanına şu formatta yazıp gönderin:\n\n<code>/bul Kelime</code>\n\n<i>Örn: /bul Ayşe</i>");
                return res.sendStatus(200);
            }
            const snap = await notesRef.get();
            const results = snap.docs.map(d => d.data())
                                     .filter(d => d.customer.toLowerCase().includes(args.toLowerCase()));

            if (results.length === 0) {
                await sendMessage(`🔍 "${args}" kelimesi ile eşleşen kayıt bulunamadı.`);
            } else {
                await sendMessage(`🔍 <b>ARAMA SONUÇLARI (${results.length})</b>\n\nİşlem yapmak için butonları kullanın.`);
                for (const n of results.slice(0, 10)) {
                    await sendNoteWithActions(n);
                }
                if (results.length > 10) {
                    await sendMessage(`<i>İlk 10 sonuç gösterildi. Daha dar arama yapabilirsiniz.</i>`);
                }
            }
        }

        // 3. İŞLEM TAMAMLAMA
        else if (command === '/tamamla') {
            if (!args) {
                await sendMessage("Kimi tamamlayacağınızı yazın.\n<i>Örn: /tamamla Ahmet</i>");
                return res.sendStatus(200);
            }
            const snap = await notesRef.where('completed', '==', false).get();
            let foundDoc = null;
            
            snap.docs.forEach(doc => {
                if (doc.data().customer.toLowerCase().includes(args.toLowerCase())) foundDoc = doc;
            });

            if (foundDoc) {
                await foundDoc.ref.update({ completed: true });
                await sendMessage(`✅ <b>${foundDoc.data().customer}</b> işlemi tamamlandı olarak işaretlendi!`);
            } else {
                await sendMessage(`❌ "${args}" isminde bekleyen bir işlem bulunamadı.`);
            }
        }

        // 4. BEKLEYEN TÜM RANDEVULAR
        else if (command === '/randevular' || text === '📅 Tüm Randevular' || text === '📋 Bekleyen Listesi') {
            const snap = await notesRef.where('completed', '==', false).get();
            const upcoming = snap.docs.map(d => d.data())
                                 .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

            if (upcoming.length === 0) {
                await sendMessage("🎉 Harika! Bekleyen hiçbir randevunuz yok.");
            } else {
                await sendMessage(`📋 <b>TÜM BEKLEYEN İŞLEMLER (${upcoming.length})</b>\n\nİşlem yapmak için butonları kullanın.`);
                for (const n of upcoming.slice(0, 15)) {
                    await sendNoteWithActions(n);
                }
                if (upcoming.length > 15) {
                    await sendMessage(`<i>İlk 15 kayıt gösterildi. Daha fazlası için arama yapabilirsiniz.</i>`);
                }
            }
        }

        // 5. BU HAFTANIN PROGRAMI
        else if (command === '/buhafta' || text === '📅 Bu Hafta') {
            const nextWeekStr = getTrDateStr(7);
            const snap = await notesRef.where('completed', '==', false).get();
            const weekNotes = snap.docs.map(d => d.data())
                                  .filter(d => d.date >= todayStr && d.date <= nextWeekStr)
                                  .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

            if (weekNotes.length === 0) {
                await sendMessage("Önümüzdeki 7 gün için planlanmış işiniz yok.");
            } else {
                await sendMessage(`🗓 <b>BU HAFTAKİ PROGRAM (${weekNotes.length})</b>\n\nİşlem yapmak için butonları kullanın.`);
                for (const n of weekNotes.slice(0, 15)) {
                    await sendNoteWithActions(n);
                }
                if (weekNotes.length > 15) {
                    await sendMessage(`<i>İlk 15 kayıt gösterildi.</i>`);
                }
            }
        }

        // 6. TAMAMLANANLAR (SON 10)
        else if (command === '/tamamlananlar' || text === '✅ Tamamlananlar') {
            const snap = await notesRef.where('completed', '==', true).get();
            
            const completedNotes = snap.docs.map(d => d.data())
                                        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                                        .slice(0, 10);

            if (completedNotes.length === 0) {
                await sendMessage("Henüz tamamlanan bir işlem yok.");
            } else {
                let msg = `✅ <b>SON TAMAMLANAN 10 İŞLEM</b>\n\n`;
                completedNotes.forEach(n => {
                    msg += `🔸 ${n.date.split('-').reverse().join('.')} - 🕐 ${n.time}\n👤 <b>${n.customer}</b>\n\n`;
                });
                await sendMessage(msg);
            }
        }

        // 7. YAPIŞKAN NOTLAR
        else if (command === '/notlarim' || text === '📝 Yapışkan Notlar') {
            let stickySnap = await admin.firestore().collection('users').doc(userId).collection('stickyNotes').get();
            if (stickySnap.empty) {
                stickySnap = await admin.firestore().collection('users').doc(userId).collection('sticky_notes').get();
            }

            if (stickySnap.empty) {
                await sendMessage("📝 Kayıtlı yapışkan notunuz bulunmuyor.");
            } else {
                let msg = `📝 <b>YAPIŞKAN NOTLARINIZ</b>\n\n`;
                stickySnap.docs.forEach((doc, index) => {
                    const data = doc.data();
                    msg += `<b>${index + 1}.</b> ${data.content || data.title || 'İçeriksiz Not'}\n`;
                    // Eğer not içinde checklist varsa onları da göster:
                    if (data.blocks && Array.isArray(data.blocks)) {
                         data.blocks.forEach(b => {
                             if(b.type === 'todo') msg += `  └ ${b.done ? '✅' : '⬜'} ${b.content}\n`;
                         });
                    }
                    msg += `\n`;
                });
                await sendMessage(msg);
            }
        }

        // 8. DURUM RAPORU
        else if (text === '📊 Durum Raporu') {
            const snap = await notesRef.get();
            const allNotes = snap.docs.map(d => d.data());
            
            const pending = allNotes.filter(n => !n.completed).length;
            const completed = allNotes.filter(n => n.completed).length;
            const todayPending = allNotes.filter(n => !n.completed && n.date === todayStr).length;
            const todayCompleted = allNotes.filter(n => n.completed && n.date === todayStr).length;

            let msg = `📊 <b>DURUM RAPORU</b>\n\n`;
            msg += `<b>Bugün (${todayStr.split('-').reverse().join('.')}):</b>\n`;
            msg += `⏳ Bekleyen: ${todayPending}\n`;
            msg += `✅ Tamamlanan: ${todayCompleted}\n\n`;
            msg += `<b>Genel Toplam:</b>\n`;
            msg += `⏳ Bekleyen: ${pending}\n`;
            msg += `✅ Toplam İşlem: ${completed}\n`;

            await sendMessage(msg);
        }

        // 9. MANUEL YEDEK ALMA
        else if (command === '/yedekal') {
            await sendMessage("⏳ Yedekleme başlatıldı, dosyalarınız hazırlanıyor...");

            const allNotesSnap = await admin.firestore().collection('users').doc(userId).collection('notes').get();
            
            if (allNotesSnap.empty) {
                await sendMessage("⚠️ Yedeklenecek herhangi bir kayıt bulunamadı.");
            } else {
                const allNotes = allNotesSnap.docs.map(d => d.data());
                const jsonString = JSON.stringify(allNotes, null, 2);
                const fileBuffer = Buffer.from(jsonString, 'utf-8');
                
                const trTime = new Date(new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }));
                const displayDateStr = `${String(trTime.getDate()).padStart(2, '0')}-${String(trTime.getMonth() + 1).padStart(2, '0')}-${trTime.getFullYear()}`;
                
                const captionText = `📁 <b>Manuel Yedek Raporu</b>\n\n🗓 Tarih: <b>${displayDateStr}</b>\n✅ Toplam Kayıt: <b>${allNotes.length} adet</b>\n\nEkteki .json dosyasından tüm verilerinizin güncel yedeğini indirebilirsiniz.`;

                const form = new FormData();
                form.append('chat_id', chatId);
                form.append('caption', captionText);
                form.append('parse_mode', 'HTML');
                form.append('document', fileBuffer, {
                    filename: `Manuel_Yedek_${displayDateStr}.json`,
                    contentType: 'application/json'
                });

                await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                    method: 'POST',
                    body: form
                });
            }
        }

        // 10. MENÜYÜ KAPATMA
        else if (text === '⬇️ Menüyü Kapat') {
            await sendMessage("Menü gizlendi. Tekrar açmak için /menu yazabilirsiniz.", { remove_keyboard: true });
        }

        // BİLİNMEYEN KOMUT
        else if (command.startsWith('/')) {
            await sendMessage("❌ Bilinmeyen komut. Tüm komutları görmek için /start yazın.");
        }

    } catch (error) {
        console.error("Webhook hatası:", error);
    }
    res.sendStatus(200);
});


/**
 * 2. RANDEVU HATIRLATICI (Her 1 dakikada bir çalışır)
 */
exports.appointmentReminder = onSchedule({
    schedule: "* * * * *",
    timeZone: "Europe/Istanbul"
}, async (event) => {
    try {
        const trTime = new Date(new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }));
        const yyyy = trTime.getFullYear();
        const mm = String(trTime.getMonth() + 1).padStart(2, '0');
        const dd = String(trTime.getDate()).padStart(2, '0');
        
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const currentHourMinute = `${String(trTime.getHours()).padStart(2, '0')}:${String(trTime.getMinutes()).padStart(2, '0')}`;

        const batch = admin.firestore().batch();
        const settingsSnap = await admin.firestore().collectionGroup('settings').get();
        let updatesCount = 0;

        for (const settingsDoc of settingsSnap.docs) {
            if (settingsDoc.id !== 'config') continue;
            
            const config = settingsDoc.data();
            const userId = settingsDoc.ref.parent.parent.id;
            
            if (!config.botToken || !config.chatId) continue;
            if (config.enabled === false) continue;
            
            const notesSnap = await admin.firestore()
                .collection('users').doc(userId).collection('notes')
                .where('date', '==', todayStr)
                .get();

            for (const doc of notesSnap.docs) {
                const note = doc.data();
                
                if (note.completed === true) continue;
                if (note.reminderSent === true) continue; 
                
                if (note.time <= currentHourMinute) {
                    const message = `🔔 <b>RANDEVU VAKTİ</b>\n👤 ${note.customer}\n🕐 Saat: ${note.time}\n📝 ${note.content || 'Açıklama yok'}`;
                    const chatIds = String(config.chatId).split(',').map(id => id.trim());
                    
                    for (const chatId of chatIds) {
                        try {
                            await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
                            });
                        } catch(e) { console.error("Hatırlatma hatası:", e); }
                    }
                    batch.update(doc.ref, { reminderSent: true });
                    updatesCount++;
                }
            }
        }
        
        if (updatesCount > 0) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Zamanlayıcı (Cron) hatası:", error);
    }
});

/**
 * 3. GÜNLÜK ÖZET, HAFTALIK ÖZET, OTOMATİK YEDEK (Ayarlardaki saatlere göre – uygulama kapalıyken de çalışır)
 * Her 15 dakikada bir Türkiye saatini kontrol eder; kullanıcının ayarladığı saatlerde Telegram’a gönderir.
 */
exports.scheduledTelegramTasks = onSchedule({
    schedule: "*/15 * * * *",
    timeZone: "Europe/Istanbul"
}, async (event) => {
    try {
        const trTime = getTrTime();
        const yyyy = trTime.getFullYear();
        const mm = String(trTime.getMonth() + 1).padStart(2, '0');
        const dd = String(trTime.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const currentTime = `${String(trTime.getHours()).padStart(2, '0')}:${String(trTime.getMinutes()).padStart(2, '0')}`;
        const dayOfWeek = trTime.getDay();
        const displayDateStr = `${dd}-${mm}-${yyyy}`;

        const settingsSnap = await admin.firestore().collectionGroup('settings').get();

        for (const settingsDoc of settingsSnap.docs) {
            if (settingsDoc.id !== 'config') continue;

            const config = settingsDoc.data();
            const userId = settingsDoc.ref.parent.parent.id;

            if (!config.botToken || !config.chatId || config.enabled === false) continue;

            const hasDaily = config.dailySummaryEnabled === true && config.dailySummaryTime;
            const hasWeekly = config.weeklySummaryEnabled === true && typeof config.weeklySummaryDay === 'number' && config.weeklySummaryTime;
            const hasBackup = config.autoBackupEnabled === true && config.autoBackupTime;
            if (!hasDaily && !hasWeekly && !hasBackup) continue;

            const lastSnap = await admin.firestore().collection('users').doc(userId).collection('settings').doc('lastScheduled').get();
            const last = lastSnap.exists ? lastSnap.data() : {};
            const lastDailyDate = last.lastDailyDate || '';
            const lastWeeklyDate = last.lastWeeklyDate || '';
            const lastBackupDate = last.lastBackupDate || '';

            const dailyTime = normTime(config.dailySummaryTime);
            const weeklyTime = normTime(config.weeklySummaryTime);
            const backupTime = normTime(config.autoBackupTime);

            let needNotes = hasDaily || hasWeekly || hasBackup;
            let notes = [];
            let stickyNotes = [];
            let customFields = [];

            if (needNotes) {
                const [notesSnap, stickySnap, customFieldsSnap] = await Promise.all([
                    admin.firestore().collection('users').doc(userId).collection('notes').get(),
                    (async () => {
                        let s = await admin.firestore().collection('users').doc(userId).collection('sticky_notes').get();
                        if (s.empty) s = await admin.firestore().collection('users').doc(userId).collection('stickyNotes').get();
                        return s;
                    })(),
                    admin.firestore().collection('users').doc(userId).collection('settings').doc('customFields').get()
                ]);
                notes = notesSnap.docs.map(d => d.data());
                stickyNotes = stickySnap.empty ? [] : stickySnap.docs.map(d => d.data());
                customFields = customFieldsSnap.exists && customFieldsSnap.data().fields ? customFieldsSnap.data().fields : [];
            }

            const chatIds = String(config.chatId).split(',').map(id => id.trim()).filter(Boolean);
            const sendMsg = async (text) => {
                for (const chatId of chatIds) {
                    try {
                        await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
                        });
                    } catch (e) { console.error('Telegram send error:', e); }
                }
            };

            const updates = {};

            if (hasDaily && dailyTime === currentTime && lastDailyDate !== todayStr) {
                const todayNotes = notes.filter(n => n && n.date === todayStr);
                const pending = todayNotes.filter(n => !n.completed);
                const completed = todayNotes.filter(n => n.completed);
                let msg = "📅 <b>Günlük Özet</b>\n\n";
                msg += `Bugün toplam: ${todayNotes.length} kayıt\n`;
                msg += `Bekleyen: ${pending.length}\n`;
                msg += `Tamamlanan: ${completed.length}\n`;
                const upcoming = pending.slice().sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))).slice(0, 5);
                if (upcoming.length > 0) {
                    msg += "\nEn yakın randevular:\n";
                    upcoming.forEach(n => { msg += `• ${n.time || ''} - ${n.customer}\n`; });
                }
                await sendMsg(msg);
                updates.lastDailyDate = todayStr;
            }

            if (hasWeekly && config.weeklySummaryDay === dayOfWeek && weeklyTime === currentTime && lastWeeklyDate !== todayStr) {
                const { start, end } = getTrWeekRange(trTime);
                const weekNotes = notes
                    .filter(n => n && n.date >= start && n.date <= end && !n.completed)
                    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.time || '').localeCompare(String(b.time || '')));
                let msg = `📅 <b>Haftalık Özet</b>\n\nTarih aralığı: ${start} - ${end}\n`;
                msg += `Bekleyen kayıt sayısı: ${weekNotes.length}\n`;
                const preview = weekNotes.slice(0, 10);
                if (preview.length > 0) {
                    msg += "\nÖrnek kayıtlar:\n";
                    preview.forEach(n => { msg += `• ${n.date} ${n.time || ''} - ${n.customer}\n`; });
                    if (weekNotes.length > preview.length) msg += `... ve ${weekNotes.length - preview.length} kayıt daha.`;
                } else {
                    msg += "\nBu hafta için bekleyen kayıt yok.";
                }
                await sendMsg(msg);
                updates.lastWeeklyDate = todayStr;
            }

            const backupOk = hasBackup && backupTime === currentTime && lastBackupDate !== todayStr;
            const backupDaily = config.autoBackupFrequency !== 'weekly';
            const backupWeeklyDay = !backupDaily && typeof config.weeklySummaryDay === 'number' && config.weeklySummaryDay === dayOfWeek;
            if (backupOk && (backupDaily || backupWeeklyDay)) {
                const exportData = {
                    exportDate: trTime.toISOString(),
                    userId,
                    notes,
                    stickyNotes,
                    telegramConfig: { botToken: config.botToken, chatId: config.chatId, enabled: config.enabled, webhookEnabled: config.webhookEnabled },
                    customFields
                };
                const jsonString = JSON.stringify(exportData, null, 2);
                const fileBuffer = Buffer.from(jsonString, 'utf-8');
                const captionText = `📦 <b>Otomatik Yedek</b>\n\n🗓 Tarih: <b>${displayDateStr}</b>\n🗂 Randevu: <b>${notes.length}</b>\n📝 Not: <b>${stickyNotes.length}</b>\n\nEkteki .json dosyası tüm verilerinizin yedeğidir.`;
                for (const chatId of chatIds) {
                    try {
                        const form = new FormData();
                        form.append('chat_id', chatId);
                        form.append('caption', captionText);
                        form.append('parse_mode', 'HTML');
                        form.append('document', fileBuffer, { filename: `yedek_${yyyy}-${mm}-${dd}.json`, contentType: 'application/json' });
                        await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, { method: 'POST', body: form });
                    } catch (e) { console.error('Backup send error:', e); }
                }
                updates.lastBackupDate = todayStr;
            }

            if (Object.keys(updates).length > 0) {
                await admin.firestore().collection('users').doc(userId).collection('settings').doc('lastScheduled').set(updates, { merge: true });
            }
        }
    } catch (error) {
        console.error("scheduledTelegramTasks hatası:", error);
    }
});

/** Eski sabit 18:00 görevi – artık scheduledTelegramTasks kullanıcı saatine göre çalışıyor. Bu export uyumluluk için boş bırakıldı. */
exports.dailyBackupAndReport = onSchedule({
    schedule: "0 0 1 1 *",
    timeZone: "Europe/Istanbul"
}, async () => {});

/**
 * 4. GÜNCELLEME TETİKLEYİCİSİ (V1 Altyapısı ile Hata Giderildi)
 * Kullanıcı ön yüzden randevu saatini güncellediğinde çalışır.
 */
exports.resetReminderOnEdit = v1.firestore
    .document("users/{userId}/notes/{noteId}")
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Eğer tarih veya saat değiştirildiyse (ve randevu hala tamamlanmadıysa)
        if ((beforeData.time !== afterData.time || beforeData.date !== afterData.date) && !afterData.completed) {
            
            // ReminderSent kilidini false (sıfırlandı) yap, böylece yeni saatte bot tekrar mesaj atabilir
            return change.after.ref.update({
                reminderSent: false
            });
        }
        
        return null;
    });