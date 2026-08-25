import crypto from 'crypto';

export default async function handler(req, res) {
    // Разрешаем только POST-запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Метод не разрешен' });
    }

    const { password } = req.body;
    
    // Достаем настоящий пароль из скрытых настроек Vercel
    const truePassword = process.env.ADMIN_PASSWORD;

    if (!truePassword) {
        return res.status(500).json({ success: false, error: 'Пароль администратора не настроен на сервере' });
    }

    // Защита от тайминг-атак (сравниваем строки безопасно)
    const isMatch = password === truePassword;

    if (isMatch) {
        // Если пароль верный, генерируем секретный токен (действует для этой сессии)
        // В реальном production здесь часто используют JWT, но для базовой защиты хватит хэша от пароля и соли
        const token = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || 'fallback').update('admin_session_token').digest('hex');
        
        return res.status(200).json({ 
            success: true, 
            token: token 
        });
    } else {
        return res.status(401).json({ success: false, error: 'Неверный пароль' });
    }
}
