import express from 'express';
import { createServer } from 'http';
import { initWebSocket } from './api/websocket.js';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(__dirname));

// API 路由处理
app.post('/api/chat', async (req, res) => {
  console.log('[本地服务器] API 请求:', req.path);
  return chatHandler(req, res);
});

// 所有其他路由返回 index.html
app.get('*', (req, res) => {
  console.log('[本地服务器] 页面请求:', req.path);
  res.sendFile(join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
// 初始化WebSocket
initWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('当前工作目录:', __dirname);
  console.log('环境:', process.env.NODE_ENV || 'development');
});