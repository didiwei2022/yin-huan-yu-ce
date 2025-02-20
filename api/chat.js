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

    console.log('[API] 设置响应头');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    logWithTimestamp('SETUP', '响应头设置完成');
    // 数据传输相关变量
    let messageLength = 0;
    let chunkCount = 0;
    let buffer = '';
    let lastFlushTime = Date.now();
    const FLUSH_INTERVAL = 500; // 每500ms刷新一次
    const MAX_BUFFER_SIZE = 1024; // 最大缓冲区1KB

    // 设置请求超时
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2分钟超时

    try {
        // 设置请求超时和重试机制
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

try {
    // 设置请求配置
    const requestConfig = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 4000,
            stream: true
        }),
        compress: true,
        timeout: 30000
    };

    const response = await fetch('https://tbnx.plus7.plus/v1/chat/completions', requestConfig);

    // 检查响应状态
    if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
    }

    // 设置响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 创建数据流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        signal: controller.signal,
            signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer sk-PUtZrBTu6ENsjgpjQMJWS3zs1uu7Bru0QfIeCJB3LQuAWuGc`
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [
          {
            role: "system",
            content: `你是 DeepSeek徐州公交办公助手，你具备完整的DeepSeek-R1能力。
                     `
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.8,
        max_tokens: 16000,  // 增加 token 限制
        stream: true  // 启用流式响应
      })
    });

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
