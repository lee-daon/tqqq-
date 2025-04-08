/**
 * 포트폴리오 분석 유틸리티 모듈
 * 데이터 처리, 포트폴리오 성과 계산, 전략 시뮬레이션 등의 유틸리티 함수 제공
 * @module utils
 */

/**
 * 데이터 정규화 함수
 * 초기값을 100으로 설정하여 가격 데이터를 정규화
 * 
 * @param {Array<Object>} data - 가격 데이터 배열
 * @returns {Array<number>} 초기값 100으로 정규화된 가격 데이터 배열
 */
export function normalizeData(data) {
  if (!data || data.length === 0) return [];
  
  const initialValue = data[0].close;
  return data.map(item => (item.close / initialValue) * 100);
}

/**
 * 포트폴리오 성과 계산 함수 (고정 비율, 리밸런싱 적용)
 * 두 자산으로 구성된L 포트폴리오의 성과를 계산하며, 리밸런싱 로직 포함
 * 
 * @param {Array<number>} data1 - 첫 번째 자산의 정규화된 가격 데이터
 * @param {Array<number>} data2 - 두 번째 자산의 정규화된 가격 데이터
 * @param {number} weight1 - 첫 번째 자산의 목표 비중 (%)
 * @param {Array<Object>} rawData1 - 첫 번째 자산의 원본 가격 데이터 (날짜와 가격 포함)
 * @param {Array<Object>} rawData2 - 두 번째 자산의 원본 가격 데이터 (날짜와 가격 포함)
 * @returns {Array<number>} 포트폴리오 성과 데이터 (초기값 100 기준 정규화)
 */
