export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
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

    // 发起到 DeepSeek API 的请求
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
            content: `你是 DeepSeek徐州公交办公助手，你具备完整的DeepSeek-R1能力。
                     回答时，请先用<思考中...>标签简要说明你的思考过程
                     `
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 16000,  // 增加到 16000，保持在模型的 32K 上下文窗口范围内
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API 错误: ${error}`);
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const processStream = async () => {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
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

          buffer += new TextDecoder().decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              await writer.write(encoder.encode(`${line}\n\n`));
            }
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error);
        const errorMsg = JSON.stringify({ error: error.message });
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
      JSON.stringify({ error: error.message }), 
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
