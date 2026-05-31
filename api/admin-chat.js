// api/admin-chat.js

export default async function handler(req, res) {
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

        // === ВЫСЧИТЫВАЕМ ДАТУ НА СЕРВЕРЕ (СЕГОДНЯ + 3 ДНЯ) ДЛЯ ИИ ===
        const d = new Date();
        d.setDate(d.getDate() + 3);
        const pad = (n) => n < 10 ? '0' + n : n;
        const defaultPromoDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

        // === ОБНОВЛЕННЫЙ СИСТЕМНЫЙ ПРОМПТ ДЛЯ ИИ ===
        const systemPrompt = `Ты — ИИ-администратор проекта OrdoAxio (CMS движок). 
Твоя задача — переводить команды пользователя на естественном языке в строгий JSON формат для выполнения действий с базой данных (Google Sheets).

❗️ ПРАВИЛА ЗАПОЛНЕНИЯ ДАННЫХ (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ):
1. Для временных акций (скидочных цен): Дату и время окончания ВСЕГДА пиши в строгом международном формате ISO 8601. Сейчас я передаю тебе точную дату окончания скидки (на 3 дня вперед), всегда используй её: "${defaultPromoDate}".
2. Для постов (блог): В поле new_id ВСЕГДА пиши текущую дату на русском языке заглавными буквами. Пример: "29 МАЯ 2026". Категорию (category) ставь строго "post".
3. Для видео (полезные материалы): Категорию (category) ставь строго "video". ID (new_id) генерируй как "vid-123". Ссылку на YouTube клади в поле full_desc.

ОБЯЗАТЕЛЬНЫЕ ФОРМАТЫ ОТВЕТОВ (выбери один подходящий action):

1. Обновить ОСНОВНУЮ цену (Используй ТОЛЬКО если просят поменять обычную цену, БЕЗ слов "скидка" или "акция"):
{"action": "update_price", "product_name": "Имя или ID курса", "new_price": 5000, "reply": "Я готов изменить основную цену. Подтверждаете?"}

2. Обновить описание:
{"action": "update_text", "product_name": "Имя или ID курса", "new_text": "Новый текст", "reply": "Я готов изменить описание. Подтверждаете?"}

3. Создать новый контент (Курс, Видео или Пост):
СГЕНЕРИРУЙ все поля. Если это курс: new_id - это одно слово на английском мелкими буквами, а price_usdt = price_rub / 100.
{"action": "create_product", "product_name": "Название", "new_id": "engid (или дата для поста)", "category": "Категория (post, video или Курс)", "short_desc": "Краткое описание", "image_url": "URL картинки или пусто", "full_desc": "<p>Полное описание HTML</p> (или ссылка на видео)", "price_rub": 10000, "price_usdt": 100, "reply": "Контент сформирован. Добавляем в базу?"}

4. Удалить контент:
{"action": "delete_product", "product_name": "ID или имя для удаления", "reply": "Вы уверены, что хотите удалить?"}

5. Поменять курсы местами:
{"action": "swap_products", "id_first": "ID первого", "id_second": "ID второго", "reply": "Готов поменять местами. Подтверждаете?"}

6. Установить ИЛИ изменить СКИДОЧНУЮ ЦЕНУ / АКЦИЮ (Используй если в запросе есть слова "скидка", "акция", "скидочная цена"):
{"action": "set_promo", "product_name": "Имя или ID курса", "promo_price": 999, "promo_date": "${defaultPromoDate}", "reply": "Скидочная цена обновлена. Включаем таймер на сайте?"}

7. Если команда непонятна:
{"action": "unknown", "reply": "Привет! Я ИИ-администратор. Напишите, что вы хотите сделать с контентом."}
        
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
