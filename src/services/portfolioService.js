/**
 * 포트폴리오 분석 서비스 모듈
 * TQQQ와 다른 자산의 포트폴리오 성과를 분석하는 함수 제공
 * @module portfolioService
 */
import globalCache from '../utils/cache.js';
import { calculateAnnualReturn, calculateVolatility, calculateMDD } from '../utils/calculators.js';

/**
 * 다양한 비율의 TQQQ와 선택한 자산의 포트폴리오 성과 분석
 * 5% 단위로 각 포트폴리오의 연평균 수익률, 변동성, 샤프 지수, MDD 계산
 * 
 * @async
 * @param {string} assetType - 분석할 자산 유형 (기본값: 'gld')
 * @returns {Array<Object>} 포트폴리오 분석 결과 배열 (다양한 비율별 통계)
 */
async function analyzePortfolio(assetType = 'gld') {
  // 포트폴리오 분석 데이터 생성
  const portfoliosData = [];
  
  // 5% 단위로 TQQQ와 선택한 자산 포트폴리오 생성
  for (let tqqqWeight = 0; tqqqWeight <= 100; tqqqWeight += 5) {
    const assetWeight = 100 - tqqqWeight;
    
    // 각 기간별 성과 계산
    const periodResults = {};
    [1, 3, 5, 10].forEach(years => {
      // 기간에 해당하는 데이터 필터링
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      
      const periodTqqq = globalCache.tqqq.filter(item => item.date >= cutoffDateString);
      const periodAsset = globalCache[assetType].filter(item => item.date >= cutoffDateString);
      
      if (periodTqqq.length < 10 || periodAsset.length < 10) return; // 데이터가 너무 적은 경우 스킵
      
      // 연평균 수익률, 변동성, MDD 계산
      const annualReturn = calculateAnnualReturn(periodTqqq, periodAsset, tqqqWeight, assetWeight);
      const volatility = calculateVolatility(periodTqqq, periodAsset, tqqqWeight, assetWeight);
      const sharpeRatio = (annualReturn - 0.02) / volatility; // 무위험 수익률 2% 가정
      const mdd = calculateMDD(periodTqqq, periodAsset, tqqqWeight, assetWeight);
      
      periodResults[`${years}year`] = {
        annualReturn: parseFloat(annualReturn.toFixed(4)),
        volatility: parseFloat(volatility.toFixed(4)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(4)),
        mdd: parseFloat(mdd.toFixed(4)),
      };
    });
    
    portfoliosData.push({
      tqqqWeight: tqqqWeight,
      assetWeight: assetWeight,
      ...periodResults
    });
  }
  
  return portfoliosData;
}

export { analyzePortfolio }; 