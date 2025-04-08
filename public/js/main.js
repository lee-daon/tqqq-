/**
 * 메인 애플리케이션 모듈
 * 애플리케이션의 진입점과 전체 상태 관리를 담당
 * @module main
 */

// 외부 모듈 import
import { assetColors } from './constants.js';
import { fetchAnalysis, generateCashData } from './api.js';
import { normalizeData, calculatePortfolioPerformance, isAboveMA, calculateMAStrategyPerformance, fixChartCanvasSize } from './utils.js';
import { updateEfficientFrontierTQQQ_Asset, updatePerformanceChart, updateMAChart } from './charts.js';
import { setupEventListeners, updateAssetLabels, updateMACurrentStatus, updatePortfolioTable, updateSelectedPortfolioStats, updateStrategyStats } from './ui.js';

/**
 * 애플리케이션 전역 상태 객체
 * 포트폴리오 분석과 UI 상태를 저장
 * 
 * @type {Object}
 * @property {Array|null} portfolioData - 포트폴리오 분석 결과 데이터
 * @property {Object|null} rawData - 원시 주식 데이터 (tqqq, 선택 자산, qqq 등)
 * @property {Object|null} maData - 이동평균선 데이터
 * @property {number} currentPeriod - 현재 선택된 분석 기간 (년)
 * @property {number} tqqqAssetRatio - TQQQ 비중 (%)
 * @property {string} currentAsset - 현재 선택된 자산 코드
 * @property {Object} globalCache - 데이터 캐싱을 위한 객체
 * @property {boolean} useMAStrategy - 이동평균선 전략 사용 여부
 * @property {number} aboveMAPercent - 이평선 위일 때 TQQQ 비중 (%)
 * @property {number} belowMAPercent - 이평선 아래일 때 TQQQ 비중 (%)
 */
const state = {
  portfolioData: null,
  rawData: null,
  maData: null,
  currentPeriod: 1, // 기본값: 1년
  tqqqAssetRatio: 50, // 기본값: TQQQ 50%, 선택 자산 50%
  currentAsset: 'gld', // 기본값: GLD
  globalCache: {}, // 현금 선택 시 사용할 전역 캐시
  useMAStrategy: false,
  aboveMAPercent: 70,
  belowMAPercent: 30
};

/**
 * 페이지 로드 시 실행되는 초기화 함수
 * 차트 크기 설정, 데이터 로드, 이벤트 리스너 등록을 담당
 */
document.addEventListener('DOMContentLoaded', () => {
  // 차트 캔버스 크기 고정
  fixChartCanvasSize();
  
  // 데이터 로드
  loadData();
  
  // 이벤트 리스너 등록
  setupEventListeners(state, {
    updateAllCharts,
    updatePerformanceChart: () => updatePerformanceChartWithState(),
    updateSelectedPortfolioStats: () => updateSelectedPortfolioStats(state.rawData, state.currentPeriod, state.currentAsset, state.tqqqAssetRatio),
    updateAssetLabels: () => updateAssetLabels(state.currentAsset),
    fetchAnalysis: loadData,
    updateStrategyStats: () => updateStrategyStatsWithState()
  });
  
  // 이평선 차트 항상 표시
  document.getElementById('maSection').classList.remove('d-none');
});

/**
 * 데이터 로드 함수
 * 선택된 자산에 따라 API 데이터를 가져오거나 현금 데이터를 생성
 * 
 * @async
 * @throws {Error} 데이터 로드 실패 시 에러 발생
 */
