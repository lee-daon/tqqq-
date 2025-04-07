// 전역 변수
let portfolioData = null;
let rawData = null;
let maData = null;
let performanceChart = null;
let maChart = null;
let efficientFrontierTQQQ_Asset = null;
let efficientFrontierTQQQ_QQQ = null;
let currentPeriod = 1; // 기본값: 1년
let tqqqAssetRatio = 50; // 기본값: TQQQ 50%, 선택 자산 50%
let currentAsset = 'gld'; // 기본값: GLD
let globalCache = {}; // 현금 선택 시 사용할 전역 캐시
let assetFullNames = {
  'gld': 'GLD (금)',
  'shy': 'SHY (단기 국채)',
  'tlt': 'TLT (장기 국채)',
  'schd': 'SCHD (배당주)',
  'vnq': 'VNQ (부동산)',
  'sqqq': 'SQQQ (인버스 QQQ 3X)',
  'cash': '현금 (무위험)'
};
let assetColors = {
  'gld': 'rgba(255, 215, 0, 1)', // 금색
  'shy': 'rgba(0, 128, 0, 1)',   // 녹색
  'tlt': 'rgba(0, 0, 128, 1)',   // 남색
  'schd': 'rgba(128, 0, 128, 1)', // 보라색
  'vnq': 'rgba(165, 42, 42, 1)', // 갈색
  'sqqq': 'rgba(255, 0, 0, 1)',  // 빨간색
  'cash': 'rgba(128, 128, 128, 1)' // 회색
};

// 이평선 전략 설정
let useMAStrategy = false;
let aboveMAPercent = 70;
let belowMAPercent = 30;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  // 차트 캔버스 크기 고정
  fixChartCanvasSize();
  
  // 데이터 로드
  fetchAnalysis();
  
  // 이벤트 리스너 등록
  setupEventListeners();
  
  // 이평선 차트 항상 표시
  document.getElementById('maSection').classList.remove('d-none');
});

// 차트 캔버스 크기 고정 함수
function fixChartCanvasSize() {
  const canvasElements = document.querySelectorAll('canvas');
  canvasElements.forEach(canvas => {
    canvas.style.height = '300px';
    canvas.style.boxSizing = 'border-box';
    canvas.style.width = '100%';
  });
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 기간 선택 버튼
  const periodButtons = document.querySelectorAll('#period-selector button');
  periodButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      periodButtons.forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentPeriod = parseInt(e.target.dataset.period);
      updateAllCharts();
    });
  });
  
  // TQQQ/자산 비율 슬라이더
  const tqqqAssetSlider = document.getElementById('tqqqAssetSlider');
  tqqqAssetSlider.addEventListener('input', (e) => {
    tqqqAssetRatio = parseInt(e.target.value);
    document.getElementById('tqqqAssetValue').textContent = tqqqAssetRatio;
    updatePerformanceChart();
    updateSelectedPortfolioStats();
  });

  // 자산 변경 버튼
  const changeAssetBtn = document.getElementById('changeAssetBtn');
  changeAssetBtn.addEventListener('click', async () => {
    const assetSelector = document.getElementById('assetSelector');
    const newAsset = assetSelector.value.toLowerCase();
    
    if (newAsset !== currentAsset) {
      currentAsset = newAsset;
      
      // UI 업데이트
      updateAssetLabels();
      
      // 데이터 다시 로드
      await fetchAnalysis();
    }
  });

  // 200일 이평선 전략 토글
  const autoStrategyToggle = document.getElementById('autoStrategyToggle');
  autoStrategyToggle.addEventListener('change', function() {
    useMAStrategy = this.checked;
    
    // 관련 UI 요소 표시/숨김
    document.getElementById('strategyDescription').classList.toggle('d-none', !useMAStrategy);
    document.getElementById('strategySettings').classList.toggle('d-none', !useMAStrategy);
    document.getElementById('manualSliderContainer').classList.toggle('d-none', useMAStrategy);
    document.getElementById('strategyStatsCard').classList.toggle('d-none', !useMAStrategy);
    
    if (useMAStrategy) {
      updateStrategyStats();
    } else {
      updatePerformanceChart();
    }
  });

  // 이평선 위/아래 전략 설정 슬라이더
  const aboveRatioSlider = document.getElementById('aboveRatioSlider');
  aboveRatioSlider.addEventListener('input', (e) => {
    aboveMAPercent = parseInt(e.target.value);
    document.getElementById('aboveRatioValue').textContent = aboveMAPercent;
    document.getElementById('aboveRatio').textContent = aboveMAPercent;
    document.getElementById('aboveComplementRatio').textContent = 100 - aboveMAPercent;
    
    if (useMAStrategy) {
      updateStrategyStats();
      updatePerformanceChart();
    }
  });

  const belowRatioSlider = document.getElementById('belowRatioSlider');
  belowRatioSlider.addEventListener('input', (e) => {
    belowMAPercent = parseInt(e.target.value);
    document.getElementById('belowRatioValue').textContent = belowMAPercent;
    document.getElementById('belowRatio').textContent = belowMAPercent;
    document.getElementById('belowComplementRatio').textContent = 100 - belowMAPercent;
    
    if (useMAStrategy) {
      updateStrategyStats();
      updatePerformanceChart();
    }
  });
}

