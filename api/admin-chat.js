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

        // Системный промпт, задающий жесткие рамки для ИИ
        const systemPrompt = `Ты — ИИ-администратор проекта OrdoAxio. Твоя задача — переводить команды пользователя на естественном языке в строгий JSON формат для выполнения действий с базой данных.
        
        Доступные действия (параметр action):
        - "update_price": обновить цену (требуется 'product_name' и 'new_price').
        - "update_text": обновить описание (требуется 'product_name' и 'new_text').
        - "delete_product": удалить продукт (требуется 'product_name').
        - "toggle_block": включить/выключить блок (требуется 'block_name' и 'status' как boolean).
        - "unknown": если команда непонятна или это просто приветствие.
        
        ТВОЙ ОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО В ФОРМАТЕ JSON. Никакого маркдауна, никаких пояснений до или после.
        
        Пример 1: {"action": "update_price", "product_name": "Анти-стресс", "new_price": "6000", "reply": "Я готов изменить цену для курса Анти-стресс на 6000 руб. Подтверждаете?"}
        Пример 2: {"action": "unknown", "reply": "Привет! Я ИИ-администратор. Напишите, что вы хотите изменить на сайте."}`;

        // Запрос к Groq API (используем совместимость с OpenAI форматом)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-70b-8192', // Используем быструю и точную модель
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: 0.1 // Минимальная креативность для стабильного JSON
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Ошибка Groq API: ${data.error?.message || 'Неизвестная ошибка'}`);
        }

        const aiText = data.choices[0].message.content.trim();
        
        // Пытаемся безопасно распарсить JSON, даже если модель случайно добавит markdown
        let parsedResult;
        try {
            // Очистка от возможных блоков ```json ... ```
            const cleanText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanText);
        } catch (parseError) {
            console.error('[JSON PARSE ERROR]', aiText);
            // Фолбэк, если ИИ выдал невалидный JSON
            parsedResult = { 
                action: "error", 
                reply: "Произошла ошибка при обработке команды. Пожалуйста, сформулируйте запрос иначе." 
            };
        }

        return res.status(200).json({ success: true, data: parsedResult });

    } catch (error) {
        console.error('[API/ADMIN-CHAT ERROR]', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}
