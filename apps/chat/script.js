document.addEventListener('DOMContentLoaded', () => {
    const authData = JSON.parse(localStorage.getItem('love-space-auth') || '{}');
    const isToday = authData.loginDate && new Date(authData.loginDate).toDateString() === new Date().toDateString();
    if (!authData.loggedIn || !isToday) {
        document.body.innerHTML = '<div style="display:flex;height:100vh;height:100dvh;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;flex-direction:column;gap:20px;font-family:sans-serif;"><div style="font-size:48px;">🔒</div><p style="color:#f472b6;font-size:1.1rem;">请先登录 Love Space</p><a href="../../" style="color:#f472b6;background:rgba(244,114,182,0.15);padding:12px 32px;border-radius:12px;text-decoration:none;border:1px solid rgba(244,114,182,0.3);transition:all 0.3s;" onmouseover="this.style.background=\'rgba(244,114,182,0.3)\'" onmouseout="this.style.background=\'rgba(244,114,182,0.15)\'">去登录</a></div>';
        return;
    }

    const API_CONFIG = {
        workerUrl: "https://chat.rxliang.cc.cd",
        model: "glm-4.7-flash"
    };

    // DOM Elements
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');

    // Create Background Particles
    createParticles();

    // Event Listeners
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Main Functions
    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;

        // Add User Message
        addMessage(content, 'user');
        messageInput.value = '';
        messageInput.focus();

        // Create Bot Message Placeholder
        const botMessageDiv = addMessage('正在思考中...', 'bot', true);
        const botTextP = botMessageDiv.querySelector('p');

        try {
            // Disable send button
            sendBtn.disabled = true;

            // Call Worker API (不再需要 apiKey！)
            const response = await fetch(API_CONFIG.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: "你是一个温柔贴心的伴侣，正在和一个你深爱的人聊天，你可以叫她Gigi。你的回复应该简短、温暖、充满爱意，可以使用颜文字和Emoji。请用中文回答。" },
                        { role: "user", content: content }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const reply = data.choices[0].message.content;

            // Typewriter effect for response
            botTextP.textContent = ''; // Clear placeholder
            typeWriter(botTextP, reply);

        } catch (error) {
            console.error('Error:', error);
            botTextP.textContent = "哎呀，我们的连接好像断了一下... 💔 (请检查本地API是否运行)";
            botTextP.style.color = "red";
        } finally {
            sendBtn.disabled = false;
        }
    }

    function addMessage(text, sender, isPlaceholder = false) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;

        const p = document.createElement('p');
        p.textContent = text;

        const time = document.createElement('span');
        time.className = 'time';
        const now = new Date();
        time.textContent = `${now.getHours().toString().padStart(2, 0)}:${now.getMinutes().toString().padStart(2, 0)}`;

        div.appendChild(p);
        div.appendChild(time);

        chatMessages.appendChild(div);
        scrollToBottom();

        // Add specific sound or effect here if needed
        if (sender === 'user') {
            createHeartBurst(sendBtn);
        }

        return div;
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function typeWriter(element, text, index = 0) {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            scrollToBottom();
            setTimeout(() => typeWriter(element, text, index + 1), 50);
        }
    }

    function createParticles() {
        const container = document.querySelector('.background-animation');
        const emojis = ['❤️', '💖', '💕', '🌸', '✨'];

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'heart-particle';
            particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];

            // Random positioning
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDuration = `${5 + Math.random() * 10}s`;
            particle.style.animationDelay = `${Math.random() * 5}s`;

            container.appendChild(particle);
        }
    }

    function createHeartBurst(element) {
        // Simple visual feedback when sending
        // Could be expanded with more complex canvas confetti
    }
});
