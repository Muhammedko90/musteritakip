import { TelegramConfig } from '../types';

export const sendTelegramMessage = async (
    config: TelegramConfig,
    message: string,
    keyboard: any = null,
    targetChatId: string | null = null,
    inlineKeyboard: any = null
): Promise<boolean> => {
    const { botToken, chatId } = config;
    if (!botToken) return false;
    
    let recipients: string[] = [];
    if (targetChatId) {
        recipients = [String(targetChatId)];
    } else if (chatId) {
        recipients = chatId.split(',').map(id => id.trim()).filter(id => id);
    }

    if (recipients.length === 0) return false;

    for (const recipientId of recipients) {
        const payload: any = { chat_id: recipientId, text: message, parse_mode: 'HTML' };
        if (keyboard) payload.reply_markup = { keyboard: keyboard, resize_keyboard: true, one_time_keyboard: false };
        if (inlineKeyboard) payload.reply_markup = { inline_keyboard: inlineKeyboard };
        
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error(`Telegram Send Error:`, e);
        }
    }
    return true;
};

export const answerCallbackQuery = async (botToken: string, callbackQueryId: string, text: string) => {
    try {
       await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
           method: 'POST', headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
       });
   } catch(e) { console.error(e); }
};