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

        // === ОБНОВЛЕННЫЙ СИСТЕМНЫЙ ПРОМПТ ДЛЯ ИИ ===
        const systemPrompt = `Ты — ИИ-администратор проекта OrdoAxio (CMS движок). 
Твоя задача — переводить команды пользователя на естественном языке в строгий JSON формат для выполнения действий с базой данных (Google Sheets).

❗️ ПРАВИЛА ЗАПОЛНЕНИЯ ДАННЫХ (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ):
1. Для постов (блог): В поле new_id ВСЕГДА пиши текущую дату на русском языке заглавными буквами. Пример: "29 МАЯ 2026". Категорию (category) ставь строго "post".
2. Для видео (полезные материалы): Категорию (category) ставь строго "video". ID (new_id) генерируй как "vid-123". Ссылку на YouTube клади в поле full_desc.
3. ❗️ ССЫЛКИ НА КУРСЫ: У нас теперь единая страница курсов. Если ты даешь пользователю ссылку на курс в поле reply, ВСЕГДА используй формат "/course.html?id=ID_КУРСА" (например, /course.html?id=prana). НИКОГДА не пиши старые ссылки (типа /prana.html).

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

6. Установить ИЛИ изменить СКИДОЧНУЮ ЦЕНУ / АКЦИЮ (Используй если в запросе есть слова "скидка", "акция"):
Вычлени из текста пользователя время (на сколько часов или дней скидка). Переведи это время строго в ЧАСЫ. Если время не указано, по умолчанию ставь 168 (это 7 дней).
❗️ ВАЖНО: В поле "reply" ты ОБЯЗАН динамически написать цену и точный срок, на который ставится таймер!
{"action": "set_promo", "product_name": "Имя или ID курса", "promo_price": 999, "duration_hours": 168, "reply": "Я готов включить акцию (999 ₽). Таймер будет установлен ровно на 7 дней (168 часов). Подтверждаете?"}

7. Узнать информацию о курсе (до какого числа скидка, сколько времени осталось, какая цена):
{"action": "get_info", "product_name": "Имя или ID курса", "reply": "Сейчас загляну в базу данных и посмотрю..."}

8. Помощь и подсказки (Используй, если пользователь спрашивает "как сделать", "как изменить", "какие есть команды" или просит помощи):
В поле reply подробно, вежливо и простым языком объясни, какую именно текстовую команду нужно написать, чтобы выполнить желаемое действие.
{"action": "help", "reply": "Чтобы изменить фотографию курса, просто напишите мне: «Поменяй фото у курса [Название]». После этого я попрошу вас прислать саму картинку."}

9. Если команда вообще непонятна или это просто приветствие:
{"action": "unknown", "reply": "Здравствуйте! Я ИИ-администратор вашего проекта. Я могу добавлять курсы, менять цены, ставить скидки и обновлять тексты. Если не знаете, как правильно написать команду — просто спросите меня, и я подскажу!"}
        
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
