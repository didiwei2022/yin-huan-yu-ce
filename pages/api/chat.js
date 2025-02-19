const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    // 设置响应头以支持流式传输
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const response = await fetch('https://tbnx.plus7.plus/v1/chat/completions', {
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
            content: `你是 DeepSeek交控办公助手，专为徐州公交公司、交控部门及相关办公人员 设计的 AI 助手。你的目标是高效、专业、精准地辅助用户完成日常办公任务。
                     回答时，请先用<think>标签简要说明你的思考过程，
                     然后再给出正式的、专业的回答。
                     你的回答应该准确、专业，并注重实用性。`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,  // 增加 token 限制
        stream: true  // 启用流式响应
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

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
  } catch (error) {
    console.error('API 错误:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

export default handler; 