async function loadData() {
  try {
    // 현금 선택 시 API 호출하지 않고 직접 계산
    if (state.currentAsset === 'cash') {
      // TQQQ 데이터가 없으면 먼저 가져오기
      if (!state.globalCache.tqqq) {
        const tqqqResponse = await fetch('/api/stock/TQQQ');
        state.globalCache.tqqq = await tqqqResponse.json();
      }

      // QQQ 데이터가 없으면 먼저 가져오기
      if (!state.globalCache.qqq) {
        const qqqResponse = await fetch('/api/stock/QQQ');
        state.globalCache.qqq = await qqqResponse.json();
      }

      // 이동평균선 데이터가 없으면 먼저 가져오기
      if (!state.globalCache.maData) {
        const response = await fetch('/api/analyze?asset=gld');
        const data = await response.json();
        state.globalCache.maData = data.maData;
      }

      const cashData = generateCashData();
      state.portfolioData = calculateCashPortfolioData(cashData, state.globalCache.tqqq);
      state.rawData = {
        tqqq: state.globalCache.tqqq || [],
        cash: cashData,
        qqq: state.globalCache.qqq || []
      };
      state.maData = state.globalCache.maData;
    } else {
      const response = await fetchAnalysis(state.currentAsset);
      state.portfolioData = response.portfolios;
      state.rawData = response.rawData;
      state.maData = response.maData;
      
      // 현금 선택을 위해 전역 캐시에 저장
      state.globalCache.tqqq = state.rawData.tqqq;
      state.globalCache.qqq = state.rawData.qqq;
      state.globalCache.maData = state.maData;
    }
    
    // 모든 차트와 표 업데이트
    updateAllCharts();
    
    // 200일 이평선 전략 상태 업데이트
    updateMACurrentStatus(state.maData);
    
    // 200일 이평선 전략이 활성화된 경우 전략 통계 업데이트
    if (state.useMAStrategy) {
      updateStrategyStatsWithState();
    }
    
  } catch (error) {
    console.error('Error fetching analysis data:', error);
    alert('데이터를 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 현금 포트폴리오 데이터 계산 함수
 * TQQQ와 현금의 다양한 비율로 구성된 포트폴리오 성과를 계산
 * 
 * @param {Array<Object>} cashData - 현금 자산 데이터 배열
 * @param {Array<Object>} tqqqData - TQQQ 데이터 배열
 * @returns {Array<Object>} 각 비율별 성과가 계산된 포트폴리오 데이터 배열
 */
function calculateCashPortfolioData(cashData, tqqqData) {
  if (!tqqqData || tqqqData.length === 0) {
    console.error('TQQQ 데이터가 없어 현금 포트폴리오를 계산할 수 없습니다.');
    return [];
  }
  
  const portfoliosData = [];
  
  // 동일한 날짜에 맞춰 필터링
  const tqqqDates = new Set(tqqqData.map(item => item.date));
  const filteredCashData = cashData.filter(item => tqqqDates.has(item.date));
  
  // 5% 단위로 TQQQ와 현금 포트폴리오 생성
  for (let tqqqWeight = 0; tqqqWeight <= 100; tqqqWeight += 5) {
    const cashWeight = 100 - tqqqWeight;
    
    // 각 기간별 성과 계산
    const periodResults = {};
    [1, 3, 5, 10].forEach(years => {
      // 기간에 해당하는 데이터 필터링
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      
      const periodTqqq = tqqqData.filter(item => item.date >= cutoffDateString);
      const periodCash = filteredCashData.filter(item => item.date >= cutoffDateString);
      
      if (periodTqqq.length < 10 || periodCash.length < 10) {
        console.log(`${years}년 데이터가 충분하지 않습니다. TQQQ: ${periodTqqq.length}, 현금: ${periodCash.length}`);
        return;
      }
      
      // 연평균 수익률, 변동성, MDD 계산
      const annualReturn = calculateAnnualReturn(periodTqqq, periodCash, tqqqWeight);
      const volatility = calculatePortfolioVolatility(periodTqqq, periodCash, tqqqWeight);
      const sharpeRatio = (annualReturn - 0.02) / (volatility || 0.001); // 0으로 나누기 방지
      const mdd = calculatePortfolioMDD(periodTqqq, periodCash, tqqqWeight);
      
      periodResults[`${years}year`] = {
        annualReturn: annualReturn,
        volatility: volatility,
        sharpeRatio: sharpeRatio,
        mdd: mdd
      };
    });
    
    portfoliosData.push({
      tqqqWeight: tqqqWeight,
      cashWeight: cashWeight,
      ...periodResults
    });
  }
  
  return portfoliosData;
}

/**
 * 포트폴리오 연평균 수익률 계산 함수
 * 두 자산으로 구성된 포트폴리오의 연간 복합 수익률(CAGR) 계산
 * 
 * @param {Array<Object>} data1 - 첫 번째 자산 데이터 배열 (TQQQ)
 * @param {Array<Object>} data2 - 두 번째 자산 데이터 배열
 * @param {number} weight1 - 첫 번째 자산의 비중 (%)
 * @returns {number} 연평균 수익률 (소수점 형태, 예: 0.1 = 10%)
 */
function calculateAnnualReturn(data1, data2, weight1) {
  const weight2 = 100 - weight1;
  
  // 시작과 끝 날짜 찾기
  const startDate1 = new Date(data1[0].date);
  const endDate1 = new Date(data1[data1.length - 1].date);
  const startDate2 = new Date(data2[0].date);
  const endDate2 = new Date(data2[data2.length - 1].date);
  
  // 공통 기간 구하기
  const startDate = new Date(Math.max(startDate1.getTime(), startDate2.getTime()));
  const endDate = new Date(Math.min(endDate1.getTime(), endDate2.getTime()));
  
  // 날짜 필터링
  const filtered1 = data1.filter(item => {
    const date = new Date(item.date);
    return date >= startDate && date <= endDate;
  });
  
  const filtered2 = data2.filter(item => {
    const date = new Date(item.date);
    return date >= startDate && date <= endDate;
  });
  
  if (filtered1.length === 0 || filtered2.length === 0) {
    console.error('공통 기간 데이터가 없습니다.');
    return 0;
  }
  
  // 첫날과 마지막 날 가격
  const startPrice1 = filtered1[0].close;
  const endPrice1 = filtered1[filtered1.length - 1].close;
  const startPrice2 = filtered2[0].close;
  const endPrice2 = filtered2[filtered2.length - 1].close;
  
  // 총 수익률 계산
  const return1 = (endPrice1 / startPrice1) - 1;
  const return2 = (endPrice2 / startPrice2) - 1;
  
  // 가중 평균 수익률
  const weightedReturn = (return1 * (weight1 / 100)) + (return2 * (weight2 / 100));
  
  // 기간(년) 계산
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  // 연평균 수익률 계산 (CAGR)
  const cagr = Math.pow(1 + weightedReturn, 1 / years) - 1;
  
  return cagr;
}

/**
 * 포트폴리오 변동성 계산 함수
 * 두 자산으로 구성된 포트폴리오의 연간 변동성(표준편차) 계산
 * 
 * @param {Array<Object>} data1 - 첫 번째 자산 데이터 배열 (TQQQ)
 * @param {Array<Object>} data2 - 두 번째 자산 데이터 배열
 * @param {number} weight1 - 첫 번째 자산의 비중 (%)
 * @returns {number} 연간 변동성 (표준편차)
 */
function calculatePortfolioVolatility(data1, data2, weight1) {
  const weight2 = 100 - weight1;
  
  // 날짜 매핑
  const priceMap1 = new Map();
  const priceMap2 = new Map();
  
  data1.forEach(item => priceMap1.set(item.date, item.close));
  data2.forEach(item => priceMap2.set(item.date, item.close));
  
  // 공통 날짜만 사용
  const commonDates = [...priceMap1.keys()].filter(date => priceMap2.has(date)).sort();
  
  if (commonDates.length < 2) {
    return 0;
  }
  
  // 일별 수익률 계산
  const dailyReturns = [];
  
  for (let i = 1; i < commonDates.length; i++) {
    const prevDate = commonDates[i-1];
    const currDate = commonDates[i];
    
    const prevPrice1 = priceMap1.get(prevDate);
    const currPrice1 = priceMap1.get(currDate);
    const prevPrice2 = priceMap2.get(prevDate);
    const currPrice2 = priceMap2.get(currDate);
    
    const return1 = (currPrice1 / prevPrice1) - 1;
    const return2 = (currPrice2 / prevPrice2) - 1;
    
    const portfolioReturn = (return1 * (weight1 / 100)) + (return2 * (weight2 / 100));
    dailyReturns.push(portfolioReturn);
  }
  
  // 표준편차 계산
  const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  
  // 연간 변동성 (거래일 252일 기준)
  return stdDev * Math.sqrt(252);
}

/**
 * 포트폴리오 최대 낙폭(MDD) 계산 함수
 * 두 자산으로 구성된 포트폴리오의 최대 낙폭 계산
 * 
 * @param {Array<Object>} data1 - 첫 번째 자산 데이터 배열 (TQQQ)
 * @param {Array<Object>} data2 - 두 번째 자산 데이터 배열
 * @param {number} weight1 - 첫 번째 자산의 비중 (%)
 * @returns {number} 최대 낙폭 (소수점 형태, 예: 0.3 = 30%)
 */
function calculatePortfolioMDD(data1, data2, weight1) {
  const weight2 = 100 - weight1;
  
  // 날짜 매핑
  const priceMap1 = new Map();
  const priceMap2 = new Map();
  
  data1.forEach(item => priceMap1.set(item.date, item.close));
  data2.forEach(item => priceMap2.set(item.date, item.close));
  
  // 공통 날짜만 사용
  const commonDates = [...priceMap1.keys()].filter(date => priceMap2.has(date)).sort();
  
  if (commonDates.length < 2) {
    return 0;
  }
  
  // 초기값으로 정규화
  const initialValue1 = priceMap1.get(commonDates[0]);
  const initialValue2 = priceMap2.get(commonDates[0]);
  
  // 포트폴리오 가치 계산
  const portfolioValues = commonDates.map(date => {
    const normalizedValue1 = priceMap1.get(date) / initialValue1;
    const normalizedValue2 = priceMap2.get(date) / initialValue2;
    return (normalizedValue1 * (weight1 / 100)) + (normalizedValue2 * (weight2 / 100));
  });
  
  // MDD 계산
  let peak = portfolioValues[0];
  let mdd = 0;
  
  for (let i = 1; i < portfolioValues.length; i++) {
    if (portfolioValues[i] > peak) {
      peak = portfolioValues[i];
    } else {
      const drawdown = (peak - portfolioValues[i]) / peak;
      if (drawdown > mdd) {
        mdd = drawdown;
      }
    }
  }
  
  return mdd;
}

/**
 * 모든 차트 및 표 업데이트 함수
 * 애플리케이션의 모든 시각화 요소를 최신 상태로 업데이트
 */
function updateAllCharts() {
  if (!state.portfolioData || !state.rawData) return;
  
  updateEfficientFrontierTQQQ_Asset(state.portfolioData, state.rawData, state.currentPeriod, state.currentAsset, assetColors);
  updatePortfolioTable(state.portfolioData, state.currentPeriod, state.useMAStrategy, isAboveMA(state.maData), state.tqqqAssetRatio, state.aboveMAPercent, state.belowMAPercent);
  updatePerformanceChartWithState();
  updateSelectedPortfolioStats(state.rawData, state.currentPeriod, state.currentAsset, state.tqqqAssetRatio);
  updateMAChart(state.maData, state.currentPeriod);
}

/**
 * 성과 차트 업데이트 래퍼 함수
 * 현재 상태를 기반으로 성과 차트 업데이트
 */
function updatePerformanceChartWithState() {
  updatePerformanceChart(
    state.rawData, 
    state.maData, 
    state.currentPeriod, 
    state.currentAsset, 
    state.tqqqAssetRatio, 
    state.useMAStrategy, 
    state.aboveMAPercent, 
    state.belowMAPercent
  );
}

/**
 * 전략 통계 업데이트 래퍼 함수
 * 현재 상태를 기반으로 이동평균선 전략 통계 업데이트
 */
function updateStrategyStatsWithState() {
  updateStrategyStats(
    state.portfolioData,
    state.rawData,
    state.maData, 
    state.currentPeriod, 
    state.currentAsset,
    state.aboveMAPercent, 
    state.belowMAPercent
  );
} 