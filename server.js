import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chatHandler from './pages/api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json());

// 设置 API 路由
app.post('/api/chat', chatHandler);

// 静态文件服务
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 