// HTML 요소에서 자산 이름 업데이트
function updateAssetLabels() {
  document.getElementById('asset1Label').textContent = currentAsset.toUpperCase();
  document.getElementById('asset2Label').textContent = currentAsset.toUpperCase();
  document.getElementById('asset3Label').textContent = currentAsset.toUpperCase();
}

// 분석 데이터 가져오기
async function fetchAnalysis() {
  try {
    // 현금 선택 시 API 호출하지 않고 직접 계산
    if (currentAsset === 'cash') {
      // TQQQ 데이터가 없으면 먼저 가져오기
      if (!globalCache.tqqq) {
        const tqqqResponse = await fetch('/api/stock/TQQQ');
        globalCache.tqqq = await tqqqResponse.json();
      }

      // QQQ 데이터가 없으면 먼저 가져오기
      if (!globalCache.qqq) {
        const qqqResponse = await fetch('/api/stock/QQQ');
        globalCache.qqq = await qqqResponse.json();
      }

      // 이동평균선 데이터가 없으면 먼저 가져오기
      if (!globalCache.maData) {
        const response = await fetch('/api/analyze?asset=gld');
        const data = await response.json();
        globalCache.maData = data.maData;
      }

      const cashData = generateCashData();
      portfolioData = calculateCashPortfolioData(cashData);
      rawData = {
        tqqq: globalCache.tqqq || [],
        cash: cashData,
        qqq: globalCache.qqq || []
      };
      maData = globalCache.maData;
    } else {
      const response = await fetch(`/api/analyze?asset=${currentAsset}`);
      const data = await response.json();
      portfolioData = data.portfolios;
      rawData = data.rawData;
      maData = data.maData;
      
      // 현금 선택을 위해 전역 캐시에 저장
      globalCache.tqqq = rawData.tqqq;
      globalCache.qqq = rawData.qqq;
      globalCache.maData = maData;
    }
    
    // 모든 차트와 표 업데이트
    updateAllCharts();
    
    // 200일 이평선 전략 상태 업데이트
    updateMACurrentStatus();
    
    // 200일 이평선 전략이 활성화된 경우 전략 통계 업데이트
    if (useMAStrategy) {
      updateStrategyStats();
    }
    
  } catch (error) {
    console.error('Error fetching analysis data:', error);
    alert('데이터를 불러오는 중 오류가 발생했습니다.');
  }
}

// 현금 데이터 생성 함수
function generateCashData() {
  // 현재 시간 기준으로 10년 전 날짜 계산
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 10);
  
  const data = [];
  const yearlyReturn = 0.02; // 연 2% 수익률
  const dailyReturn = Math.pow(1 + yearlyReturn, 1/252) - 1;
  
  // 10년치 일일 데이터 생성 (영업일만)
  let currentDate = new Date(startDate);
  let currentValue = 100; // 초기값 $100
  
  while (currentDate <= endDate) {
    // 주말 건너뛰기
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      // 일별 증가율 적용
      currentValue *= (1 + dailyReturn);
      
      data.push({
        date: currentDate.toISOString().split('T')[0],
        close: parseFloat(currentValue.toFixed(2)),
        volume: 0,
        symbol: 'CASH'
      });
    }
    
    // 다음 날짜로 이동
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return data;
}

