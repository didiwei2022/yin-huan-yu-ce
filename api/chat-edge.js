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
    const fetchWithRetry = async (url, options, maxRetries = 5) => { // 增加重试次数
      const CHUNK_SIZE = 2000; // 增加到2000字符，减少分块数量
      const messages = options.body ? JSON.parse(options.body).messages : [];
      
      // 分块处理长消息
      if (messages.length > 0 && messages[messages.length - 1].content.length > CHUNK_SIZE) {
        const longMessage = messages[messages.length - 1].content;
        const chunks = [];
        for (let i = 0; i < longMessage.length; i += CHUNK_SIZE) {
          chunks.push(longMessage.slice(i, i + CHUNK_SIZE));
        }
        messages[messages.length - 1].content = chunks[0];
        logWithTimestamp(`消息已分块，共 ${chunks.length} 块`);
      }
      
      options.body = JSON.stringify({
        ...JSON.parse(options.body),
        messages
      });
      logWithTimestamp(`开始请求 DeepSeek API, 最大重试次数: ${maxRetries}`);
      let lastError;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 180000); // 增加到3分钟 // 增加超时时间到120秒 // 增加超时时间到60秒

          logWithTimestamp(`尝试第 ${i + 1} 次请求...`);
          logWithTimestamp(`尝试第 ${i + 1} 次请求，消息长度: ${options.body.length}`);
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
        temperature: 0.8,
        max_tokens: 16000, // 增加token限制，支持更长回复
        presence_penalty: 0.1, // 降低重复惩罚
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
    const noDataTimeout = 30000; // 增加到30秒
    let timeoutId;

    const processStream = async () => {
      try {
        let retryCount = 0;
        const maxStreamRetries = 3;
        
        timeoutId = setInterval(() => {
          if (Date.now() - lastDataTime > noDataTimeout) {
            if (retryCount < maxStreamRetries) {
              retryCount++;
              lastDataTime = Date.now(); // 重置计时器
              const retryMsg = JSON.stringify({
                type: 'stream_retry',
                attempt: retryCount,
                maxRetries: maxStreamRetries,
                message: '流处理中断，正在重试...'
              });
              writer.write(encoder.encode(`data: ${retryMsg}\n\n`)).catch(console.error);
            } else {
              clearInterval(timeoutId);
              throw new Error('长时间未收到数据，超过重试次数');
            }
          }
        }, 1000);

        while (true) {
          logWithTimestamp('准备读取数据块...');
          const { done, value } = await reader.read();
          logWithTimestamp(`读取数据块完成, done: ${done}, 数据大小: ${value ? value.length : 0}`);
          
          if (done) {
            clearInterval(timeoutId);
            try {
              if (buffer) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                  if (line.trim() && line.startsWith('data: ')) {
                    await writer.write(encoder.encode(`${line}\n\n`));
                  }
                }
              }
              // 发送完成标记
              await writer.write(encoder.encode('data: {"type":"complete"}\n\n'));
              await writer.close();
            } catch (error) {
              console.error('关闭流时发生错误:', error);
            }
            break;
          }

          lastDataTime = Date.now();
          const chunk = new TextDecoder().decode(value, { stream: true });
          buffer += chunk;
          
          // 使用正则表达式确保完整的JSON对象
          const lines = buffer.split(/\n(?=data:)/);
          buffer = lines.pop() || '';
          
          // 尝试合并不完整的JSON
          let incompleteJson = '';
          let isPartialJson = false;

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                let data = line.slice(6).trim();
                
                // 处理不完整的JSON
                if (isPartialJson) {
                  incompleteJson += data;
                  data = incompleteJson;
                  isPartialJson = false;
                  incompleteJson = '';
                }
                
                if (data === '[DONE]') {
                  await writer.write(encoder.encode(`data: [DONE]\n\n`));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    throw new Error(parsed.error.message || '服务器错误');
                  }
                  await writer.write(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                } catch (jsonError) {
                  if (jsonError instanceof SyntaxError) {
                    // JSON不完整，保存并等待下一个块
                    isPartialJson = true;
                    incompleteJson = data;
                    continue;
                  }
                  throw jsonError;
                }
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
