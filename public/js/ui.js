// utils.js에서 필요한 함수 import
import { normalizeData, calculatePortfolioPerformance, isAboveMA, calculateMAStrategyPerformance } from './utils.js';

// UI 관련 함수들

// 이벤트 리스너 설정
export function setupEventListeners(state, callbacks) {
  // 기간 선택 버튼
  const periodButtons = document.querySelectorAll('#period-selector button');
  periodButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      periodButtons.forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.currentPeriod = parseInt(e.target.dataset.period);
      callbacks.updateAllCharts();
    });
  });
  
  // TQQQ/자산 비율 슬라이더
  const tqqqAssetSlider = document.getElementById('tqqqAssetSlider');
  tqqqAssetSlider.addEventListener('input', (e) => {
    state.tqqqAssetRatio = parseInt(e.target.value);
    document.getElementById('tqqqAssetValue').textContent = state.tqqqAssetRatio;
    callbacks.updatePerformanceChart();
    callbacks.updateSelectedPortfolioStats();
  });

  // 자산 변경 버튼
  const changeAssetBtn = document.getElementById('changeAssetBtn');
  changeAssetBtn.addEventListener('click', async () => {
    const assetSelector = document.getElementById('assetSelector');
    const newAsset = assetSelector.value.toLowerCase();
    
    if (newAsset !== state.currentAsset) {
      state.currentAsset = newAsset;
      
      // UI 업데이트
      callbacks.updateAssetLabels();
      
      // 데이터 다시 로드
      await callbacks.fetchAnalysis();
    }
  });

  // 200일 이평선 전략 토글
  const autoStrategyToggle = document.getElementById('autoStrategyToggle');
  autoStrategyToggle.addEventListener('change', function() {
    state.useMAStrategy = this.checked;
    
    // 관련 UI 요소 표시/숨김
    document.getElementById('strategyDescription').classList.toggle('d-none', !state.useMAStrategy);
    document.getElementById('strategySettings').classList.toggle('d-none', !state.useMAStrategy);
    document.getElementById('strategyStatsCard').classList.toggle('d-none', !state.useMAStrategy);
    
    if (state.useMAStrategy) {
      callbacks.updateStrategyStats();
    } else {
      callbacks.updatePerformanceChart();
    }
  });

  // 이평선 위/아래 전략 설정 슬라이더
  const aboveRatioSlider = document.getElementById('aboveRatioSlider');
  aboveRatioSlider.addEventListener('input', (e) => {
    state.aboveMAPercent = parseInt(e.target.value);
    document.getElementById('aboveRatioValue').textContent = state.aboveMAPercent;
    document.getElementById('aboveRatio').textContent = state.aboveMAPercent;
    document.getElementById('aboveComplementRatio').textContent = 100 - state.aboveMAPercent;
    
    if (state.useMAStrategy) {
      callbacks.updateStrategyStats();
      callbacks.updatePerformanceChart();
    }
  });

  const belowRatioSlider = document.getElementById('belowRatioSlider');
  belowRatioSlider.addEventListener('input', (e) => {
    state.belowMAPercent = parseInt(e.target.value);
    document.getElementById('belowRatioValue').textContent = state.belowMAPercent;
    document.getElementById('belowRatio').textContent = state.belowMAPercent;
    document.getElementById('belowComplementRatio').textContent = 100 - state.belowMAPercent;
    
    if (state.useMAStrategy) {
      callbacks.updateStrategyStats();
      callbacks.updatePerformanceChart();
    }
  });
}

// HTML 요소에서 자산 이름 업데이트
export function updateAssetLabels(currentAsset) {
  document.getElementById('asset1Label').textContent = currentAsset.toUpperCase();
  document.getElementById('asset2Label').textContent = currentAsset.toUpperCase();
  document.getElementById('asset3Label').textContent = currentAsset.toUpperCase();
}

// 현재 이평선 위치 상태 표시 업데이트
export function updateMACurrentStatus(maData) {
  const statusContainer = document.getElementById('maCurrentStatus');
  if (!maData || !maData.values || maData.values.length === 0) {
    statusContainer.innerHTML = '<div class="alert alert-warning">이평선 데이터를 불러올 수 없습니다.</div>';
    return;
  }
  
  const currentAboveMA = isAboveMA(maData);
  const statusClass = currentAboveMA ? 'success' : 'danger';
  const statusText = currentAboveMA ? '위' : '아래';
  
  statusContainer.innerHTML = `
    <div class="alert alert-${statusClass} d-inline-block">
      <strong>현재 TQQQ는 200일 이평선 <span class="text-${statusClass}">${statusText}</span>에 있습니다.</strong>
    </div>
  `;
}

// 포트폴리오 테이블 업데이트
export function updatePortfolioTable(portfolioData, currentPeriod, useMAStrategy, isAboveMA, tqqqAssetRatio, aboveMAPercent, belowMAPercent) {
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
      if (isAboveMA && item.tqqqWeight === aboveMAPercent) {
        rowHighlight = true;
      } else if (!isAboveMA && item.tqqqWeight === belowMAPercent) {
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

// 선택한 포트폴리오 통계 업데이트
export function updateSelectedPortfolioStats(portfolioData, currentPeriod, tqqqAssetRatio) {
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

// 200일 이평선 전략 통계 업데이트
export function updateStrategyStats(portfolioData, rawData, maData, currentPeriod, currentAsset, aboveMAPercent, belowMAPercent) {
  const statsContainer = document.getElementById('strategyStats');
  
  if (!maData || !maData.values || maData.values.length === 0) {
    statsContainer.innerHTML = '<div class="alert alert-warning">데이터를 불러올 수 없습니다.</div>';
    return;
  }
  
  // 현재 TQQQ 상태 (이평선 위/아래)
  const currentAboveMA = isAboveMA(maData);
  const currentTQQQRatio = currentAboveMA ? aboveMAPercent : belowMAPercent;
  const currentAssetRatio = 100 - currentTQQQRatio;
  
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
  const strategyPerformance = calculateMAStrategyPerformance(periodTqqq, periodAsset, maData, aboveMAPercent, belowMAPercent);
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
} 