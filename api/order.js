// api/order.js
export default function handler(req, res) {
    if (req.method === 'POST') {
        const { email } = req.body;

        // Генерируем рандомный пароль (заглушка)
        const randomPassword = Math.random().toString(36).slice(-8);

        // Здесь в будущем будет запрос к базе данных
        console.log(`Заказ для: ${email}, Пароль: ${randomPassword}`);

        return res.status(200).json({
            success: true,
            message: 'Order created',
            login: email,
            password: randomPassword
        });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
