export const config = {
  runtime: 'edge'
};

const logWithTimestamp = (message, ...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
};

const logErrorWithTimestamp = (message, ...args) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${message}`, ...args);
};

export default async function handler(req) {
  logWithTimestamp('收到新请求');
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: '只支持POST请求' }), 
      { 
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    );
  }

  try {
    const { message } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: '消息内容不能为空' }), 
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // 创建 TransformStream 用于流式响应
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // 重试函数
    const fetchWithRetry = async (url, options, maxRetries = 3) => {
      logWithTimestamp(`开始请求 DeepSeek API, 最大重试次数: ${maxRetries}`);
      let lastError;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          logWithTimestamp(`尝试第 ${i + 1} 次请求...`);
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`API错误: ${error}`);
          }

          return response;
        } catch (error) {
          lastError = error;
          if (i < maxRetries - 1) {
            const retryMsg = JSON.stringify({ 
              type: 'retry',
              attempt: i + 1,
              maxRetries,
              message: '连接中断，正在重试...'
            });
            await writer.write(encoder.encode(`data: ${retryMsg}\n\n`));
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          }
        }
      }
      throw lastError;
    };

    // 发起到 DeepSeek API 的请求
    const response = await fetchWithRetry('https://tbnx.plus7.plus/v1/chat/completions', {
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
                     回答时，请先用<思考中...>标签简要说明你的思考过程
                     `
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.8,
        max_tokens: 16000,
        stream: true
      })
    });

    // 处理流式响应
    const reader = response.body.getReader();
    let buffer = '';
    let lastDataTime = Date.now();
    const noDataTimeout = 10000;
    let timeoutId;

    const processStream = async () => {
      try {
        timeoutId = setInterval(() => {
          if (Date.now() - lastDataTime > noDataTimeout) {
            clearInterval(timeoutId);
            throw new Error('长时间未收到数据');
          }
        }, 1000);

        while (true) {
          logWithTimestamp('准备读取数据块...');
          const { done, value } = await reader.read();
          logWithTimestamp(`读取数据块完成, done: ${done}, 数据大小: ${value ? value.length : 0}`);
          
          if (done) {
            clearInterval(timeoutId);
            if (buffer) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  await writer.write(encoder.encode(`${line}\n\n`));
                }
              }
            }
            await writer.close();
            break;
          }

          lastDataTime = Date.now();
          const chunk = new TextDecoder().decode(value, { stream: true });
          buffer += chunk;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  await writer.write(encoder.encode(`data: [DONE]\n\n`));
                  continue;
                }

                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error.message || '服务器错误');
                }

                await writer.write(encoder.encode(`${line}\n\n`));
              } catch (error) {
                console.error('处理数据行错误:', error);
                const errorMsg = JSON.stringify({ 
                  error: error.message,
                  type: 'parse_error'
                });
                await writer.write(encoder.encode(`data: ${errorMsg}\n\n`));
              }
            }
          }
        }
      } catch (error) {
        clearInterval(timeoutId);
        logErrorWithTimestamp('流处理错误:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        const errorMsg = JSON.stringify({ 
          error: error.message,
          type: 'stream_error',
          timestamp: new Date().toISOString()
        });
        await writer.write(encoder.encode(`data: ${errorMsg}\n\n`));
        await writer.close();
      }
    };

    // 开始处理流
    processStream();

    // 返回流式响应
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: 'api_error',
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}