// 현금 포트폴리오 데이터 계산 함수
function calculateCashPortfolioData(cashData) {
  if (!globalCache.tqqq || globalCache.tqqq.length === 0) {
    console.error('TQQQ 데이터가 없어 현금 포트폴리오를 계산할 수 없습니다.');
    return [];
  }
  
  const portfoliosData = [];
  
  // 동일한 날짜에 맞춰 필터링
  const tqqqDates = new Set(globalCache.tqqq.map(item => item.date));
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
      
      const periodTqqq = globalCache.tqqq.filter(item => item.date >= cutoffDateString);
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

// 포트폴리오 연평균 수익률 계산
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

// 포트폴리오 변동성 계산
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

// 포트폴리오 최대 낙폭 계산
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

// 현재 이평선 위치 상태 표시 업데이트
function updateMACurrentStatus() {
  const statusContainer = document.getElementById('maCurrentStatus');
  if (!maData || !maData.values || maData.values.length === 0) {
    statusContainer.innerHTML = '<div class="alert alert-warning">이평선 데이터를 불러올 수 없습니다.</div>';
    return;
  }
  
  const currentAboveMA = isAboveMA();
  const statusClass = currentAboveMA ? 'success' : 'danger';
  const statusText = currentAboveMA ? '위' : '아래';
  
  statusContainer.innerHTML = `
    <div class="alert alert-${statusClass} d-inline-block">
      <strong>현재 TQQQ는 200일 이평선 <span class="text-${statusClass}">${statusText}</span>에 있습니다.</strong>
    </div>
  `;
}

// 모든 차트 및 표 업데이트
function updateAllCharts() {
  if (!portfolioData || !rawData) return;
  
  updateEfficientFrontierTQQQ_Asset();
  updatePortfolioTable();
  updatePerformanceChart();
  updateSelectedPortfolioStats();
  updateMAChart();
}

// TQQQ/Asset 효율적 투자선 업데이트
function updateEfficientFrontierTQQQ_Asset() {
  const ctx = document.getElementById('efficientFrontierTQQQ_Asset').getContext('2d');
  
  // 현재 선택된 기간에 맞는 데이터 필터링
  const periodKey = `${currentPeriod}year`;
  const filteredData = portfolioData.filter(item => item[periodKey]);
  
  // 차트 데이터 생성 - 선택한 자산과 TQQQ
  const assetChartData = filteredData.map(item => ({
    x: item[periodKey].volatility,
    y: item[periodKey].annualReturn,
    ratio: item.tqqqWeight,
    type: 'asset'
  }));
  
  // 현금의 가상 데이터 포인트 (무위험 수익률과 0 변동성)
  const cashReturn = 0.02; // 2% 무위험 수익률 가정
  const cashVolatility = 0.001; // 거래일 기준
  
  // 현금과 TQQQ 포트폴리오 데이터 생성
  const cashTQQQData = [];
  const tqqqPoint = assetChartData.find(point => point.ratio === 100);
  
  if (tqqqPoint) {
    for (let tqqqWeight = 0; tqqqWeight <= 100; tqqqWeight += 5) {
      const cashWeight = 100 - tqqqWeight;
      const tqqqRatio = tqqqWeight / 100;
      const cashRatio = cashWeight / 100;
      
      // 수익률 가중 평균
      const portfolioReturn = (tqqqPoint.y * tqqqRatio) + (cashReturn * cashRatio);
      
      // 변동성은 현금 부분이 0이므로 TQQQ 부분의 변동성만 고려
      const portfolioVolatility = tqqqPoint.x * tqqqRatio;
      
      cashTQQQData.push({
        x: portfolioVolatility,
        y: portfolioReturn,
        ratio: tqqqWeight,
        type: 'cash'
      });
    }
  }
  
  // 개별 자산 데이터
  const tqqqPoint2 = assetChartData.find(point => point.ratio === 100);
  const assetPoint = assetChartData.find(point => point.ratio === 0);
  const cashPoint = { x: cashVolatility, y: cashReturn, type: 'cash' };
  
  // 효율적 투자선 차트
  if (efficientFrontierTQQQ_Asset) {
    efficientFrontierTQQQ_Asset.destroy();
  }
  
  efficientFrontierTQQQ_Asset = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: `TQQQ/${currentAsset.toUpperCase()} 포트폴리오`,
          data: assetChartData,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'TQQQ/현금 포트폴리오',
          data: cashTQQQData,
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'TQQQ',
          data: [tqqqPoint2],
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          pointRadius: 7,
          pointHoverRadius: 9
        },
        {
          label: currentAsset.toUpperCase(),
          data: [assetPoint],
          backgroundColor: assetColors[currentAsset].replace('1)', '0.5)'),
          borderColor: assetColors[currentAsset],
          borderWidth: 1,
          pointRadius: 7,
          pointHoverRadius: 9
        },
        {
          label: '현금',
          data: [cashPoint],
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          borderColor: 'rgba(0, 0, 0, 1)',
          borderWidth: 1,
          pointRadius: 7,
          pointHoverRadius: 9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const item = context.raw;
              if (item.type === 'cash') {
                return `TQQQ: ${item.ratio}%, 현금: ${100-item.ratio}%, 수익률: ${(item.y * 100).toFixed(2)}%, 변동성: ${(item.x * 100).toFixed(2)}%`;
              } else {
                return `TQQQ: ${item.ratio}%, ${currentAsset.toUpperCase()}: ${100-item.ratio}%, 수익률: ${(item.y * 100).toFixed(2)}%, 변동성: ${(item.x * 100).toFixed(2)}%`;
              }
            }
          }
        },
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: `TQQQ 조합 효율적 투자선 (${currentPeriod}년)`
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '변동성 (표준편차)'
          },
          ticks: {
            callback: function(value) {
              return (value * 100).toFixed(0) + '%';
            }
          }
        },
        y: {
          title: {
            display: true,
            text: '연평균 수익률'
          },
          ticks: {
            callback: function(value) {
              return (value * 100).toFixed(0) + '%';
            }
          }
        }
      }
    }
  });
}

