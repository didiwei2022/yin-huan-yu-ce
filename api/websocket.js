import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';

let wss;

export function initWebSocket(server) {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');
        
        ws.on('message', async (message) => {
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

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    
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
