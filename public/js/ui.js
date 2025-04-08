/**
 * 포트폴리오 분석 UI 모듈
 * 사용자 인터페이스 요소 관리 및 이벤트 처리를 담당
 * @module ui
 */

// utils.js에서 필요한 함수 import
import { normalizeData, calculatePortfolioPerformance, isAboveMA, calculateMAStrategyPerformance, calculateFixedRatioStats } from './utils.js';

/**
 * 이벤트 리스너 설정 함수
 * 모든 UI 컨트롤의 이벤트 리스너를 초기화하고 등록
 * 
 * @param {Object} state - 애플리케이션 상태 객체
 * @param {Object} callbacks - 콜백 함수 모음
 * @param {Function} callbacks.updateAllCharts - 모든 차트 업데이트 함수
 * @param {Function} callbacks.updatePerformanceChart - 성과 차트 업데이트 함수
 * @param {Function} callbacks.updateSelectedPortfolioStats - 선택된 포트폴리오 통계 업데이트 함수
 * @param {Function} callbacks.updateAssetLabels - 자산 라벨 업데이트 함수
 * @param {Function} callbacks.fetchAnalysis - 데이터 가져오기 함수
 * @param {Function} callbacks.updateStrategyStats - 전략 통계 업데이트 함수
 */
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

/**
 * HTML 요소에서 자산 이름 업데이트 함수
 * 선택된 자산 코드를 UI의 여러 부분에 표시
 * 
 * @param {string} currentAsset - 현재 선택된 자산 코드
 */
export function updateAssetLabels(currentAsset) {
  document.getElementById('asset1Label').textContent = currentAsset.toUpperCase();
  document.getElementById('asset2Label').textContent = currentAsset.toUpperCase();
  document.getElementById('asset3Label').textContent = currentAsset.toUpperCase();
}

/**
 * 현재 이동평균선 위치 상태 표시 업데이트 함수
 * TQQQ가 현재 200일 이동평균선 위/아래 상태인지 UI에 표시
 * 
 * @param {Object} maData - 이동평균선 데이터
 */
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

/**
 * 포트폴리오 테이블 업데이트 함수
 * 다양한 비율의 포트폴리오 성과를 테이블 형태로 표시
 * 
 * @param {Array<Object>} portfolioData - 포트폴리오 분석 결과 데이터
 * @param {number} currentPeriod - 현재 선택된 분석 기간 (년)
 * @param {boolean} useMAStrategy - 이동평균선 전략 사용 여부
 * @param {boolean} isAboveMA - 현재 TQQQ가 이평선 위에 있는지 여부
 * @param {number} tqqqAssetRatio - 선택된 TQQQ 비중 (%)
 * @param {number} aboveMAPercent - 이평선 위일 때 TQQQ 비중 (%)
 * @param {number} belowMAPercent - 이평선 아래일 때 TQQQ 비중 (%)
 */
