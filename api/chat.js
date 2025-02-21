const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒
const TIMEOUT_DURATION = 55000; // 设置为略小于 Vercel 60s 限制

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  // 设置响应头优化传输
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (req.method !== 'POST') {
    console.log('[API] 非POST请求被拒绝');
    return res.status(405).json({ error: '只支持POST请求' });
  }

  try {
    const { message } = req.body;
    if (!message) {
      console.log('[API] 消息为空');
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    let controller = new AbortController(); // 将 controller 移到这里
    let timeoutId;

    try {
      const requestConfig = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Charset': 'utf-8',
          'Connection': 'keep-alive',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
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

      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_RETRIES && !success) {
        try {
          // 每次重试前重置 controller 和 timeout
          if (timeoutId) clearTimeout(timeoutId);
          controller = new AbortController();
          timeoutId = setTimeout(() => {
            controller.abort();
            console.log(`[API] 请求超时，第${retryCount + 1}次尝试`);
          }, TIMEOUT_DURATION);

          requestConfig.signal = controller.signal;
          
          const response = await fetch('https://tbnx.plus7.plus/v1/chat/completions', requestConfig);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          // 处理成功响应
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
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

          success = true;
        } catch (error) {
          console.error(`请求失败，第${retryCount + 1}次尝试:`, error);
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            await sleep(RETRY_DELAY * retryCount);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('API请求失败:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('处理请求失败:', error);
    res.status(500).json({ error: error.message });
  }
}
