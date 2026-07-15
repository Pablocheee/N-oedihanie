const crypto = require('crypto');

const ROBO_LOGIN = 'Tantraa'; 
const ROBO_PASS1 = 'WJS6H6d2R98XfQKIrofu'; // Твой Пароль #1
const IS_TEST = 1; // 1 - тест, 0 - реальные деньги

module.exports = async (req, res) => {
    // Разрешаем только POST-запросы
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseName, price } = req.body;
        const invId = Math.floor(Date.now() / 1000); // Уникальный номер заказа
        const outSum = parseFloat(price).toFixed(2); // Форматируем цену

        // Формируем секретную подпись
        const signatureString = `${ROBO_LOGIN}:${outSum}:${invId}:${ROBO_PASS1}`;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        // Собираем итоговую ссылку
        const roboUrl = new URL('https://auth.robokassa.ru/Merchant/Index.aspx');
        roboUrl.searchParams.append('MerchantLogin', ROBO_LOGIN);
        roboUrl.searchParams.append('OutSum', outSum);
        roboUrl.searchParams.append('InvId', invId);
        roboUrl.searchParams.append('Description', `Оплата курса: ${courseName}`);
        roboUrl.searchParams.append('SignatureValue', signature);
        roboUrl.searchParams.append('IsTest', IS_TEST); 

        // Отправляем ссылку обратно на сайт
        res.status(200).json({ success: true, paymentUrl: roboUrl.toString() });
    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ success: false, error: "Ошибка создания платежа" });
    }
};
