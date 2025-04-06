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
let assetFullNames = {
  'gld': 'GLD (금)',
  'shy': 'SHY (단기 국채)',
  'tlt': 'TLT (장기 국채)',
  'schd': 'SCHD (배당주)',
  'vnq': 'VNQ (부동산)'
};
let assetColors = {
  'gld': 'rgba(255, 215, 0, 1)', // 금색
  'shy': 'rgba(0, 128, 0, 1)',   // 녹색
  'tlt': 'rgba(0, 0, 128, 1)',   // 남색
  'schd': 'rgba(128, 0, 128, 1)', // 보라색
  'vnq': 'rgba(165, 42, 42, 1)'  // 갈색
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
    const response = await fetch(`/api/analyze?asset=${currentAsset}`);
    const data = await response.json();
    
    portfolioData = data.portfolios;
    rawData = data.rawData;
    maData = data.maData;
    
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
  
  // 각 날짜에 대해 전략 적용 및 성과 계산
  for (let i = 1; i < maWithPrices.length; i++) {
    const currentData = maWithPrices[i];
    const currentDate = currentData.date;
    const currentAboveMA = currentData.aboveMA;
    
    // 현재 가격
    const currentTQQQPrice = tqqqMap[currentDate];
    const currentAssetPrice = assetMap[currentDate];
    
    // 현재 포트폴리오 가치
    let portfolioValue = (tqqqShares * currentTQQQPrice) + (assetShares * currentAssetPrice);
    
    // 이평선 교차 확인 및 리밸런싱
    if (currentAboveMA !== lastAboveMA) {
      // 현재 날짜를 Date 객체로 변환
      const currDate = new Date(currentDate);
      
      // 마지막 교차 이후 경과일 계산
      const daysSinceLastCross = Math.floor((currDate - lastCrossoverDate) / (1000 * 60 * 60 * 24));
      
      // 최소 7일(1주일) 이상 경과한 경우에만 교차 처리
      if (daysSinceLastCross >= 7) {
        // 비율 변경
        const newTQQQRatio = currentAboveMA ? aboveMAPercent / 100 : belowMAPercent / 100;
        const newAssetRatio = 1 - newTQQQRatio;
        
        // 새로운 지분 계산
        tqqqShares = (portfolioValue * newTQQQRatio) / currentTQQQPrice;
        assetShares = (portfolioValue * newAssetRatio) / currentAssetPrice;
        
        // 상태 업데이트
        lastAboveMA = currentAboveMA;
        lastCrossoverDate = currDate; // 마지막 교차 날짜 업데이트
      }
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
  
  // 전략 교차점 횟수
  const totalCrossovers = maData.crossovers.length;
  
  // 주 1회 제한 적용 후 예상 교차 횟수 (대략적인 계산)
  let weeklyLimitedCrossovers = 0;
  let lastCrossDate = null;
  
  maData.crossovers.forEach(cross => {
    const crossDate = new Date(cross.date);
    if (!lastCrossDate || (crossDate - lastCrossDate) >= (7 * 24 * 60 * 60 * 1000)) {
      weeklyLimitedCrossovers++;
      lastCrossDate = crossDate;
    }
  });
  
  // 전략 성능 계산 (1, 3, 5, 10년)
  const periodKey = `${currentPeriod}year`;
  
  // TQQQ가 이평선 위일 때의 포트폴리오 성과
  const abovePortfolio = portfolioData.find(item => item.tqqqWeight === aboveMAPercent);
  // TQQQ가 이평선 아래일 때의 포트폴리오 성과
  const belowPortfolio = portfolioData.find(item => item.tqqqWeight === belowMAPercent);
  
  // 현재 비율에 맞는 포트폴리오 성과
  const currentPortfolio = currentAboveMA ? abovePortfolio : belowPortfolio;
  
  if (!currentPortfolio || !currentPortfolio[periodKey] || 
      !abovePortfolio || !abovePortfolio[periodKey] || 
      !belowPortfolio || !belowPortfolio[periodKey]) {
    statsContainer.innerHTML = '<div class="alert alert-warning">선택한 비율에 대한 데이터가 없습니다.</div>';
    return;
  }
  
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
      <strong>연평균 수익률:</strong> 
      <span class="${currentPortfolio[periodKey].annualReturn > 0 ? 'text-success' : 'text-danger'}">
        ${(currentPortfolio[periodKey].annualReturn * 100).toFixed(2)}%
      </span>
    </div>
    <div class="mb-2">
      <strong>샤프 지수:</strong> ${currentPortfolio[periodKey].sharpeRatio.toFixed(2)}
    </div>
    <div class="mb-2">
      <strong>최대 낙폭 (MDD):</strong> 
      <span class="text-danger">${(currentPortfolio[periodKey].mdd * 100).toFixed(2)}%</span>
    </div>
    <div class="mb-2">
      <strong>변동성:</strong> ${(currentPortfolio[periodKey].volatility * 100).toFixed(2)}%
    </div>
    <div class="mb-2">
      <strong>전체 교차 횟수:</strong> ${totalCrossovers}회
      <small class="text-muted">(주 1회 제한 시: 약 ${weeklyLimitedCrossovers}회)</small>
    </div>
    <div class="mt-3 small text-muted">
      ${currentPeriod}년 데이터 기준 / 주 1회 교차 제한 적용됨
    </div>
  `;
  
  // 테이블에서 현재 전략에 해당하는 행 강조
  updatePortfolioTable();
}