// 포트폴리오 테이블 업데이트
function updatePortfolioTable() {
  const tableBody = document.getElementById('portfolioTable');
  tableBody.innerHTML = '';
  
  const periodKey = `${currentPeriod}year`;
  const filteredData = portfolioData.filter(item => item[periodKey]);
  
  filteredData.forEach(item => {
    const row = document.createElement('tr');
    
    // 선택된 포트폴리오 강조 표시
    let rowHighlight = false;
    
    if (!useMAStrategy && item.tqqqWeight === tqqqAssetRatio) {
      rowHighlight = true;
    } else if (useMAStrategy) {
      if (isAboveMA() && item.tqqqWeight === aboveMAPercent) {
        rowHighlight = true;
      } else if (!isAboveMA() && item.tqqqWeight === belowMAPercent) {
        rowHighlight = true;
      }
    }
    
    if (rowHighlight) {
      row.classList.add('table-primary');
    }
    
    row.innerHTML = `
      <td>${item.tqqqWeight}%</td>
      <td>${100 - item.tqqqWeight}%</td>
      <td>${(item[periodKey].annualReturn * 100).toFixed(2)}%</td>
      <td>${item[periodKey].sharpeRatio.toFixed(2)}</td>
      <td>${(item[periodKey].mdd * 100).toFixed(2)}%</td>
    `;
    
    tableBody.appendChild(row);
  });
}

