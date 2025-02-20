const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  // 设置响应头优化传输
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Accept-Charset', 'utf-8');
  // 添加时间戳的日志函数
function logWithTimestamp(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}]`, message, data);
}

logWithTimestamp('REQUEST', '收到新请求', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });

  if (req.method !== 'POST') {
    console.log('[API] 非POST请求被拒绝');
    return res.status(405).json({ error: '只支持POST请求' });
  }

  try {
    const { message } = req.body;
    console.log('[API] 收到消息:', message);

    if (!message) {
      console.log('[API] 消息为空');
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    logWithTimestamp('SETUP', '开始请求配置');
    
    // 设置请求超时和重试机制
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    // 数据传输相关变量
    const FLUSH_INTERVAL = 100; // 每100ms刷新一次
    const CHUNK_SIZE = 1024; // 最大缓冲区1KB

    try {
      // 设置请求配置
      const requestConfig = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Charset': 'utf-8',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: `你是 DeepSeek徐州公交助手，你具备完整的DeepSeek-R1能力。`
          }, {
            role: 'user',
            content: message
          }],
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
          response_format: { type: 'text' }
        }),
        signal: controller.signal,
        compress: true,
        timeout: 30000
      };

      logWithTimestamp('REQUEST', '发送API请求', requestConfig);
      const response = await fetch('https://tbnx.plus7.plus/v1/chat/completions', requestConfig);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API请求失败: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      logWithTimestamp('RESPONSE', 'API请求成功');
      
      // 创建数据流
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let streamBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // 处理剩余数据
            if (streamBuffer) {
              const lines = streamBuffer.split('\n');
              for (const line of lines) {
                if (line.trim() && !line.includes('[DONE]')) {
                  try {
                    const jsonData = JSON.parse(line.replace(/^data: /, ''));
                    const content = jsonData.choices?.[0]?.delta?.content;
                    if (content) {
                      res.write(`data: ${JSON.stringify({ content })}\n\n`);
                    }
                  } catch (e) {
                    logWithTimestamp('ERROR', 'JSON解析错误', { error: e, line });
                  }
                }
              }
            }
            break;
          }
          
          // 解码新的数据块
          const chunk = decoder.decode(value, { stream: true });
          streamBuffer += chunk;
          
          // 处理完整的行
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || ''; // 保留最后一个不完整的行
          
          for (const line of lines) {
            if (line.trim() && !line.includes('[DONE]')) {
              try {
                const jsonData = JSON.parse(line.replace(/^data: /, ''));
                const content = jsonData.choices?.[0]?.delta?.content;
                if (content) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (e) {
                logWithTimestamp('ERROR', 'JSON解析错误', { error: e, line });
              }
            }
          }
        }

    if (!response.ok) {
      const error = await response.json();
      const errorInfo = {
        status: response.status,
        statusText: response.statusText,
        error: error,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      };
      console.error('[API] DeepSeek请求失败:', errorInfo);
      throw new Error(`DeepSeek API请求失败: ${response.status} ${error.error?.message || response.statusText}`);
    }
    console.log('[API] DeepSeek请求成功');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // 处理数据流
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            console.error('解析响应数据失败:', e);
          }
        }
      }
    }

    res.end();
              break; // 成功则退出重试循环
        } catch (error) {
            lastError = error;
            retryCount++;
            
            if (retryCount < MAX_RETRIES) {
                console.error(`请求失败，第${retryCount}次重试`, error);
                await sleep(RETRY_DELAY * retryCount); // 递增重试延迟
                continue;
            }
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      env: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      timestamp: new Date().toISOString(),
      apiKey: process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置'
    };
    console.error('[API] 错误:', errorInfo);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};
