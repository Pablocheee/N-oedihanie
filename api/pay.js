const crypto = require('crypto');

const ROBO_LOGIN = 'Tantraa'; 
// Вставь сюда ТЕСТОВЫЙ Пароль #1 и я добавил .trim() для защиты от пробелов
const ROBO_PASS1 = 'nFApbOsn13F9ZDAy44Ve'.trim(); 
const IS_TEST = 1;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseName, price } = req.body;
        
        const invId = 0; 
        // Принудительно делаем формат с копейками, например "5.00"
        const outSum = parseFloat(price).toFixed(2); 

        // Формула: Login:OutSum:InvId:Pass1
        const signatureString = `${ROBO_LOGIN}:${outSum}:${invId}:${ROBO_PASS1}`;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        const roboUrl = new URL('https://auth.robokassa.ru/Merchant/Index.aspx');
        roboUrl.searchParams.append('MerchantLogin', ROBO_LOGIN);
        roboUrl.searchParams.append('OutSum', outSum);
        roboUrl.searchParams.append('InvId', invId);
        roboUrl.searchParams.append('Description', `Оплата: ${courseName}`);
        roboUrl.searchParams.append('SignatureValue', signature);
        
        if (IS_TEST === 1) {
            roboUrl.searchParams.append('IsTest', '1'); 
        }

        res.status(200).json({ success: true, paymentUrl: roboUrl.toString() });
    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ success: false, error: "Ошибка создания платежа" });
    }
};
