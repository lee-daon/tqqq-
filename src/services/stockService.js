import axios from 'axios';
import globalCache from '../utils/cache.js';
import { calculateMovingAverage } from '../utils/calculators.js';

// 주식 데이터를 가져와서 전역 캐시에 저장
async function fetchStockDataIfNeeded(assetType = 'gld', PORT) {
  try {
    // 이미 데이터가 있는지 확인
    if (!globalCache.tqqq) {
      const tqqqResponse = await axios.get(`http://localhost:${PORT}/api/stock/TQQQ`);
      globalCache.tqqq = tqqqResponse.data;
    }
    
    // 선택한 자산 로드
    if (!globalCache[assetType]) {
      const assetSymbol = assetType.toUpperCase();
      console.log(`${assetSymbol} 데이터 로드 중...`);
      const assetResponse = await axios.get(`http://localhost:${PORT}/api/stock/${assetSymbol}`);
      globalCache[assetType] = assetResponse.data;
    }
    
    if (!globalCache.qqq) {
      const qqqResponse = await axios.get(`http://localhost:${PORT}/api/stock/QQQ`);
      globalCache.qqq = qqqResponse.data;
    }
    
    // 200일 이동평균선 계산 (아직 없는 경우)
    if (!globalCache.maData) {
      globalCache.maData = calculateMovingAverage(globalCache.tqqq, 200);
    }
  } catch (error) {
    console.error('주식 데이터 가져오기 실패:', error);
    throw error; // 에러를 상위로 전파하여 처리
  }
  
  console.log('모든 주식 데이터 로드 완료');
}

// Yahoo Finance로부터 주식 데이터 가져오기
async function fetchYahooFinanceData(symbol) {
  try {
    // 1일 간격으로 10년치 데이터 가져오기
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (60 * 60 * 24 * 365 * 10); // 10년 전
    
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      params: {
        period1: startDate,
        period2: endDate,
        interval: '1d',
        events: 'history',
        includeAdjustedClose: true
      }
    });
    
    // 응답 검증
    const result = response.data.chart.result[0];
    if (!result || !result.indicators || !result.indicators.quote || !result.indicators.adjclose) {
      throw new Error('API에서 데이터를 반환하지 않았습니다');
    }
    
    // 데이터 변환
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const adjCloses = result.indicators.adjclose[0].adjclose;
    
    const data = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null && adjCloses[i] !== null) {
        const date = new Date(timestamps[i] * 1000);
        data.push({
          date: date.toISOString().split('T')[0],
          close: parseFloat(adjCloses[i].toFixed(2)),
          volume: parseInt(quotes.volume[i]),
          symbol: symbol.toUpperCase()
        });
      }
    }
    
    // 날짜순 정렬
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${symbol} data:`, error);
    throw error;
  }
}

export {
  fetchStockDataIfNeeded,
  fetchYahooFinanceData
}; 