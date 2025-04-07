// 유틸리티 함수들

// 데이터 정규화 함수 (초기값 = 100)
export function normalizeData(data) {
  if (!data || data.length === 0) return [];
  
  const initialValue = data[0].close;
  return data.map(item => (item.close / initialValue) * 100);
}

// 포트폴리오 성과 계산 함수
export function calculatePortfolioPerformance(data1, data2, weight1) {
  const weight2 = 100 - weight1;
  
  return data1.map((value, index) => {
    return (value * (weight1 / 100)) + (data2[index] * (weight2 / 100));
  });
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