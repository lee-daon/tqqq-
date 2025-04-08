/**
 * 주식 데이터 API 라우트 모듈
 * Yahoo Finance로부터 주식 데이터를 가져오는 엔드포인트 제공
 * @module stockRoutes
 */
import express from 'express';
import globalCache from '../utils/cache.js';
import { fetchYahooFinanceData } from '../services/stockService.js';

const router = express.Router();

/**
 * 주식 데이터 API 엔드포인트
 * 특정 주식 심볼에 대한 히스토리컬 데이터를 반환
 * 
 * @route GET /api/stock/:symbol
 * @param {string} symbol - 주식 심볼 (예: TQQQ, GLD)
 * @returns {Object} 주식 데이터 (날짜별 가격 정보)
 */
router.get('/api/stock/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const symbolLower = symbol.toLowerCase();
    
    // 캐시된 데이터가 있는지 확인
    if (globalCache[symbolLower]) {
      console.log(`캐시된 데이터 사용: ${symbol}`);
      return res.json(globalCache[symbolLower]);
    }
    
    // Yahoo Finance API 호출
    console.log(`Yahoo Finance API 호출: ${symbol}`);
    const data = await fetchYahooFinanceData(symbol);
    
    // 전역 캐시에 데이터 저장
    globalCache[symbolLower] = data;
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stock data' });
  }
});

export default router; 