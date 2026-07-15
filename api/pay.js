const crypto = require('crypto');

const ROBO_LOGIN = 'Tantraa'; 
const ROBO_PASS1 = 'WJS6H6d2R98XfQKIrofu'; // Строго ТЕСТОВЫЙ!
const IS_TEST = 1;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { courseName, price } = req.body;
        const invId = 0; 
        const outSum = price.toString(); 

        const signatureString = `${ROBO_LOGIN}:${outSum}:${invId}:${ROBO_PASS1}`;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        const roboUrl = new URL('https://auth.robokassa.ru/Merchant/Index.aspx');
        roboUrl.searchParams.append('MerchantLogin', ROBO_LOGIN);
        roboUrl.searchParams.append('OutSum', outSum);
        roboUrl.searchParams.append('InvId', invId);
        roboUrl.searchParams.append('Description', `Оплата курса: ${courseName}`);
        roboUrl.searchParams.append('SignatureValue', signature);
        
        // Передаем IsTest только если режим реально тестовый
        if (IS_TEST === 1) {
            roboUrl.searchParams.append('IsTest', '1'); 
        }

        res.status(200).json({ success: true, paymentUrl: roboUrl.toString() });
    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ success: false, error: "Ошибка создания платежа" });
    }
};