// 성과 비교 차트 업데이트
function updatePerformanceChart() {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  
  // 데이터 필터링 (선택한 기간)
  const periodFilter = currentPeriod * 252; // 거래일 기준
  const tqqqData = rawData.tqqq.slice(-periodFilter);
  const assetData = rawData[currentAsset].slice(-periodFilter);
  const qqqData = rawData.qqq.slice(-periodFilter);
  
  // 초기값으로 정규화
  const tqqqNormalized = normalizeData(tqqqData);
  const assetNormalized = normalizeData(assetData);
  const qqqNormalized = normalizeData(qqqData);
  
  // 선택한 포트폴리오 성과 계산
  let portfolioNormalized;
  let portfolioLabel;
  
  if (useMAStrategy) {
    // 200일 이동평균선 전략 사용
    portfolioNormalized = calculateMAStrategyPerformance(tqqqData, assetData);
    portfolioLabel = `이평선 전략 (TQQQ 위:${aboveMAPercent}% 아래:${belowMAPercent}%)`;
  } else {
    // 일반 비율 고정 전략
    portfolioNormalized = calculatePortfolioPerformance(tqqqNormalized, assetNormalized, tqqqAssetRatio);
    portfolioLabel = `포트폴리오 (TQQQ ${tqqqAssetRatio}%, ${currentAsset.toUpperCase()} ${100-tqqqAssetRatio}%)`;
  }
  
  // 날짜 레이블 생성 (x축)
  const labels = tqqqData.map(d => d.date);
  
  // 차트 데이터셋
  const datasets = [
    {
      label: 'TQQQ',
      data: tqqqNormalized,
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1,
      backgroundColor: 'rgba(255, 99, 132, 0.1)',
      fill: false,
      tension: 0.1
    },
    {
      label: currentAsset.toUpperCase(),
      data: assetNormalized,
      borderColor: assetColors[currentAsset],
      borderWidth: 1,
      backgroundColor: assetColors[currentAsset].replace('1)', '0.1)'),
      fill: false,
      tension: 0.1
    },
    {
      label: 'QQQ',
      data: qqqNormalized,
      borderColor: 'rgba(255, 206, 86, 1)',
      borderWidth: 1,
      backgroundColor: 'rgba(255, 206, 86, 0.1)',
      fill: false,
      tension: 0.1
    },
    {
      label: portfolioLabel,
      data: portfolioNormalized,
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      fill: false,
      tension: 0.1
    }
  ];
  
  // 차트 생성/업데이트
  if (performanceChart) {
    performanceChart.destroy();
  }
  
  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: `포트폴리오 성과 비교 (${currentPeriod}년)`
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 10
          }
        },
        y: {
          title: {
            display: true,
            text: '성과 지수 (초기값 = 100)'
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(0);
            }
          }
        }
      }
    }
  });
}

// 200일 이동평균선 차트 업데이트
function updateMAChart() {
  const ctx = document.getElementById('maChart').getContext('2d');
  
  if (!maData || !maData.values || maData.values.length === 0) {
    if (maChart) {
      maChart.destroy();
      maChart = null;
    }
    return;
  }
  
  // 데이터 필터링 (선택한 기간)
  const periodFilter = Math.min(currentPeriod * 252, maData.values.length); // 거래일 기준
  const maValues = maData.values.slice(-periodFilter);
  
  // 날짜 레이블
  const labels = maValues.map(d => d.date);
  
  // 가격 데이터
  const prices = maValues.map(d => d.price);
  
  // 이동평균선 데이터
  const mas = maValues.map(d => d.ma);
  
  // 교차점 데이터
  const crossovers = maData.crossovers.filter(c => {
    const dateTime = new Date(c.date).getTime();
    const startTime = new Date(maValues[0].date).getTime();
    return dateTime >= startTime;
  });
  
  // 이평선 위/아래 상태를 분류하는 데이터
  const abovePoints = [];
  const belowPoints = [];
  
  for (let i = 0; i < maValues.length; i++) {
    const point = {
      x: i,
      y: maValues[i].price
    };
    
    if (maValues[i].aboveMA) {
      abovePoints.push(point);
      belowPoints.push(null);
    } else {
      abovePoints.push(null);
      belowPoints.push(point);
    }
  }
  
  // 교차점에 대한 참조선
  const annotations = crossovers.map((c, index) => {
    const dateIndex = labels.indexOf(c.date);
    return {
      type: 'line',
      xMin: dateIndex,
      xMax: dateIndex,
      borderColor: c.crossType === 'up' ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: c.crossType === 'up' ? '↗' : '↘',
        enabled: true,
        position: c.crossType === 'up' ? 'start' : 'end',
        backgroundColor: c.crossType === 'up' ? 'rgba(75, 192, 192, 0.9)' : 'rgba(255, 99, 132, 0.9)',
        font: {
          size: 16
        }
      }
    };
  });

  // 차트 업데이트/생성
  if (maChart) {
    maChart.destroy();
  }
  
  // 차트 생성
  maChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'TQQQ 가격',
          data: prices,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3
        },
        {
          label: '200일 이동평균선',
          data: mas,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'TQQQ 가격 및 200일 이동평균선'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        },
        annotation: {
          annotations: annotations
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 12
          }
        },
        y: {
          title: {
            display: true,
            text: '가격'
          }
        }
      }
    }
  });
  
  // 이평선 상태 업데이트
  updateMACurrentStatus();
}

