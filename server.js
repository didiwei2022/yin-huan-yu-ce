import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(__dirname));

// API 路由处理
app.all('/api/*', async (req, res) => {
  const path = req.path.replace('/api/', '');
  console.log('API 请求路径:', path);
  
  if (path === 'chat') {
    return chatHandler(req, res);
  }
  
  res.status(404).json({ error: '未找到 API 端点' });
});

// 所有其他路由返回 index.html
app.get('*', (req, res) => {
  console.log('请求路径:', req.path);
  res.sendFile(join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('当前工作目录:', __dirname);
});