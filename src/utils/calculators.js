// 연평균 수익률 계산 함수
function calculateAnnualReturn(data1, data2, weight1, weight2) {
  if (data1.length === 0 || data2.length === 0) return 0;
  
  // 동일한 기간의 데이터만 사용하기 위해 날짜 필터링
  const startDate = Math.max(
    new Date(data1[0].date).getTime(),
    new Date(data2[0].date).getTime()
  );
  
  const endDate = Math.min(
    new Date(data1[data1.length - 1].date).getTime(),
    new Date(data2[data2.length - 1].date).getTime()
  );
  
  const filteredData1 = data1.filter(d => {
    const time = new Date(d.date).getTime();
    return time >= startDate && time <= endDate;
  });
  
  const filteredData2 = data2.filter(d => {
    const time = new Date(d.date).getTime();
    return time >= startDate && time <= endDate;
  });
  
  if (filteredData1.length === 0 || filteredData2.length === 0) return 0;
  
  const startValue1 = filteredData1[0].close;
  const endValue1 = filteredData1[filteredData1.length - 1].close;
  const startValue2 = filteredData2[0].close;
  const endValue2 = filteredData2[filteredData2.length - 1].close;
  
  // 기본 총 수익률 계산
  const returnRate1 = (endValue1 / startValue1) - 1;
  let returnRate2 = (endValue2 / startValue2) - 1;
  
  // 기간 계산 (연 단위)
  const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
  const years = days / 365;
  
  // 실제 연간 기간이 너무 짧은 경우 (1개월 미만) 연간 환산이 왜곡될 수 있음
  if (years < 0.08) {
    console.log(`경고: 데이터 기간이 너무 짧습니다 (${(years * 365).toFixed(0)}일). 수익률 계산이 왜곡될 수 있습니다.`);
    return 0;
  }
  
  // SCHD인 경우 배당수익률 추가
  const symbol2 = filteredData2 && filteredData2.length > 0 && filteredData2[0].symbol;
  if (symbol2 === 'SCHD') {
    const dividendYield = 0.035 * years; // 연 3.5% 배당수익률
    returnRate2 += dividendYield;
    console.log(`SCHD 배당 적용: ${years.toFixed(2)}년 기간, 배당률 ${(dividendYield * 100).toFixed(2)}% 추가`);
  }
  
  // 가중 평균 수익률 계산
  const weightedReturn = (returnRate1 * (weight1 / 100)) + (returnRate2 * (weight2 / 100));
  
  // 연평균 수익률 계산 (CAGR)
  const cagr = Math.pow(1 + weightedReturn, 1 / years) - 1;
  
  // 계산 과정 로깅 (디버깅용)
  console.log(`수익률 계산 [${filteredData1[0].symbol || 'Asset1'} ${weight1}% + ${symbol2 || 'Asset2'} ${weight2}%]:`);
  console.log(`  기간: ${years.toFixed(2)}년 (${filteredData1.length}일)`);
  console.log(`  ${filteredData1[0].symbol || 'Asset1'} 수익률: ${(returnRate1 * 100).toFixed(2)}%`);
  console.log(`  ${symbol2 || 'Asset2'} 수익률: ${(returnRate2 * 100).toFixed(2)}%`);
  console.log(`  가중평균 수익률: ${(weightedReturn * 100).toFixed(2)}%`);
  console.log(`  연평균(CAGR): ${(cagr * 100).toFixed(2)}%`);
  
  return cagr;
}

// 변동성 계산 함수
function calculateVolatility(data1, data2, weight1, weight2) {
  if (data1.length < 2 || data2.length < 2) return 0;
  
  // 동일한 날짜의 데이터만 사용하기 위해 날짜 매핑
  const dateMap1 = new Map();
  const dateMap2 = new Map();
  
  data1.forEach(d => dateMap1.set(d.date, d.close));
  data2.forEach(d => dateMap2.set(d.date, d.close));
  
  // 두 데이터셋 모두에 있는 날짜만 사용
  const commonDates = [...dateMap1.keys()].filter(date => dateMap2.has(date)).sort();
  
  if (commonDates.length < 2) return 0;
  
  // 일일 수익률 계산
  const dailyReturns = [];
  
  for (let i = 1; i < commonDates.length; i++) {
    const prevDate = commonDates[i-1];
    const currDate = commonDates[i];
    
    const return1 = (dateMap1.get(currDate) / dateMap1.get(prevDate)) - 1;
    const return2 = (dateMap2.get(currDate) / dateMap2.get(prevDate)) - 1;
    
    const weightedReturn = (return1 * (weight1 / 100)) + (return2 * (weight2 / 100));
    dailyReturns.push(weightedReturn);
  }
  
  // 표준편차 계산
  const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
  const dailyVolatility = Math.sqrt(variance);
  
  // 연간 변동성으로 변환 (거래일 기준)
  return dailyVolatility * Math.sqrt(252);
}

// 최대 낙폭 (MDD) 계산 함수
function calculateMDD(data1, data2, weight1, weight2) {
  if (data1.length < 2 || data2.length < 2) return 0;
  
  // 동일한 날짜의 데이터만 사용하기 위해 날짜 매핑
  const dateMap1 = new Map();
  const dateMap2 = new Map();
  
  data1.forEach(d => dateMap1.set(d.date, d.close));
  data2.forEach(d => dateMap2.set(d.date, d.close));
  
  // 두 데이터셋 모두에 있는 날짜만 사용
  const commonDates = [...dateMap1.keys()].filter(date => dateMap2.has(date)).sort();
  
  if (commonDates.length < 2) return 0;
  
  // 포트폴리오 가치 시뮬레이션
  const portfolioValues = [];
  const initialValue1 = dateMap1.get(commonDates[0]);
  const initialValue2 = dateMap2.get(commonDates[0]);
  
  for (const date of commonDates) {
    const value1 = dateMap1.get(date) / initialValue1;
    const value2 = dateMap2.get(date) / initialValue2;
    const weightedValue = (value1 * (weight1 / 100)) + (value2 * (weight2 / 100));
    portfolioValues.push(weightedValue);
  }
  
  // MDD 계산
  let maxValue = portfolioValues[0];
  let maxDrawdown = 0;
  
  for (let i = 1; i < portfolioValues.length; i++) {
    if (portfolioValues[i] > maxValue) {
      maxValue = portfolioValues[i];
    }
    
    const drawdown = (maxValue - portfolioValues[i]) / maxValue;
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