// 선택한 포트폴리오 통계 업데이트
function updateSelectedPortfolioStats() {
  const statsContainer = document.getElementById('selectedPortfolioStats');
  
  const periodKey = `${currentPeriod}year`;
  const portfolioStats = portfolioData.find(item => item.tqqqWeight === tqqqAssetRatio);
  
  if (!portfolioStats || !portfolioStats[periodKey]) {
    statsContainer.innerHTML = '<div class="alert alert-warning">데이터를 불러올 수 없습니다.</div>';
    return;
  }
  
  const annualReturn = (portfolioStats[periodKey].annualReturn * 100).toFixed(2);
  const sharpeRatio = portfolioStats[periodKey].sharpeRatio.toFixed(2);
  const mdd = (portfolioStats[periodKey].mdd * 100).toFixed(2);
  const volatility = (portfolioStats[periodKey].volatility * 100).toFixed(2);
  
  statsContainer.innerHTML = `
    <div class="mb-2">
      <strong>연평균 수익률:</strong> 
      <span class="${annualReturn > 0 ? 'text-success' : 'text-danger'}">${annualReturn}%</span>
    </div>
    <div class="mb-2">
      <strong>샤프 지수:</strong> ${sharpeRatio}
    </div>
    <div class="mb-2">
      <strong>최대 낙폭 (MDD):</strong> 
      <span class="text-danger">${mdd}%</span>
    </div>
    <div class="mb-2">
      <strong>변동성:</strong> ${volatility}%
    </div>
    <div class="mt-3 small text-muted">
      ${currentPeriod}년 데이터 기준
    </div>
  `;
}

// 데이터 정규화 함수 (초기값 = 100)
function normalizeData(data) {
  if (!data || data.length === 0) return [];
  
  const initialValue = data[0].close;
  return data.map(item => (item.close / initialValue) * 100);
}

// 포트폴리오 성과 계산 함수
function calculatePortfolioPerformance(data1, data2, weight1) {
  const weight2 = 100 - weight1;
  
  return data1.map((value, index) => {
    return (value * (weight1 / 100)) + (data2[index] * (weight2 / 100));
  });
}

// 200일 이동평균선 기준 TQQQ가 위인지 아래인지 확인
function isAboveMA() {
  if (!maData || !maData.values || maData.values.length === 0) {
    return true; // 데이터가 없는 경우 기본값
  }
  
  // 가장 최근 데이터의 이동평균선 위치 확인
  const latestData = maData.values[maData.values.length - 1];
  return latestData.aboveMA;
}

