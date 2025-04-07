const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 전역 캐시 변수 (서버 재시작시까지 유지)
const globalCache = {
  tqqq: null,
  gld: null,
  shy: null, 
  tlt: null,
  schd: null,
  vnq: null,
  qqq: null,
  sqqq: null,
  lastFetch: null,
  portfolios: null,
  maData: null
};

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../public')));

// 주식 데이터 API 엔드포인트
app.get('/api/stock/:symbol', async (req, res) => {
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
    
    // 전역 캐시에 데이터 저장
    globalCache[symbolLower] = data;
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stock data' });
  }
});

// 포트폴리오 분석 API 엔드포인트
app.get('/api/analyze', async (req, res) => {
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
    await fetchStockDataIfNeeded(assetType);
    
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
        const periodQqq = globalCache.qqq.filter(item => item.date >= cutoffDateString);
        
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
    
    // 200일 이동평균선 계산
    if (!globalCache.maData || globalCache.maData.symbol !== 'tqqq') {
      globalCache.maData = calculateMovingAverage(globalCache.tqqq, 200);
    }

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

// 주식 데이터를 가져와서 전역 캐시에 저장
async function fetchStockDataIfNeeded(assetType = 'gld') {
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

// 서버 시작 시 바로 데이터 로드
app.listen(PORT, async () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`Yahoo Finance API로 데이터를 불러옵니다`);
  
  // 서버 시작 시 데이터 미리 로드
  try {
    console.log('서버 시작 시 기본 자산 데이터 미리 로드 중...');
    await fetchStockDataIfNeeded('gld'); // 기본 자산(GLD)만 미리 로드
  } catch (error) {
    console.error('초기 데이터 로드 실패:', error);
  }
});