export function calculatePortfolioPerformance(data1, data2, weight1, rawData1, rawData2) {
  const weight2 = 100 - weight1;
  const targetRatio1 = weight1 / 100;
  const REBALANCE_THRESHOLD = 0.03; // 리밸런싱 임계값

  // 원본 데이터가 없는 경우 (이전 방식 사용)
  if (!rawData1 || !rawData2 || rawData1.length < 2 || rawData2.length < 2) {
    console.warn("Raw data for portfolio performance calculation is insufficient.");
    // 데이터 부족 시 이전 방식(단순 정규화 가중합)으로 대체 (차트 표시용)
    return data1.map((value, index) => {
        return (value * targetRatio1) + (data2[index] * (1 - targetRatio1));
    });
  }

  try {
    // 날짜 매핑 (원본 데이터)
    const dateMap1 = new Map();
    const dateMap2 = new Map();
    rawData1.forEach(d => dateMap1.set(d.date, d.close));
    rawData2.forEach(d => dateMap2.set(d.date, d.close));

    // 공통 날짜 찾기
    const commonDates = [...dateMap1.keys()].filter(date => dateMap2.has(date)).sort();
    
    if (commonDates.length < 2) {
      console.warn("공통 날짜가 충분하지 않음");
      // 공통 날짜가 부족한 경우 단순 정규화 가중합 사용
      return data1.map((value, index) => {
        return (value * targetRatio1) + (data2[index] * (1 - targetRatio1));
      });
    }

    // 원본 데이터로 리밸런싱 시뮬레이션 수행
    // 초기 가치와 지분 설정
    const initialValue = 100;
    const initialDate = commonDates[0]; // 가장 빠른 공통 날짜 사용
    const initialPrice1 = dateMap1.get(initialDate);
    const initialPrice2 = dateMap2.get(initialDate);
    
    if (!initialPrice1 || !initialPrice2) {
      throw new Error("초기 가격 데이터를 찾을 수 없습니다.");
    }
    
    let shares1 = (initialValue * targetRatio1) / initialPrice1;
    let shares2 = (initialValue * (1 - targetRatio1)) / initialPrice2;
    
    // 리밸런싱 시뮬레이션 결과를 날짜별로 저장
    const simulatedValueMap = new Map();
    simulatedValueMap.set(initialDate, initialValue);
    
    // 모든 공통 날짜에 대해 리밸런싱 시뮬레이션
    let lastPortfolioValue = initialValue;
    
    for (let i = 1; i < commonDates.length; i++) {
      const date = commonDates[i];
      const price1 = dateMap1.get(date);
      const price2 = dateMap2.get(date);
      
      if (!price1 || !price2) {
        simulatedValueMap.set(date, lastPortfolioValue);
        continue;
      }
      
      // 현재 포트폴리오 가치 계산
      const value1 = shares1 * price1;
      const value2 = shares2 * price2;
      const currentTotalValue = value1 + value2;
      lastPortfolioValue = currentTotalValue;
      
      // 현재 자산 비율 계산
      const currentRatio1 = value1 / currentTotalValue;
      
      // 리밸런싱 조건 확인
      if (Math.abs(currentRatio1 - targetRatio1) > REBALANCE_THRESHOLD) {
        // 목표 비율로 리밸런싱
        shares1 = (currentTotalValue * targetRatio1) / price1;
        shares2 = (currentTotalValue * (1 - targetRatio1)) / price2;
      }
      
      // 정규화된 포트폴리오 가치 저장 (초기값 100 기준)
      const normalizedValue = currentTotalValue / (initialPrice1 * (initialValue * targetRatio1 / initialPrice1) + initialPrice2 * (initialValue * (1-targetRatio1) / initialPrice2)) * 100;
      simulatedValueMap.set(date, normalizedValue);
    }
    
    // 차트 데이터 생성 - 다른 데이터셋과 동일한 길이 유지
    if (data1.length !== rawData1.length) {
      console.warn("정규화 데이터와 원본 데이터의 길이가 일치하지 않습니다. 단순 보간 사용합니다.");
      return data1.map((value, index) => {
        return (value * targetRatio1) + (data2[index] * (1 - targetRatio1));
      });
    }
    
    // 결과 배열 준비
    const result = [];
    
    // data1의 각 인덱스에 대해 결과값 결정
    for (let i = 0; i < data1.length; i++) {
      if (i >= rawData1.length) {
        // 인덱스 범위를 벗어난 경우
        result.push((data1[i] * targetRatio1) + (data2[i] * (1 - targetRatio1)));
        continue;
      }
      
      const date = rawData1[i].date;
      
      if (simulatedValueMap.has(date)) {
        // 해당 날짜 데이터가 있으면 그대로 사용
        result.push(simulatedValueMap.get(date));
      } else {
        // 해당 날짜 데이터가 없으면 단순 가중 평균 적용
        result.push((data1[i] * targetRatio1) + (data2[i] * (1 - targetRatio1)));
      }
    }
    
    return result;
    
  } catch (error) {
    console.error("Portfolio performance calculation error:", error);
    // 오류 발생 시 단순 가중 평균 방식으로 대체
    return data1.map((value, index) => {
      return (value * targetRatio1) + (data2[index] * (1 - targetRatio1));
    });
  }
}

/**
 * TQQQ가 200일 이동평균선 위에 있는지 확인하는 함수
 * 가장 최근 데이터 기준으로 위/아래 여부 반환
 * 
 * @param {Object} maData - 이동평균선 데이터 객체
 * @param {Array} maData.values - 날짜별 이동평균선 데이터 배열
 * @returns {boolean} true: 이동평균선 위, false: 이동평균선 아래
 */
export function isAboveMA(maData) {
  if (!maData || !maData.values || maData.values.length === 0) {
    return true; // 데이터가 없는 경우 기본값
  }
  
  // 가장 최근 데이터의 이동평균선 위치 확인
  const latestData = maData.values[maData.values.length - 1];
  return latestData.aboveMA;
}