// 200일 이동평균선 전략 성과 계산
function calculateMAStrategyPerformance(tqqqData, assetData) {
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

// 200일 이평선 전략 통계 업데이트
function updateStrategyStats() {
  const statsContainer = document.getElementById('strategyStats');
  
  if (!maData || !maData.values || maData.values.length === 0) {
    statsContainer.innerHTML = '<div class="alert alert-warning">데이터를 불러올 수 없습니다.</div>';
    return;
  }
  
  // 현재 TQQQ 상태 (이평선 위/아래)
  const currentAboveMA = isAboveMA();
  const currentTQQQRatio = currentAboveMA ? aboveMAPercent : belowMAPercent;
  const currentAssetRatio = 100 - currentTQQQRatio;
  
  // 실제 전체 교차 횟수 계산
  const totalCrossovers = maData.crossovers ? maData.crossovers.length : 0;
  
  // 2일 제한 적용 후 교차 횟수 계산
  let limitedCrossovers = 0;
  let lastCrossDate = null;
  
  if (maData.crossovers && maData.crossovers.length > 0) {
    // 교차점 날짜 순서대로 정렬
    const sortedCrossovers = [...maData.crossovers].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // 2일 제한 적용하여 횟수 계산
    sortedCrossovers.forEach(cross => {
      const crossDate = new Date(cross.date);
      if (!lastCrossDate || (crossDate - lastCrossDate) >= (2 * 24 * 60 * 60 * 1000)) {
        limitedCrossovers++;
        lastCrossDate = crossDate;
      }
    });
  }
  
  // 전략 성능 계산 (선택한 기간에 대해)
  // 기간에 해당하는 데이터 필터링
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - currentPeriod);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];
  
  // 필터링된 데이터
  const periodTqqq = rawData.tqqq.filter(item => item.date >= cutoffDateString);
  const periodAsset = rawData[currentAsset].filter(item => item.date >= cutoffDateString);
  
  if (periodTqqq.length < 10 || periodAsset.length < 10) {
    statsContainer.innerHTML = '<div class="alert alert-warning">선택한 기간의 데이터가 충분하지 않습니다.</div>';
    return;
  }
  
  // 전략 시뮬레이션 성과 계산
  const strategyPerformance = calculateMAStrategyPerformance(periodTqqq, periodAsset);
  if (strategyPerformance.length < 2) {
    statsContainer.innerHTML = '<div class="alert alert-warning">전략 성과를 계산할 수 없습니다.</div>';
    return;
  }
  
  // 시작값과 종료값
  const startValue = strategyPerformance[0];
  const endValue = strategyPerformance[strategyPerformance.length - 1];
  
  // 전체 수익률
  const totalReturn = (endValue / startValue) - 1;
  
  // 기간 계산 (연 단위)
  const startDate = new Date(periodTqqq[0].date);
  const endDate = new Date(periodTqqq[periodTqqq.length - 1].date);
  const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
  
  // 연평균 수익률 (CAGR)
  const annualReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
  
  // 최대 낙폭 계산
  let peakValue = strategyPerformance[0];
  let maxDrawdown = 0;
  
  for (let i = 1; i < strategyPerformance.length; i++) {
    if (strategyPerformance[i] > peakValue) {
      peakValue = strategyPerformance[i];
    } else {
      const drawdown = (peakValue - strategyPerformance[i]) / peakValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  
  // 변동성 계산 (일별 수익률의 표준편차 * sqrt(252))
  const dailyReturns = [];
  for (let i = 1; i < strategyPerformance.length; i++) {
    const dailyReturn = (strategyPerformance[i] / strategyPerformance[i-1]) - 1;
    dailyReturns.push(dailyReturn);
  }
  
  const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  
  // 샤프 지수
  const riskFreeRate = 0.02; // 2% 무위험 수익률 가정
  const sharpeRatio = (annualReturn - riskFreeRate) / volatility;
  
  // 현재 TQQQ 상태에 따른 포트폴리오 비율
  statsContainer.innerHTML = `
    <div class="mb-2">
      <strong>현재 상태:</strong> TQQQ가 200일 이평선 
      <span class="${currentAboveMA ? 'text-success' : 'text-danger'}">
        <strong>${currentAboveMA ? '위' : '아래'}</strong>
      </span>
    </div>
    <div class="mb-2">
      <strong>현재 포트폴리오:</strong> TQQQ ${currentTQQQRatio}% / ${currentAsset.toUpperCase()} ${currentAssetRatio}%
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 연평균 수익률:</strong> 
      <span class="${annualReturn > 0 ? 'text-success' : 'text-danger'}">
        ${(annualReturn * 100).toFixed(2)}%
      </span>
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 샤프 지수:</strong> ${sharpeRatio.toFixed(2)}
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 최대 낙폭 (MDD):</strong> 
      <span class="text-danger">${(maxDrawdown * 100).toFixed(2)}%</span>
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 변동성:</strong> ${(volatility * 100).toFixed(2)}%
    </div>
    <div class="mb-2">
      <strong>전체 교차 횟수:</strong> ${totalCrossovers}회
      <small class="text-muted">(2일 판매기한 제한 시: ${limitedCrossovers}회)</small>
    </div>
    <div class="mt-3 small text-muted">
      ${currentPeriod}년 데이터 기준 / 판매기한 2일 및 3%p 리밸런싱 적용됨
    </div>
  `;
  
  // 테이블에서 현재 전략에 해당하는 행 강조
  updatePortfolioTable();
}

// HTML 설명 업데이트
document.getElementById('strategyDescription').innerHTML = `
  <p>- TQQQ가 200일 이평선 <strong>위</strong>: <span id="aboveMA">TQQQ <span id="aboveRatio">70</span>% / 다른 자산 <span id="aboveComplementRatio">30</span>%</span></p>
  <p>- TQQQ가 200일 이평선 <strong>아래</strong>: <span id="belowMA">TQQQ <span id="belowRatio">30</span>% / 다른 자산 <span id="belowComplementRatio">70</span>%</span></p>
  <p class="text-info">- 교차 빈도: 최소 2일(판매기한) 간격으로 제한됨</p>
  <p class="text-info">- 리밸런싱: 자산 비율이 목표치에서 3%p 이상 차이날 때 수행</p>
`;