export function updatePortfolioTable(portfolioData, currentPeriod, useMAStrategy, isAboveMA, tqqqAssetRatio, aboveMAPercent, belowMAPercent) {
  const tableBody = document.getElementById('portfolioTable');
  tableBody.innerHTML = '';
  
  const periodKey = `${currentPeriod}year`;
  // const filteredData = portfolioData.filter(item => item[periodKey]); // 필터링 제거
  
  // portfolioData가 null이거나 배열이 아닌 경우 처리
  if (!Array.isArray(portfolioData)) {
    console.error("portfolioData is not an array or is null");
    // 필요하다면 사용자에게 오류 메시지를 표시하는 로직 추가
    return;
  }

  portfolioData.forEach(item => {
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
    
    // 기간 데이터 존재 여부 확인
    const stats = item[periodKey];
    const annualReturnText = stats ? `${(stats.annualReturn * 100).toFixed(2)}%` : '-';
    const sharpeRatioText = stats ? stats.sharpeRatio.toFixed(2) : '-';
    const mddText = stats ? `${(stats.mdd * 100).toFixed(2)}%` : '-';

    row.innerHTML = `
      <td>${item.tqqqWeight}%</td>
      <td>${100 - item.tqqqWeight}%</td>
      <td>${annualReturnText}</td>
      <td>${sharpeRatioText}</td>
      <td>${mddText}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * 선택한 포트폴리오 통계 업데이트 함수
 * 현재 선택된 고정 비율 포트폴리오의 성과 통계를 계산하고 표시
 * 
 * @param {Object} rawData - 원시 주식 데이터
 * @param {number} currentPeriod - 현재 선택된 분석 기간 (년)
 * @param {string} currentAsset - 현재 선택된 자산 코드
 * @param {number} tqqqAssetRatio - 선택된 TQQQ 비중 (%)
 */
export function updateSelectedPortfolioStats(rawData, currentPeriod, currentAsset, tqqqAssetRatio) {
  const statsContainer = document.getElementById('selectedPortfolioStats');
  
  if (!rawData || !rawData.tqqq || !rawData[currentAsset]) {
    statsContainer.innerHTML = '<div class="alert alert-warning">통계 계산에 필요한 원본 데이터가 없습니다.</div>';
    return;
  }

  // 그래프와 동일한 데이터 준비 (기간 필터링 및 샘플링)
  const periodFilter = currentPeriod * 252; // 거래일 기준
  let tqqqData = rawData.tqqq.slice(-periodFilter);
  let assetData = rawData[currentAsset].slice(-periodFilter);

  // 날짜 매핑 생성
  const tqqqMap = {};
  const assetMap = {};
  tqqqData.forEach(item => tqqqMap[item.date] = item.close);
  assetData.forEach(item => assetMap[item.date] = item.close);

  // 공통 날짜 찾기
  const commonDates = Array.from(new Set([
    ...Object.keys(tqqqMap),
    ...Object.keys(assetMap)
  ])).sort();

  // 공통 날짜만 사용하도록 필터링
  const validDates = commonDates.filter(date => 
    tqqqMap[date] !== undefined && 
    assetMap[date] !== undefined
  );

  // 필터링된 날짜를 기준으로 새 데이터 배열 생성
  const filteredTqqq = validDates.map(date => ({ date, close: tqqqMap[date] }));
  const filteredAsset = validDates.map(date => ({ date, close: assetMap[date] }));

  // 5일 간격으로 데이터 샘플링
  const sampledTqqq = filteredTqqq.filter((_, index) => index % 5 === 0);
  const sampledAsset = filteredAsset.filter((_, index) => index % 5 === 0);

  if (sampledTqqq.length < 2 || sampledAsset.length < 2) { // 통계 계산을 위해 최소 2개 데이터 필요
    statsContainer.innerHTML = '<div class="alert alert-warning">선택한 기간의 샘플링 데이터가 통계 계산에 충분하지 않습니다.</div>';
    return;
  }

  // 새로 추가한 함수를 사용하여 통계 계산
  const stats = calculateFixedRatioStats(sampledTqqq, sampledAsset, tqqqAssetRatio);

  if (!stats) {
    statsContainer.innerHTML = '<div class="alert alert-warning">선택한 포트폴리오 통계를 계산할 수 없습니다.</div>';
    return;
  }
  
  // 통계 결과 UI 업데이트
  statsContainer.innerHTML = `
    <div class="mb-2">
      <strong>연평균 수익률:</strong> 
      <span class="${stats.annualReturn > 0 ? 'text-success' : 'text-danger'}">${(stats.annualReturn * 100).toFixed(2)}%</span>
    </div>
    <div class="mb-2">
      <strong>샤프 지수:</strong> ${stats.sharpeRatio.toFixed(2)}
    </div>
    <div class="mb-2">
      <strong>최대 낙폭 (MDD):</strong> 
      <span class="text-danger">${(stats.mdd * 100).toFixed(2)}%</span>
    </div>
    <div class="mb-2">
      <strong>변동성:</strong> ${(stats.volatility * 100).toFixed(2)}%
    </div>
    <div class="mt-3 small text-muted">
      ${currentPeriod}년 데이터 기준
    </div>
  `;
}

/**
 * 이동평균선 전략 통계 업데이트 함수
 * 200일 이동평균선 기반 동적 자산 배분 전략의 성과 통계를 계산하고 표시
 * 
 * @param {Array<Object>} portfolioData - 포트폴리오 분석 결과 데이터
 * @param {Object} rawData - 원시 주식 데이터
 * @param {Object} maData - 이동평균선 데이터
 * @param {number} currentPeriod - 현재 선택된 분석 기간 (년)
 * @param {string} currentAsset - 현재 선택된 자산 코드
 * @param {number} aboveMAPercent - 이평선 위일 때 TQQQ 비중 (%)
 * @param {number} belowMAPercent - 이평선 아래일 때 TQQQ 비중 (%)
 */
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
  
  // 그래프와 동일한 데이터 준비 (기간 필터링 및 샘플링)
  const periodFilter = currentPeriod * 252; // 거래일 기준
  let tqqqData = rawData.tqqq.slice(-periodFilter);
  let assetData = rawData[currentAsset].slice(-periodFilter);
  
  // 날짜 매핑 생성
  const tqqqMap = {};
  const assetMap = {};
  tqqqData.forEach(item => tqqqMap[item.date] = item.close);
  assetData.forEach(item => assetMap[item.date] = item.close);
  
  // 공통 날짜 찾기
  const commonDates = Array.from(new Set([
    ...Object.keys(tqqqMap),
    ...Object.keys(assetMap)
  ])).sort();
  
  // 공통 날짜만 사용하도록 필터링
  const validDates = commonDates.filter(date => 
    tqqqMap[date] !== undefined && 
    assetMap[date] !== undefined
  );
  
  // 필터링된 날짜를 기준으로 새 데이터 배열 생성
  const filteredTqqq = validDates.map(date => ({ date, close: tqqqMap[date] }));
  const filteredAsset = validDates.map(date => ({ date, close: assetMap[date] }));
  
  // 5일 간격으로 데이터 샘플링
  const sampledTqqq = filteredTqqq.filter((_, index) => index % 5 === 0);
  const sampledAsset = filteredAsset.filter((_, index) => index % 5 === 0);
  
  if (sampledTqqq.length < 2 || sampledAsset.length < 2) { // 통계 계산을 위해 최소 2개 데이터 필요
    statsContainer.innerHTML = '<div class="alert alert-warning">선택한 기간의 샘플링 데이터가 통계 계산에 충분하지 않습니다.</div>';
    return;
  }

  // utils.js의 함수를 사용하여 통계 계산
  const { stats } = calculateMAStrategyPerformance(sampledTqqq, sampledAsset, maData, aboveMAPercent, belowMAPercent);

  if (!stats) {
    statsContainer.innerHTML = '<div class="alert alert-warning">전략 통계를 계산할 수 없습니다.</div>';
    return;
  }

  // 통계 결과 UI 업데이트
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
      <span class="${stats.annualReturn > 0 ? 'text-success' : 'text-danger'}">
        ${(stats.annualReturn * 100).toFixed(2)}%
      </span>
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 샤프 지수:</strong> ${stats.sharpeRatio.toFixed(2)}
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 최대 낙폭 (MDD):</strong> 
      <span class="text-danger">${(stats.mdd * 100).toFixed(2)}%</span>
    </div>
    <div class="mb-2">
      <strong>전략 성과 - 변동성:</strong> ${(stats.volatility * 100).toFixed(2)}%
    </div>
    <div class="mb-2">
      <strong>전체 교차 횟수:</strong> ${stats.totalCrossovers}회
      <small class="text-muted">(2일 판매기한 제한 시: ${stats.limitedCrossovers}회)</small>
    </div>
    <div class="mt-3 small text-muted">
      ${currentPeriod}년 데이터 기준 / 판매기한 2일 및 3%p 리밸런싱 적용됨
    </div>
  `;
} 