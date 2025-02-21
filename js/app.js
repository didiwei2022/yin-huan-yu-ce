// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initWebSocket();
    initUpdates();
});

// 初始化地图
function initMap() {
    const map = L.map('map').setView([34.2044, 117.2859], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
    return map;
}

// 初始化WebSocket连接
function initWebSocket() {
    const ws = new WebSocket('ws://' + window.location.host);
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');

    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        appendMessage('系统', '连接成功！我是徐州公交AI助手，请问有什么可以帮您？');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
            appendMessage('系统', '发送消息时出现错误，请稍后重试。');
            console.error('错误:', data.error);
        } else {
            appendMessage('assistant', data.response);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        appendMessage('系统', '连接已断开，请刷新页面重新连接。');
    };

    function appendMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender.toLowerCase()}`;
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 将聊天相关函数绑定到window对象，使其可以从HTML中访问
    window.sendMessage = () => {
        const message = chatInput.value.trim();
        if (message) {
            appendMessage('user', message);
            ws.send(JSON.stringify({
                type: 'chat',
                message: message
            }));
            chatInput.value = '';
        }
    };

    window.toggleChat = () => {
        const chatBody = document.querySelector('.chat-body');
        const minimizeBtn = document.getElementById('minimize-btn');
        if (chatBody.style.display === 'none') {
            chatBody.style.display = 'flex';
            minimizeBtn.textContent = '-';
        } else {
            chatBody.style.display = 'none';
            minimizeBtn.textContent = '+';
        }
    };

    // 绑定Enter键发送消息
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            window.sendMessage();
        }
    });
}

// 初始化更新功能
function initUpdates() {
    function updateWeatherInfo() {
        document.getElementById('temperature').textContent = Math.round(Math.random() * 20 + 10);
        document.getElementById('humidity').textContent = Math.round(Math.random() * 40 + 40);
        document.getElementById('wind-speed').textContent = (Math.random() * 5).toFixed(1);
        const conditions = ['晴朗', '多云', '小雨', '阴天'];
        document.getElementById('weather-condition').textContent = conditions[Math.floor(Math.random() * conditions.length)];
    }

    function updateRiskInfo() {
        const levels = ['低', '中', '高'];
        const factors = ['路面湿滑', '能见度低', '车流量大', '设备故障'];
        const actions = ['减速行驶', '保持距离', '加强巡检', '准备备用设备'];
        
        document.getElementById('risk-level').textContent = levels[Math.floor(Math.random() * levels.length)];
        document.getElementById('risk-factors').textContent = factors[Math.floor(Math.random() * factors.length)];
        document.getElementById('suggested-actions').textContent = actions[Math.floor(Math.random() * actions.length)];
    }

    // 设置定期更新
    setInterval(updateWeatherInfo, 5000);
    setInterval(updateRiskInfo, 7000);

    // 初始更新
    updateWeatherInfo();
    updateRiskInfo();
}
