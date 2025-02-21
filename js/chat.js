document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messages');
    const minimizeBtn = document.getElementById('minimizeChat');
    const chatContainer = document.getElementById('chatContainer');

    // 添加欢迎消息
    appendMessage('assistant', '您好！我是徐州公交AI助手，很高兴为您服务。我可以帮助您解答关于公交运营、安全管理、服务提升等方面的问题。');

    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageDiv;
    }

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // 禁用输入和发送按钮
        chatInput.value = '';
        chatInput.disabled = true;
        sendButton.disabled = true;

        // 显示用户消息
        appendMessage('user', message);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 创建新的助手消息容器
            const assistantMessage = appendMessage('assistant', '');
            let fullResponse = '';

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.trim() === '' || line.includes('[DONE]')) continue;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.content) {
                                fullResponse += data.content;
                                assistantMessage.textContent = fullResponse;
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }
                        } catch (e) {
                            console.error('解析响应数据失败:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            appendMessage('error', `发送消息失败: ${error.message}`);
        } finally {
            // 重新启用输入和发送按钮
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.focus();
        }
    }

    // 事件监听器
    sendButton.addEventListener('click', sendMessage);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 最小化/最大化功能
    function toggleMinimize(e) {
        // 如果点击的是输入框或发送按钮，不触发最小化
        if (e && (e.target === chatInput || e.target === sendButton)) {
            return;
        }
        
        chatContainer.classList.toggle('minimized');
        minimizeBtn.textContent = chatContainer.classList.contains('minimized') ? '+' : '−';
    }

    // 最小化按钮点击事件
    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        toggleMinimize();
    });

    // 点击标题栏也可以最小化/展开
    document.querySelector('.chat-header').addEventListener('click', toggleMinimize);

    const quickActionButtons = document.querySelectorAll('.quick-action');

    quickActionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const prompt = button.getAttribute('data-prompt');
            chatInput.value = prompt;
            chatInput.focus();
        });
    });
});
