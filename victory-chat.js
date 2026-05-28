// === victory-chat.js (Единый движок ИИ-консультанта) ===

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Встраиваем HTML чата на любую страницу, где подключен этот скрипт
    const chatHTML = `
        <div id="ai-trigger" onclick="toggleChat()">✧</div>
        <div id="ai-window">
            <div style="padding: 20px; border-bottom: 1px solid var(--border); text-align: center; font-size: 11px; letter-spacing: 2px; font-weight: 700;">VICTORY AI</div>
            <div id="chat-messages"><div class="msg msg-ai">Приветствую. Я помогу вам сориентироваться в практиках. Что вас беспокоит?</div></div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="Ваш вопрос..." style="flex: 1; background: transparent; border: 1px solid var(--border); border-radius: 30px; padding: 10px 15px; color: white; outline: none; font-size: 13px;">
                <button onclick="sendChat()" style="background: var(--accent); border: none; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; color: var(--deep); font-weight: 800;">→</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);

    // Подключаем отправку по Enter
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    // 2. Тихо подгружаем список актуальных курсов из базы для ИИ
    window.victoryCourses = [];
    try {
        const res = await fetch('/api/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read', sheetName: 'Products', range: 'A:B' }) // Берем только ID и Названия
        });
        const data = await res.json();
        if (data.success && data.data) {
            data.data.forEach((row, i) => {
                if (i > 0 && row[0] && row[1]) {
                    window.victoryCourses.push({ id: row[0].trim(), title: row[1].trim() });
                }
            });
        }
    } catch (e) { console.error('Ошибка загрузки базы для ИИ', e); }
});

// Функции управления чатом
window.toggleChat = function() {
    const win = document.getElementById('ai-window');
    win.style.display = (win.style.display === 'flex') ? 'none' : 'flex';
}

function createChatBtn(text, link, color = 'var(--accent)') {
    return `<a href="${link}" target="_blank" class="btn-main" style="display:block; margin-top:10px; padding:12px; text-decoration:none; text-align:center; font-size:11px; border-color:${color}; background: rgba(168, 218, 220, 0.1); color: #fff; border-radius: 10px; border: 1px solid ${color};">${text}</a>`;
}

window.sendChat = async function() {
    const input = document.getElementById('chat-input');
    const box = document.getElementById('chat-messages');
    const userText = input.value.trim();
    if (!userText) return;

    box.innerHTML += `<div class="msg msg-user">${userText}</div>`;
    input.value = '';
    box.scrollTop = box.scrollHeight;

    const typingId = 'typing-' + Date.now();
    box.innerHTML += `<div id="${typingId}" class="msg msg-ai" style="opacity: 0.6; font-size: 11px;">Victory AI печатает...</div>`;
    box.scrollTop = box.scrollHeight;

    // Собираем "шпаргалку" из актуальных курсов для ИИ
    const coursesContext = window.victoryCourses.map(c => `ID: ${c.id}, Название: ${c.title}`).join(' | ');

    try {
        const response = await fetch('https://tantra-ai.vercel.app/ask-doctor', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: userText,
                context: coursesContext // Передаем список серверу!
            })
        });
        
        const data = await response.json();
        let reply = data.reply;

        setTimeout(() => {
            const typingElem = document.getElementById(typingId);
            if (typingElem) typingElem.remove();

            // Динамически превращаем новые умные теги ИИ [COURSE:id] в красивые кнопки
            let formattedText = reply.replace(/\[COURSE:([a-zA-Z0-9_-]+)\]/gi, (match, courseId) => {
                const course = window.victoryCourses.find(c => c.id.toLowerCase() === courseId.toLowerCase());
                if (course) {
                    return createChatBtn(`Программа: ${course.title}`, `/course.html?id=${course.id}`);
                }
                return ''; 
            });

            // Оставляем поддержку старых кнопок и связи с Викторией
            formattedText = formattedText
                .replaceAll('[BUTTON_VIKA]', createChatBtn('Написать Виктории', 'https://t.me/vika_breathe', '#fff'))
                .replaceAll('[BUTTON_VOST]', createChatBtn('Программа: Код восстановления', '/course.html?id=vostanovlenie'))
                .replaceAll('[BUTTON_PRANA]', createChatBtn('Программа: Код Прана дыхание', '/course.html?id=prana'))
                .replaceAll('[BUTTON_ANTISTRESS]', createChatBtn('Программа: Анти-стресс', '/course.html?id=antistress'));

            box.innerHTML += `<div class="msg msg-ai"><div style="font-size: 9px; color: var(--accent); margin-bottom: 4px; font-weight: bold; letter-spacing: 1px;">VICTORY AI</div>${formattedText}</div>`;
            box.scrollTop = box.scrollHeight;
        }, 2500);

    } catch (e) {
        const typingElem = document.getElementById(typingId);
        if (typingElem) typingElem.remove();
        box.innerHTML += `<div class="msg msg-ai">Victory AI: На линии помехи. Повтори, пожалуйста.</div>`;
    }
}
