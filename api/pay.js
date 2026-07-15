const crypto = require('crypto');

const ROBO_LOGIN = 'Tantraa'; 
const ROBO_PASS1 = 'WJS6H6d2R98XfQKIrofu'; // Строго Пароль #1 (без пробелов)
const IS_TEST = 0;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseName, price } = req.body;
        
        // 1. Ставим InvId = 0 (Робокасса сама назначит номер заказа)
        const invId = 0; 
        
        // 2. Передаем сумму как есть, без принудительных ".00"
        const outSum = price.toString(); 

        // 3. Формируем подпись строго по формуле Робокассы: Логин:Сумма:Номер:Пароль1
        const signatureString = `${ROBO_LOGIN}:${outSum}:${invId}:${ROBO_PASS1}`;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        const roboUrl = new URL('https://auth.robokassa.ru/Merchant/Index.aspx');
        roboUrl.searchParams.append('MerchantLogin', ROBO_LOGIN);
        roboUrl.searchParams.append('OutSum', outSum);
        roboUrl.searchParams.append('InvId', invId);
        roboUrl.searchParams.append('Description', `Оплата курса: ${courseName}`);
        roboUrl.searchParams.append('SignatureValue', signature);
        roboUrl.searchParams.append('IsTest', IS_TEST); 

        res.status(200).json({ success: true, paymentUrl: roboUrl.toString() });
    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ success: false, error: "Ошибка создания платежа" });
    }
};