/**
 * 200일 이동평균선 전략 성과 계산 함수
 * 이동평균선 교차 시 자산 배분 비율을 동적으로 변경하는 전략의 성과 시뮬레이션
 * 
 * @param {Array<Object>} tqqqData - TQQQ 가격 데이터 배열
 * @param {Array<Object>} assetData - 보조 자산 가격 데이터 배열
 * @param {Object} maData - 이동평균선 데이터 객체
 * @param {number} aboveMAPercent - 이평선 위일 때 TQQQ 비중 (%)
 * @param {number} belowMAPercent - 이평선 아래일 때 TQQQ 비중 (%)
 * @returns {Object} 성과 데이터와 통계 지표
 * @returns {Array<number>} performanceData - 성과 지표 배열 (초기값 100 기준)
 * @returns {Object} stats - 성과 통계 (연평균 수익률, 샤프 지수, 최대낙폭, 변동성 등)
 */
export function calculateMAStrategyPerformance(tqqqData, assetData, maData, aboveMAPercent, belowMAPercent) {
  if (!maData || !maData.values || maData.values.length === 0 ||
      !tqqqData || !assetData || tqqqData.length === 0 || assetData.length === 0) {
    return { performanceData: [], stats: null };
  }
  
  // tqqqData와 assetData 날짜 매핑
  const tqqqMap = {};
  tqqqData.forEach(item => tqqqMap[item.date] = item.close);
  
  const assetMap = {};
  assetData.forEach(item => assetMap[item.date] = item.close);
  
  // MA 데이터 날짜 매핑
  const maMap = {};
  if (maData && maData.values) { // maData 존재 여부 확인
    maData.values.forEach(item => {
      maMap[item.date] = {
        aboveMA: item.aboveMA,
        ma: item.ma
      };
    });
  }
  
  // 기준 날짜 배열 (tqqqData 기준, MA 데이터 없어도 포함)
  const baseDates = tqqqData.map(item => item.date);
  if (baseDates.length < 2) return { performanceData: [], stats: null };

  const initialValue = 100;
  const portfolioValues = [initialValue];
  const dailyReturns = [];

  // 초기 가격 및 상태 설정
  const initialDate = baseDates[0];
  const initialTQQQPrice = tqqqMap[initialDate];
  const initialAssetPrice = assetMap[initialDate];
  let lastAboveMA = maMap[initialDate] ? maMap[initialDate].aboveMA : true; // MA 없으면 기본값 true
  let lastTQQQRatio = lastAboveMA ? aboveMAPercent / 100 : belowMAPercent / 100;
  let targetTQQQRatio = lastTQQQRatio;

  let tqqqShares = (initialTQQQPrice > 0) ? (initialValue * lastTQQQRatio) / initialTQQQPrice : 0;
  let assetShares = (initialAssetPrice > 0) ? (initialValue * (1 - lastTQQQRatio)) / initialAssetPrice : 0;
  let lastCrossoverDate = new Date(initialDate);
  let limitedCrossovers = 0;

  // 모든 기준 날짜에 대해 루프 실행
  for (let i = 1; i < baseDates.length; i++) {
    const currentDate = baseDates[i];
    const currentTQQQPrice = tqqqMap[currentDate];
    const currentAssetPrice = assetMap[currentDate];
    const currentMAInfo = maMap[currentDate]; // 현재 날짜의 MA 정보

    // 이전 날짜 포트폴리오 가치
    const previousValue = portfolioValues[portfolioValues.length - 1];
    
    // 현재 포트폴리오 가치 계산 (가격 없으면 이전 가치 유지)
    let currentTotalValue = previousValue;
    if (currentTQQQPrice !== undefined && currentAssetPrice !== undefined) {
         currentTotalValue = (tqqqShares * currentTQQQPrice) + (assetShares * currentAssetPrice);
    }

    // 일별 수익률 계산
    const dailyReturn = (previousValue > 0) ? (currentTotalValue / previousValue) - 1 : 0;
    dailyReturns.push(dailyReturn);

    // MA 데이터가 있을 경우에만 전략 로직 수행
    if (currentMAInfo) {
      const currentAboveMA = currentMAInfo.aboveMA;
      const currentTQQQRatio = currentTotalValue > 0 ? (tqqqShares * currentTQQQPrice) / currentTotalValue : 0;

      // 이평선 교차 확인 및 목표 비율 변경
      if (currentAboveMA !== lastAboveMA) {
        const currDate = new Date(currentDate);
        const daysSinceLastCross = Math.floor((currDate - lastCrossoverDate) / (1000 * 60 * 60 * 24));
        if (daysSinceLastCross >= 2) {
          targetTQQQRatio = currentAboveMA ? aboveMAPercent / 100 : belowMAPercent / 100;
          lastAboveMA = currentAboveMA;
          lastCrossoverDate = currDate;
          limitedCrossovers++;
        }
      }

      // 리밸런싱 조건 확인
      if (Math.abs(currentTQQQRatio - targetTQQQRatio) >= 0.03) {
        tqqqShares = (currentTQQQPrice > 0) ? (currentTotalValue * targetTQQQRatio) / currentTQQQPrice : 0;
        assetShares = (currentAssetPrice > 0) ? (currentTotalValue * (1 - targetTQQQRatio)) / currentAssetPrice : 0;
      }
    } 
    // MA 데이터가 없으면 비율/지분 변경 없이 이전 상태 유지
    
    portfolioValues.push(currentTotalValue);
  }

  // --- 통계 계산 --- 
  const endValue = portfolioValues[portfolioValues.length - 1];
  const totalReturn = (initialValue > 0) ? (endValue / initialValue) - 1 : 0;
  const startDate = new Date(baseDates[0]);
  const endDate = new Date(baseDates[baseDates.length - 1]);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const annualReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  let peakValue = portfolioValues[0];
  let maxDrawdown = 0;
  for (let i = 1; i < portfolioValues.length; i++) {
    if (portfolioValues[i] > peakValue) {
      peakValue = portfolioValues[i];
    } else if (peakValue > 0) {
      const drawdown = (peakValue - portfolioValues[i]) / peakValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  let volatility = 0;
  let sharpeRatio = 0;
  if (dailyReturns.length > 0) {
    const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
    volatility = Math.sqrt(variance) * Math.sqrt(252);
    const riskFreeRate = 0.02;
    sharpeRatio = volatility > 0 ? (annualReturn - riskFreeRate) / volatility : 0;
  }
  const totalCrossovers = maData && maData.crossovers ? maData.crossovers.filter(c => {
    const crossDate = new Date(c.date);
    return crossDate >= startDate && crossDate <= endDate;
  }).length : 0;
  const performanceData = portfolioValues.map(v => (v / initialValue) * 100);
  const stats = {
    annualReturn: annualReturn,
    sharpeRatio: sharpeRatio,
    mdd: maxDrawdown,
    volatility: volatility,
    totalCrossovers: totalCrossovers,
    limitedCrossovers: limitedCrossovers
  };
  
  return { performanceData, stats };
}

/**
 * 고정 비율 포트폴리오 통계 계산 함수
 * 두 자산으로 구성된 고정 비율 포트폴리오의 성과 지표를 계산
 * 
 * @param {Array<Object>} data1 - 첫 번째 자산 데이터 배열
 * @param {Array<Object>} data2 - 두 번째 자산 데이터 배열
 * @param {number} weight1 - 첫 번째 자산의 비중 (%)
 * @returns {Object|null} 성과 통계 (연평균 수익률, 샤프 지수, 최대낙폭, 변동성) 또는 계산 불가 시 null
 */
export function calculateFixedRatioStats(data1, data2, weight1) {
  const weight2 = 100 - weight1;
  if (!data1 || !data2 || data1.length < 2 || data2.length < 2) {
    return null; // 계산 불가
  }

  // 날짜 매핑
  const dateMap1 = new Map();
  const dateMap2 = new Map();
  data1.forEach(d => dateMap1.set(d.date, d.close));
  data2.forEach(d => dateMap2.set(d.date, d.close));

  // 공통 날짜만 사용
  const commonDates = [...dateMap1.keys()].filter(date => dateMap2.has(date)).sort();
  if (commonDates.length < 2) return null;

  const initialValue = 100; // 초기 포트폴리오 가치
  const portfolioValues = [];
  const dailyReturns = [];
  const targetRatio1 = weight1 / 100;
  const REBALANCE_THRESHOLD = 0.03; // 리밸런싱 임계값 (서버와 동일하게 유지)

  // 초기 지분 계산
  const initialPrice1 = dateMap1.get(commonDates[0]);
  const initialPrice2 = dateMap2.get(commonDates[0]);
  let shares1 = (initialPrice1 > 0) ? (initialValue * targetRatio1) / initialPrice1 : 0;
  let shares2 = (initialPrice2 > 0) ? (initialValue * (1 - targetRatio1)) / initialPrice2 : 0;

  // 첫 날 가치 추가
  portfolioValues.push(initialValue);

  for (let i = 1; i < commonDates.length; i++) {
    const date = commonDates[i];
    const price1 = dateMap1.get(date);
    const price2 = dateMap2.get(date);

    // 현재 포트폴리오 가치 계산
    const value1 = shares1 * price1;
    const value2 = shares2 * price2;
    const currentTotalValue = value1 + value2;

    // 일별 수익률 계산
    const previousValue = portfolioValues[portfolioValues.length - 1];
    const dailyReturn = (previousValue > 0) ? (currentTotalValue / previousValue) - 1 : 0;
    dailyReturns.push(dailyReturn);

    // 현재 자산 비율 계산
    const currentRatio1 = currentTotalValue > 0 ? value1 / currentTotalValue : 0;

    // 리밸런싱 조건 확인
    if (Math.abs(currentRatio1 - targetRatio1) > REBALANCE_THRESHOLD) {
      // 목표 비율로 리밸런싱
      shares1 = (price1 > 0) ? (currentTotalValue * targetRatio1) / price1 : 0;
      shares2 = (price2 > 0) ? (currentTotalValue * (1 - targetRatio1)) / price2 : 0;
    }
    
    portfolioValues.push(currentTotalValue);
  }

  // 통계 계산
  const endValue = portfolioValues[portfolioValues.length - 1];
  const totalReturn = (initialValue > 0) ? (endValue / initialValue) - 1 : 0;
  
  const startDate = new Date(commonDates[0]);
  const endDate = new Date(commonDates[commonDates.length - 1]);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  const annualReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  
  // 최대 낙폭 계산
  let peakValue = portfolioValues[0];
  let maxDrawdown = 0;
  for (let i = 1; i < portfolioValues.length; i++) {
    if (portfolioValues[i] > peakValue) {
      peakValue = portfolioValues[i];
    } else if (peakValue > 0) {
      const drawdown = (peakValue - portfolioValues[i]) / peakValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  
  // 변동성 및 샤프 지수 계산
  let volatility = 0;
  let sharpeRatio = 0;
  if (dailyReturns.length > 0) {
    const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
    volatility = Math.sqrt(variance) * Math.sqrt(252); // 연간 변동성
    
    const riskFreeRate = 0.02; // 2% 무위험 수익률 가정
    sharpeRatio = volatility > 0 ? (annualReturn - riskFreeRate) / volatility : 0;
  }

  return {
    annualReturn: annualReturn,
    sharpeRatio: sharpeRatio,
    mdd: maxDrawdown,
    volatility: volatility
  };
}

/**
 * 차트 캔버스 크기 고정 함수
 * 차트 렌더링 시 캔버스 크기를 고정하여 일관된 UI 유지
 * 
 * @returns {void}
 */
export function fixChartCanvasSize() {
  const canvasElements = document.querySelectorAll('canvas');
  canvasElements.forEach(canvas => {
    canvas.style.height = '300px';
    canvas.style.boxSizing = 'border-box';
    canvas.style.width = '100%';
  });
} 