/**
 * 주식 데이터 서비스 모듈
 * Yahoo Finance API로부터 주식 데이터를 가져오고 관리하는 함수들 제공
 * @module stockService
 */
import axios from 'axios';
import globalCache from '../utils/cache.js';
import { calculateMovingAverage } from '../utils/calculators.js';

/**
 * 필요한 주식 데이터를 가져와서 전역 캐시에 저장
 * TQQQ, QQQ 및 선택한 자산의 데이터를 로드하고 200일 이동평균선 계산
 * 
 * @async
 * @param {string} assetType - 로드할 자산 유형 (기본값: 'gld')
 * @param {number} PORT - 서버 포트 번호
 * @throws {Error} 데이터 가져오기 실패 시 에러 발생
 */
async function fetchStockDataIfNeeded(assetType = 'gld', PORT) {
  try {
    // TQQQ 데이터 가져오기 (MA 계산 위해 추가 데이터 필요)
    if (!globalCache.tqqq_full) { // 캐시 키 변경
      console.log('TQQQ 전체 데이터 로드 중...');
      // fetchYahooFinanceData 호출 시 추가 기간 요청 (약 10개월)
      const tqqqData = await fetchYahooFinanceData('TQQQ', true);
      globalCache.tqqq_full = tqqqData;
    }
    
    // QQQ 데이터 가져오기 (추가 기간 불필요)
    if (!globalCache.qqq) {
      console.log('QQQ 데이터 로드 중...');
      globalCache.qqq = await fetchYahooFinanceData('QQQ', false);
    }

    // 선택한 자산 로드 (추가 기간 불필요)
    if (!globalCache[assetType]) {
      const assetSymbol = assetType.toUpperCase();
      console.log(`${assetSymbol} 데이터 로드 중...`);
      globalCache[assetType] = await fetchYahooFinanceData(assetSymbol, false);
    }
    
    // 200일 이동평균선 계산 (확장된 TQQQ 데이터 사용)
    if (!globalCache.maData) {
      console.log('200일 이동평균선 계산 중...');
      globalCache.maData = calculateMovingAverage(globalCache.tqqq_full, 200);
    }

    // 클라이언트에 전달할 TQQQ 데이터 (실제 요청 기간만)
    // maData 계산 후 tqqq_full에서 필요한 기간만 잘라내어 tqqq 캐시에 저장
    if (!globalCache.tqqq) {
        const tenYearsAgo = new Date();
        tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
        const tenYearsAgoString = tenYearsAgo.toISOString().split('T')[0];
        globalCache.tqqq = globalCache.tqqq_full.filter(item => item.date >= tenYearsAgoString);
        console.log(`클라이언트용 TQQQ 데이터 필터링 완료 (최근 10년)`);
    }

  } catch (error) {
    console.error('주식 데이터 가져오기 실패:', error);
    throw error; // 에러를 상위로 전파하여 처리
  }
  
  console.log('모든 주식 데이터 로드 및 준비 완료');
}

/**
 * Yahoo Finance API로부터 주식 데이터 가져오기
 * 
 * @async
 * @param {string} symbol - 가져올 주식 심볼 (예: TQQQ, GLD)
 * @param {boolean} needExtraPeriod - 이동평균선 계산을 위한 추가 기간 데이터 필요 여부 (기본값: false)
 * @returns {Array<Object>} 주식 데이터 배열 (날짜, 종가, 거래량 정보 포함)
 * @throws {Error} API 호출 실패 시 에러 발생
 */
async function fetchYahooFinanceData(symbol, needExtraPeriod = false) {
  try {
    // 1일 간격으로 데이터 가져오기
    const endDate = Math.floor(Date.now() / 1000);
    let baseStartDate = endDate - (60 * 60 * 24 * 365 * 10); // 기본 10년 전

    // TQQQ의 경우 MA 계산을 위해 추가 기간 요청
    if (needExtraPeriod) {
        baseStartDate -= (60 * 60 * 24 * 30 * 10); // 약 10개월 추가 (넉넉하게)
        console.log(`${symbol}: MA 계산을 위해 약 10개월 추가 데이터 요청`);
    }
    
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      params: {
        period1: baseStartDate,
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
    
    console.log(`${symbol}: ${data.length} 개의 데이터 가져옴 (${data[0].date} ~ ${data[data.length - 1].date})`);
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