const crypto = require('crypto');

const ROBO_LOGIN = 'Tantraa'; 
// Вставь сюда БОЕВОЙ Пароль #1 (из самого верха настроек)
const ROBO_PASS1 = 'JQva5qGnd1fy1Ptay35q'.trim(); 
// Выключаем тестовый режим
const IS_TEST = 0; 

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseName, price } = req.body;
        const invId = 0; 
        const outSum = Number(price).toString(); // Фиксируем как число

        // Собираем строку для подписи
        const signatureString = `${ROBO_LOGIN}:${outSum}:${invId}:${ROBO_PASS1}`;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        const roboUrl = new URL('https://auth.robokassa.ru/Merchant/Index.aspx');
        roboUrl.searchParams.append('MerchantLogin', ROBO_LOGIN);
        roboUrl.searchParams.append('OutSum', outSum);
        roboUrl.searchParams.append('InvId', invId);
        roboUrl.searchParams.append('Description', `Оплата: ${courseName}`);
        roboUrl.searchParams.append('SignatureValue', signature);
        
        // Так как IS_TEST = 0, параметр IsTest в ссылку не добавится
        if (IS_TEST === 1) {
            roboUrl.searchParams.append('IsTest', '1'); 
        }

        // Больше никакого алерта-детектива, сразу переходим к оплате
        res.status(200).json({ success: true, paymentUrl: roboUrl.toString() });
    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ success: false, error: "Ошибка создания платежа" });
    }
};
