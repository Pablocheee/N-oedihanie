// api/sheets.js
import crypto from 'crypto';

// [ОБНОВЛЕННЫЙ БЛОК НАСТРОЕК]
let rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
// 1. Убираем случайные кавычки в начале и конце (если они скопировались из JSON)
if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.slice(1, -1);
}
// 2. Жестко чиним символы переноса строк, чтобы Node.js понял формат ключа
rawKey = rawKey.replace(/\\n/g, '\n');

const CONFIG = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: rawKey,
    spreadsheet_id: process.env.GOOGLE_SPREADSHEET_ID
};

// Функция 1: Генерация JWT токена для доступа к Google API без сторонних библиотек
async function getAccessToken() {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
        iss: CONFIG.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, // Токен живет 1 час
        iat: now
    };

    const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signatureInput = `${encodeBase64Url(header)}.${encodeBase64Url(claimSet)}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(CONFIG.private_key, 'base64url');

    const jwt = `${signatureInput}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`Ошибка получения токена: ${data.error_description || data.error}`);
    return data.access_token;
}

// Главный обработчик API
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Метод не поддерживается. Используйте POST.' });
    }

    try {
        const { action, sheetName, range, values } = req.body;
        
        // Проверка наличия ключей
        if (!CONFIG.client_email || !CONFIG.private_key || !CONFIG.spreadsheet_id) {
            throw new Error('Не настроены переменные окружения Google (ENV)');
        }

        const token = await getAccessToken();
        const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheet_id}/values`;

        let resultData = {};

        // Маршрутизация действий
        if (action === 'read') {
            // Чтение данных (например, всего каталога)
            const response = await fetch(`${baseUrl}/${sheetName}!${range}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);
            resultData = data.values || [];
        } 
        else if (action === 'append') {
            // Добавление новой строки (например, запись лога в History)
            const response = await fetch(`${baseUrl}/${sheetName}!A:A:append?valueInputOption=USER_ENTERED`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [values] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);
            resultData = data;
        }
        else if (action === 'update') {
            // Точечное обновление конкретной ячейки
            const response = await fetch(`${baseUrl}/${sheetName}!${range}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [values] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);
            resultData = data;
        }
        else {
            throw new Error('Неизвестное действие (action). Допустимые: read, append, update.');
        }

        return res.status(200).json({ success: true, data: resultData });

    } catch (error) {
        console.error('[API/SHEETS ERROR]', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
