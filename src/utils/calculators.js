// 리밸런싱 임계값 (3%p)
const REBALANCE_THRESHOLD = 0.03;

// 포트폴리오 시뮬레이션 함수 (리밸런싱 포함)
function simulatePortfolio(data1, data2, weight1, weight2, rebalanceThreshold) {
  if (data1.length < 2 || data2.length < 2) return [];

  // 날짜 매핑
  const dateMap1 = new Map();
  const dateMap2 = new Map();
  data1.forEach(d => dateMap1.set(d.date, d.close));
  data2.forEach(d => dateMap2.set(d.date, d.close));

  // 공통 날짜만 사용
  const commonDates = [...dateMap1.keys()].filter(date => dateMap2.has(date)).sort();
  if (commonDates.length < 2) return [];

  const initialValue = 100; // 초기 포트폴리오 가치
  const portfolioValues = [];
  const targetRatio1 = weight1 / 100;
  const targetRatio2 = weight2 / 100;

  // 초기 지분 계산
  const initialPrice1 = dateMap1.get(commonDates[0]);
  const initialPrice2 = dateMap2.get(commonDates[0]);
  let shares1 = (initialValue * targetRatio1) / initialPrice1;
  let shares2 = (initialValue * targetRatio2) / initialPrice2;

  // 첫 날 가치 추가
  portfolioValues.push({ date: commonDates[0], value: initialValue });

  for (let i = 1; i < commonDates.length; i++) {
    const date = commonDates[i];
    const price1 = dateMap1.get(date);
    const price2 = dateMap2.get(date);

    // 현재 포트폴리오 가치 계산
    const value1 = shares1 * price1;
    const value2 = shares2 * price2;
    const currentTotalValue = value1 + value2;

    // 현재 자산 비율 계산
    const currentRatio1 = value1 / currentTotalValue;

    // 리밸런싱 조건 확인
    if (Math.abs(currentRatio1 - targetRatio1) > rebalanceThreshold) {
      // 목표 비율로 리밸런싱
      shares1 = (currentTotalValue * targetRatio1) / price1;
      shares2 = (currentTotalValue * targetRatio2) / price2;
    }
    
    portfolioValues.push({ date: date, value: currentTotalValue });
  }

  return portfolioValues;
}

// 연평균 수익률 계산 함수 (리밸런싱 적용)
function calculateAnnualReturn(data1, data2, weight1, weight2) {
  const portfolioValues = simulatePortfolio(data1, data2, weight1, weight2, REBALANCE_THRESHOLD);
  if (portfolioValues.length < 2) return 0;

  const startValue = portfolioValues[0].value;
  const endValue = portfolioValues[portfolioValues.length - 1].value;
  const startDate = new Date(portfolioValues[0].date);
  const endDate = new Date(portfolioValues[portfolioValues.length - 1].date);

  const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
  if (years < 0.08) { // 기간이 너무 짧으면 0 반환
      console.warn(`CAGR 계산 기간 부족: ${years.toFixed(2)}년`);
      return 0; 
  }

  const totalReturn = (endValue / startValue) - 1;
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;

  console.log(`수정된 CAGR 계산 [${data1[0]?.symbol || 'Asset1'} ${weight1}% + ${data2[0]?.symbol || 'Asset2'} ${weight2}%] (${years.toFixed(2)}년): ${(cagr * 100).toFixed(2)}%`);
  return cagr;
}

// 변동성 계산 함수 (리밸런싱 적용)
function calculateVolatility(data1, data2, weight1, weight2) {
  const portfolioValues = simulatePortfolio(data1, data2, weight1, weight2, REBALANCE_THRESHOLD);
  if (portfolioValues.length < 2) return 0;

  const dailyReturns = [];
  for (let i = 1; i < portfolioValues.length; i++) {
    const dailyReturn = (portfolioValues[i].value / portfolioValues[i - 1].value) - 1;
    dailyReturns.push(dailyReturn);
  }

  const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
  const dailyVolatility = Math.sqrt(variance);

  return dailyVolatility * Math.sqrt(252); // 연간 변동성 (거래일 252일 기준)
}

// 최대 낙폭 (MDD) 계산 함수 (리밸런싱 적용)
function calculateMDD(data1, data2, weight1, weight2) {
  const portfolioValues = simulatePortfolio(data1, data2, weight1, weight2, REBALANCE_THRESHOLD);
  if (portfolioValues.length < 2) return 0;

  let maxValue = portfolioValues[0].value;
  let maxDrawdown = 0;

  for (let i = 1; i < portfolioValues.length; i++) {
    const currentValue = portfolioValues[i].value;
    if (currentValue > maxValue) {
      maxValue = currentValue;
    }
    const drawdown = (maxValue - currentValue) / maxValue;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

// 200일 이동평균선 계산 함수
function calculateMovingAverage(data, period) {
  if (!data || data.length < period) {
    return { values: [], crossovers: [] };
  }

  const ma = [];
  const crossovers = [];
  let lastPrice = null;
  let lastMA = null;
  let aboveMA = null;

  // 이동 평균 계산
  for (let i = 0; i < data.length; i++) {
    if (i >= period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      const average = sum / period;
      
      // 현재 가격과 이동평균 비교 (교차점 확인)
      const currentPrice = data[i].close;
      const currentMA = average;
      const currentAboveMA = currentPrice > currentMA;

      if (lastPrice !== null && lastMA !== null && aboveMA !== null) {
        if (aboveMA !== currentAboveMA) {
          // 교차점 발견
          crossovers.push({
            date: data[i].date,
            price: currentPrice,
            ma: currentMA,
            crossType: currentAboveMA ? 'up' : 'down'
          });
        }
      }

      lastPrice = currentPrice;
      lastMA = currentMA;
      aboveMA = currentAboveMA;
      
      ma.push({
        date: data[i].date,
        price: data[i].close,
        ma: average,
        aboveMA: currentAboveMA
      });
    }
  }

  return {
    values: ma,
    crossovers,
    symbol: 'tqqq'
  };
}

export {
  calculateAnnualReturn,
  calculateVolatility,
  calculateMDD,
  calculateMovingAverage
}; 