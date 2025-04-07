// 유틸리티 함수들

// 데이터 정규화 함수 (초기값 = 100)
export function normalizeData(data) {
  if (!data || data.length === 0) return [];
  
  const initialValue = data[0].close;
  return data.map(item => (item.close / initialValue) * 100);
}

// 포트폴리오 성과 계산 함수 (고정 비율, 리밸런싱 적용)
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

// 200일 이동평균선 기준 TQQQ가 위인지 아래인지 확인
export function isAboveMA(maData) {
  if (!maData || !maData.values || maData.values.length === 0) {
    return true; // 데이터가 없는 경우 기본값
  }
  
  // 가장 최근 데이터의 이동평균선 위치 확인
  const latestData = maData.values[maData.values.length - 1];
  return latestData.aboveMA;
}

// 200일 이동평균선 전략 성과 계산
export function calculateMAStrategyPerformance(tqqqData, assetData, maData, aboveMAPercent, belowMAPercent) {
  if (!maData || !maData.values || maData.values.length === 0 ||
      !tqqqData || !assetData || tqqqData.length === 0 || assetData.length === 0) {
    return [];
  }
  
  // tqqqData와 assetData 날짜 매핑
  const tqqqMap = {};
  tqqqData.forEach(item => tqqqMap[item.date] = item.close);
  
  const assetMap = {};
  assetData.forEach(item => assetMap[item.date] = item.close);
  
  // MA 데이터와 일치하는 날짜만 사용
  const maWithPrices = maData.values.filter(item => 
    tqqqMap[item.date] !== undefined && assetMap[item.date] !== undefined
  );
  
  if (maWithPrices.length === 0) return [];
  
  // 초기 투자금액 (100$)
  const initialValue = 100;
  const result = [];
  
  // 초기 TQQQ와 선택 자산 가격
  const initialTQQQPrice = tqqqMap[maWithPrices[0].date];
  const initialAssetPrice = assetMap[maWithPrices[0].date];
  
  // 이전 상태 (이평선 위/아래)
  let lastAboveMA = maWithPrices[0].aboveMA;
  
  // 이전 비율
  let lastTQQQRatio = lastAboveMA ? aboveMAPercent / 100 : belowMAPercent / 100;
  let lastAssetRatio = 1 - lastTQQQRatio;
  
  // 초기 지분 계산
  let tqqqShares = (initialValue * lastTQQQRatio) / initialTQQQPrice;
  let assetShares = (initialValue * lastAssetRatio) / initialAssetPrice;
  
  // 첫 번째 날짜 결과 추가
  result.push(initialValue);
  
  // 마지막 교차 날짜 기록 (교차 제한용)
  let lastCrossoverDate = new Date(maWithPrices[0].date);
  
  // 마지막 리밸런싱 비율
  let targetTQQQRatio = lastTQQQRatio;
  
  // 각 날짜에 대해 전략 적용 및 성과 계산
  for (let i = 1; i < maWithPrices.length; i++) {
    const currentData = maWithPrices[i];
    const currentDate = currentData.date;
    const currentAboveMA = currentData.aboveMA;
    
    // 현재 가격
    const currentTQQQPrice = tqqqMap[currentDate];
    const currentAssetPrice = assetMap[currentDate];
    
    // 현재 포트폴리오 가치
    const tqqqValue = tqqqShares * currentTQQQPrice;
    const assetValue = assetShares * currentAssetPrice;
    const portfolioValue = tqqqValue + assetValue;
    
    // 현재 실제 TQQQ 비율
    const currentTQQQRatio = tqqqValue / portfolioValue;
    
    // 이평선 교차 확인 및 목표 비율 변경
    if (currentAboveMA !== lastAboveMA) {
      // 현재 날짜를 Date 객체로 변환
      const currDate = new Date(currentDate);
      
      // 마지막 교차 이후 경과일 계산
      const daysSinceLastCross = Math.floor((currDate - lastCrossoverDate) / (1000 * 60 * 60 * 24));
      
      // 최소 2일(판매기한) 이상 경과한 경우에만 교차 처리
      if (daysSinceLastCross >= 2) {
        // 목표 비율 변경
        targetTQQQRatio = currentAboveMA ? aboveMAPercent / 100 : belowMAPercent / 100;
        
        // 상태 업데이트
        lastAboveMA = currentAboveMA;
        lastCrossoverDate = currDate; // 마지막 교차 날짜 업데이트
      }
    }
    
    // 리밸런싱 - 현재 비율과 목표 비율의 차이가 3%p 이상일 때만 리밸런싱
    if (Math.abs(currentTQQQRatio - targetTQQQRatio) >= 0.03) {
      // 새로운 지분 계산
      tqqqShares = (portfolioValue * targetTQQQRatio) / currentTQQQPrice;
      assetShares = (portfolioValue * (1 - targetTQQQRatio)) / currentAssetPrice;
    }
    
    // 해당 날짜의 포트폴리오 가치 추가
    result.push(portfolioValue);
  }
  
  return result;
}

// 차트 캔버스 크기 고정 함수
export function fixChartCanvasSize() {
  const canvasElements = document.querySelectorAll('canvas');
  canvasElements.forEach(canvas => {
    canvas.style.height = '300px';
    canvas.style.boxSizing = 'border-box';
    canvas.style.width = '100%';
  });
} 