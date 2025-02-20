import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';

let wss;

export function initWebSocket(server) {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');
        
        // 添加心跳检测
let heartbeatInterval;

ws.on('message', async (message) => {
    // 清除旧的心跳定时器
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    // 设置新的心跳定时器
    heartbeatInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 30000); // 每30秒发送一次心跳
            try {
                const data = JSON.parse(message);
                
                // 调用DeepSeek API
                const response = await fetch('https://tbnx.plus7.plus/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive'
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: data.messages,
                        temperature: 0.7,
                        max_tokens: 4000,
                        stream: true
                    })
                });

                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status}`);
                }

                console.log('开始读取API响应');
const reader = response.body.getReader();
let streamStartTime = Date.now();
                const decoder = new TextDecoder();
                let buffer = '';
                
                while (true) {
                    const { done, value } = await reader.read();
const chunk = decoder.decode(value);

// 解析每个数据块
try {
    const lines = chunk.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() === '[DONE]') {
                console.log('收到流结束标记');
                continue;
            }
            const jsonData = JSON.parse(jsonStr);
            if (jsonData.choices && jsonData.choices[0].delta.content) {
                buffer += jsonData.choices[0].delta.content;
            }
        }
    }
    
    // 每500ms发送一次数据
    const now = Date.now();
    if (now - streamStartTime >= 500 && buffer) {
        console.log(`发送数据: ${buffer.length} 字符`);
        ws.send(JSON.stringify({ type: 'content', data: buffer }));
        buffer = '';
        streamStartTime = now;
    }
} catch (error) {
    console.error('数据解析错误:', error, '原始数据:', chunk);
}
                    
                    if (done) {
                        if (buffer) {
                            ws.send(JSON.stringify({ type: 'content', data: buffer }));
                        }
                        ws.send(JSON.stringify({ type: 'done' }));
                        break;
                    }
                    
                    buffer += decoder.decode(value);
                    
                    // 每积累一定量的数据就发送一次
                    if (buffer.length >= 1024) {
                        ws.send(JSON.stringify({ type: 'content', data: buffer }));
                        buffer = '';
                    }
                }
            } catch (error) {
                console.error('WebSocket错误:', error);
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: error.message 
                }));
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket错误:', error);
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
}

export function getWSS() {
    return wss;
}
