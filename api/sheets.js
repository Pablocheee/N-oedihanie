// api/sheets.js
import crypto from 'crypto';

// Умная функция-броня. Она восстановит структуру ключа, даже если Vercel 
// склеил его в одну строку, удалил переносы или добавил лишние кавычки.
function formatPrivateKey(key) {
    if (!key) return '';
    
    // 1. Убираем случайные кавычки по краям
    let k = key.replace(/^["']|["']$/g, '');
    
    // 2. Если есть текстовые \n, делаем из них реальные переносы
    k = k.replace(/\\n/g, '\n');
    
    // 3. Если переносов строк вообще нет (ключ сломался при копировании)
    if (!k.includes('\n') || k.split('\n').length < 3) {
        const match = k.match(/(-----BEGIN PRIVATE KEY-----)(.*?)(-----END PRIVATE KEY-----)/);
        if (match) {
            const header = match[1];
            const body = match[2].replace(/\s+/g, ''); // убираем весь мусор и пробелы
            const footer = match[3];
            
            // Заново рубим ключ на правильные блоки по 64 символа (стандарт PEM)
            if (body) {
                const chunked = body.match(/.{1,64}/g).join('\n');
                k = `${header}\n${chunked}\n${footer}\n`;
            }
        }
    }
    return k;
}

const CONFIG = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    spreadsheet_id: process.env.GOOGLE_SPREADSHEET_ID
};

async function getAccessToken() {
    const header = { alg: 'RS256', typ: 'JWT' };
    
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
        iss: CONFIG.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signatureInput = `${encodeBase64Url(header)}.${encodeBase64Url(claimSet)}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    
    // Теперь ключ 100% правильный, и здесь ошибки не будет
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Метод не поддерживается. Используйте POST.' });
    }

    try {
        const { action, sheetName, range, values } = req.body;
        
        if (!CONFIG.client_email || !CONFIG.private_key || !CONFIG.spreadsheet_id) {
            throw new Error('Не настроены переменные окружения Google (ENV)');
        }

        const token = await getAccessToken();
        const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheet_id}/values`;

        let resultData = {};

        if (action === 'read') {
            const response = await fetch(`${baseUrl}/${sheetName}!${range}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);
            resultData = data.values || [];
        } 
        else if (action === 'append') {
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
            throw new Error('Неизвестное действие (action).');
        }

        return res.status(200).json({ success: true, data: resultData });

    } catch (error) {
        console.error('[API/SHEETS ERROR]', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
