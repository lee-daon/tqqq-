import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import open from 'open';

// 라우터 가져오기
import stockRoutes from './routes/stockRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';

// ES 모듈에서 __dirname 얻기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 포트 설정 저장
app.set('port', PORT);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// 라우터 설정
app.use(stockRoutes);
app.use(portfolioRoutes);

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`Yahoo Finance API로 데이터를 불러옵니다`);
  
  // 브라우저에서 자동으로 열기
  open(`http://localhost:${PORT}`);
});
