// api/admin-chat.js

export default async function handler(req, res) {
    // Разрешаем только POST-запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Метод не поддерживается. Используйте POST.' });
    }

    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Пустое сообщение' });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('Не настроен ключ GROQ_API_KEY в переменных окружения');
        }

        // === ОБНОВЛЕННЫЙ СИСТЕМНЫЙ ПРОМПТ ДЛЯ ИИ ===
        const systemPrompt = `Ты — ИИ-администратор проекта OrdoAxio (CMS движок). 
Твоя задача — переводить команды пользователя на естественном языке в строгий JSON формат для выполнения действий с базой данных (Google Sheets).
        
ОБЯЗАТЕЛЬНЫЕ ФОРМАТЫ ОТВЕТОВ (выбери один подходящий action):

1. Обновить цену:
{"action": "update_price", "product_name": "Имя или ID курса", "new_price": 5000, "reply": "Я готов изменить цену. Подтверждаете?"}

2. Обновить описание:
{"action": "update_text", "product_name": "Имя или ID курса", "new_text": "Новый текст", "reply": "Я готов изменить описание. Подтверждаете?"}

3. Создать новый курс (СГЕНЕРИРУЙ все поля, даже если юзер дал только название. new_id - это одно слово на английском мелкими буквами. price_usdt = price_rub / 100):
{"action": "create_product", "product_name": "Название", "new_id": "engid", "category": "Категория", "short_desc": "Краткое описание", "image_url": "URL картинки или пусто", "full_desc": "<p>Полное описание HTML</p>", "price_rub": 10000, "price_usdt": 100, "reply": "Продукт сформирован. Добавляем в базу?"}

4. Удалить курс:
{"action": "delete_product", "product_name": "ID или имя курса для удаления", "reply": "Вы уверены, что хотите полностью удалить этот курс?"}

5. Поменять курсы местами:
{"action": "swap_products", "id_first": "ID первого", "id_second": "ID второго", "reply": "Готов поменять курсы местами. Подтверждаете?"}

6. Если команда непонятна:
{"action": "unknown", "reply": "Привет! Я ИИ-администратор. Напишите, что вы хотите сделать с курсами."}
        
ТВОЙ ОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО В ФОРМАТЕ JSON. Никакого маркдауна, никаких пояснений до или после. Никаких символов \`\`\`json.`;

        // Запрос к Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', 
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: 0.1 
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Ошибка Groq API: ${data.error?.message || 'Неизвестная ошибка'}`);
        }

        const aiText = data.choices[0].message.content.trim();
        
        // Пытаемся безопасно распарсить JSON
        let parsedResult;
        try {
            const cleanText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanText);
        } catch (parseError) {
            console.error('[JSON PARSE ERROR]', aiText);
            parsedResult = { 
                action: "error", 
                reply: "Произошла ошибка при генерации ответа. ИИ выдал неверный формат. Попробуйте еще раз." 
            };
        }

        return res.status(200).json({ success: true, data: parsedResult });

    } catch (error) {
        console.error('[API/ADMIN-CHAT ERROR]', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
