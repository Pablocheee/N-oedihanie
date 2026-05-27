// api/sheets.js
import crypto from 'crypto';

// 1. Безопасно достаем все ключи из единого JSON-файла
let gCredentials = {};
try {
    if (process.env.GOOGLE_CREDENTIALS) {
        gCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    }
} catch (e) {
    console.error('Ошибка чтения GOOGLE_CREDENTIALS:', e);
}

const CONFIG = {
    client_email: gCredentials.client_email,
    private_key: gCredentials.private_key,
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
    
    // Теперь ключ гарантированно в идеальном состоянии!
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
            throw new Error('Ключи Google не найдены. Проверьте переменную GOOGLE_CREDENTIALS.');
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
            // БРОНЯ: Гарантируем правильный массив для Google
            const safeValues = Array.isArray(values) ? values : [values];
            
            const response = await fetch(`${baseUrl}/${sheetName}!A:A:append?valueInputOption=USER_ENTERED`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [safeValues] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error.message);
            resultData = data;
        }
        else if (action === 'update') {
            // БРОНЯ: Гарантируем правильный массив для Google
            const safeValues = Array.isArray(values) ? values : [values];
            
            const response = await fetch(`${baseUrl}/${sheetName}!${range}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [safeValues] })
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
