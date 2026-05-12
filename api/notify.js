// [SETTINGS]
// Настройки берутся из переменных окружения Vercel для безопасности
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || '8725038655:AAE1XcawO716rO26ElZmQRtx7eDgYXyE-ao', // МЕНЯТЬ ТУТ (в панели Vercel)
    CHAT_ID: process.env.CHAT_ID || '7318415778'
};

// === START: TELEGRAM_NOTIFY ===
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { text } = req.body;

    try {
        const response = await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            throw new Error('Telegram API error');
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
// === END: TELEGRAM_NOTIFY ===
