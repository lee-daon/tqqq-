/**
 * 포트폴리오 분석 API 라우트 모듈
 * TQQQ와 다른 자산의 포트폴리오 성과 분석을 위한 엔드포인트 제공
 * @module portfolioRoutes
 */
import express from 'express';
import globalCache from '../utils/cache.js';
import { analyzePortfolio } from '../services/portfolioService.js';
import { fetchStockDataIfNeeded } from '../services/stockService.js';

const router = express.Router();

/**
 * 포트폴리오 분석 API 엔드포인트
 * TQQQ와 선택한 자산의 다양한 비율의 포트폴리오에 대한 분석 데이터 반환
 * 
 * @route GET /api/analyze
 * @param {string} asset - 분석할 자산 유형 (기본값: gld)
 * @returns {Object} 포트폴리오 분석 결과 (다양한 비율별 수익률, 변동성, 샤프 지수, MDD)
 */
router.get('/api/analyze', async (req, res) => {
  try {
    const assetType = req.query.asset || 'gld'; // 기본값은 GLD
    
    // 캐시 키
    const cacheKey = `portfolios_${assetType}`;
    
    // 이미 계산된 포트폴리오 데이터가 있는지 확인
    if (globalCache[cacheKey] && globalCache.lastFetch && 
        (new Date().getTime() - globalCache.lastFetch) < 24 * 60 * 60 * 1000) { // 24시간 유효
      console.log(`캐시된 포트폴리오 분석 데이터 사용 (${assetType})`);
      return res.json({
        portfolios: globalCache[cacheKey],
        rawData: {
          tqqq: globalCache.tqqq,
          [assetType]: globalCache[assetType],
          qqq: globalCache.qqq
        },
        maData: globalCache.maData
      });
    }
    
    // 각 주식 데이터 가져오기
    await fetchStockDataIfNeeded(assetType, req.app.get('port'));
    
    // 포트폴리오 분석 데이터 생성
    const portfoliosData = await analyzePortfolio(assetType);

    // 결과를 캐시에 저장
    globalCache[cacheKey] = portfoliosData;
    globalCache.lastFetch = new Date().getTime();
    
    res.json({
      portfolios: portfoliosData,
      rawData: {
        tqqq: globalCache.tqqq,
        [assetType]: globalCache[assetType],
        qqq: globalCache.qqq
      },
      maData: globalCache.maData
    });
  } catch (error) {
    console.error('Error analyzing portfolio:', error);
    res.status(500).json({ error: 'Failed to analyze portfolio' });
  }
});

export default router; 