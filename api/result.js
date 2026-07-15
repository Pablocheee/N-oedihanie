const crypto = require('crypto');

const ROBO_PASS2 = 'Mk3LNoY1ZVrEVsN7L47t'; // Твой Пароль #2

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Vercel сам умеет читать данные от Робокассы из req.body
    const { OutSum, InvId, SignatureValue } = req.body;

    if (!OutSum || !InvId || !SignatureValue) {
        return res.status(400).send("Bad request");
    }

    // Проверяем подпись вторым паролем
    const checkString = `${OutSum}:${InvId}:${ROBO_PASS2}`;
    const mySignature = crypto.createHash('md5').update(checkString).digest('hex');

    if (mySignature.toUpperCase() === SignatureValue.toUpperCase()) {
        console.log(`✅ Успешная оплата! Заказ: ${InvId}, Сумма: ${OutSum}`);
        
        // Отвечаем Робокассе, что всё супер
        res.status(200).send(`OK${InvId}`);
    } else {
        console.error("❌ Ошибка подписи");
        res.status(400).send("Bad signature");
    }
};
