/**
 * 포트폴리오 분석 차트 모듈
 * Chart.js를 사용한 다양한 포트폴리오 분석 차트 생성 및 관리
 * @module charts
 */

// utils.js에서 필요한 함수 import
import { normalizeData, calculatePortfolioPerformance, calculateMAStrategyPerformance } from './utils.js';
import { assetColors } from './constants.js';

/**
 * 차트 인스턴스 저장 변수
 * @type {Chart|null} - Chart.js 인스턴스
 */
let efficientFrontierChart = null;
let performanceChart = null;
let maChart = null;

/**
 * 효율적 투자선 차트 업데이트 함수
 * TQQQ와 선택한 자산의 다양한 비율에 따른 위험-수익 분포를 보여주는 차트
 * 
 * @param {Array<Object>} portfolioData - 포트폴리오 분석 결과 데이터
 * @param {Object} rawData - 원시 주식 데이터
 * @param {number} currentPeriod - 현재 선택된 분석 기간 (년)
 * @param {string} currentAsset - 현재 선택된 자산 코드
 * @param {Object} assetColors - 자산별 색상 매핑 객체
 */
export function updateEfficientFrontierTQQQ_Asset(portfolioData, rawData, currentPeriod, currentAsset, assetColors) {
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
  if (efficientFrontierChart) {
    efficientFrontierChart.destroy();
  }
  
  efficientFrontierChart = new Chart(ctx, {
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

/**
 * 포트폴리오 성과 차트 업데이트 함수
 * 시간에 따른 다양한 자산 및 포트폴리오 성과를 비교하는 라인 차트
 * 
 * @param {Object} rawData - 원시 주식 데이터
 * @param {Object} maData - 이동평균선 데이터 
 * @param {number} currentPeriod - 현재 선택된 분석 기간 (년)
 * @param {string} currentAsset - 현재 선택된 자산 코드
 * @param {number} tqqqAssetRatio - TQQQ 비중 (%)
 * @param {boolean} useMAStrategy - 이동평균선 전략 사용 여부
 * @param {number} aboveMAPercent - 이평선 위일 때 TQQQ 비중 (%)
 * @param {number} belowMAPercent - 이평선 아래일 때 TQQQ 비중 (%)
 */
export function updatePerformanceChart(rawData, maData, currentPeriod, currentAsset, tqqqAssetRatio, useMAStrategy, aboveMAPercent, belowMAPercent) {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  
  // 데이터 필터링 (선택한 기간)
  const periodFilter = currentPeriod * 252; // 거래일 기준
  let tqqqData = rawData.tqqq.slice(-periodFilter);
  let assetData = rawData[currentAsset].slice(-periodFilter);
  let qqqData = rawData.qqq.slice(-periodFilter);
  
  // 데이터 필터링 및 동일한 날짜 사용을 위한 전처리
  let commonDates = new Set();
  
  // 첫 번째 단계: 모든 자산의 날짜 집합 생성
  tqqqData.forEach(item => commonDates.add(item.date));
  assetData.forEach(item => commonDates.add(item.date));
  qqqData.forEach(item => commonDates.add(item.date));
  
  // 두 번째 단계: 공통 날짜만 사용하도록 필터링
  commonDates = Array.from(commonDates).sort();
  
  // 날짜로 인덱싱된 맵 생성
  const tqqqMap = {};
  const assetMap = {};
  const qqqMap = {};
  
  tqqqData.forEach(item => tqqqMap[item.date] = item.close);
  assetData.forEach(item => assetMap[item.date] = item.close);
  qqqData.forEach(item => qqqMap[item.date] = item.close);
  
  // 실제 공통 날짜만 필터링 (모든 자산에 데이터가 있는 날짜)
  const validDates = commonDates.filter(date => 
    tqqqMap[date] !== undefined && 
    assetMap[date] !== undefined && 
    qqqMap[date] !== undefined
  );
  
  // 필터링된 날짜를 기준으로 새 데이터 배열 생성
  const filteredTqqq = validDates.map(date => ({ date, close: tqqqMap[date] }));
  const filteredAsset = validDates.map(date => ({ date, close: assetMap[date] }));
  const filteredQqq = validDates.map(date => ({ date, close: qqqMap[date] }));
  
  // 5일 간격으로 데이터 필터링 (성능 향상)
  const sampledTqqq = filteredTqqq.filter((_, index) => index % 5 === 0);
  const sampledAsset = filteredAsset.filter((_, index) => index % 5 === 0);
  const sampledQqq = filteredQqq.filter((_, index) => index % 5 === 0);
  
  // 초기값으로 정규화
  const tqqqNormalized = normalizeData(sampledTqqq);
  const assetNormalized = normalizeData(sampledAsset);
  const qqqNormalized = normalizeData(sampledQqq);
  
  // 고정 비율 포트폴리오 계산 (원본 데이터 전달)
  const fixedPortfolioNormalized = calculatePortfolioPerformance(
      tqqqNormalized, 
      assetNormalized, 
      tqqqAssetRatio,
      sampledTqqq, 
      sampledAsset
  );
  
  const fixedPortfolioLabel = `고정비율 (TQQQ ${tqqqAssetRatio}%, ${currentAsset.toUpperCase()} ${100-tqqqAssetRatio}%)`;
  
  // 날짜 레이블 생성 (x축)
  const labels = sampledTqqq.map(d => d.date);
  
  // 차트 데이터셋 - 기본 자산들
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
      label: fixedPortfolioLabel,
      data: fixedPortfolioNormalized,
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      fill: false,
      tension: 0.1
    }
  ];
  
  // 이평선 전략이 활성화되었을 때 전략 포트폴리오 추가
  if (useMAStrategy) {
    const { performanceData: strategyPortfolioNormalized } = calculateMAStrategyPerformance(sampledTqqq, sampledAsset, maData, aboveMAPercent, belowMAPercent);
    const strategyPortfolioLabel = `이평선 전략 (위:${aboveMAPercent}% 아래:${belowMAPercent}%)`;
    
    datasets.push({
      label: strategyPortfolioLabel,
      data: strategyPortfolioNormalized,
      borderColor: 'rgba(75, 192, 192, 1)', // 청록색
      borderWidth: 2,
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: false,
      tension: 0.1,
      borderDash: [5, 5] // 점선으로 표시
    });
  }
  
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

/**
 * 이동평균선 차트 업데이트 함수
 * TQQQ의 가격과 200일 이동평균선을 보여주는 차트
 * 
 * @param {Object} maData - 이동평균선 데이터
 * @param {number} currentPeriod - 현재 선택된 분석 기간 (년)
 */
export function updateMAChart(maData, currentPeriod) {
  const ctx = document.getElementById('maChart').getContext('2d');
  
  if (!maData || !maData.values || maData.values.length === 0) {
    if (maChart) {
      maChart.destroy();
      maChart = null;
    }
    return;
  }
  
  // 선택된 기간의 실제 시작 날짜 계산
  const fullPeriodData = maData.values;
  const endDate = new Date(fullPeriodData[fullPeriodData.length - 1].date);
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - currentPeriod);
  const startTime = startDate.getTime();

  // 데이터 필터링 (선택한 기간)
  let periodFilteredValues = fullPeriodData.filter(d => new Date(d.date).getTime() >= startTime);
  
  // 5일 간격으로 데이터 샘플링
  const sampledValues = periodFilteredValues.filter((_, index) => index % 5 === 0);
  
  // 샘플링된 데이터가 없으면 중단
  if (sampledValues.length === 0) {
      if (maChart) { maChart.destroy(); maChart = null; }
      return;
  }

  // 날짜 레이블 (샘플링된 데이터 기준)
  const labels = sampledValues.map(d => d.date);
  
  // 가격 데이터 (샘플링된 데이터 기준)
  const prices = sampledValues.map(d => d.price);
  
  // 이동평균선 데이터 (샘플링된 데이터 기준)
  const mas = sampledValues.map(d => d.ma);
  
  // 교차점 데이터 필터링 (선택된 기간 전체 기준)
  const crossovers = maData.crossovers.filter(c => {
    const dateTime = new Date(c.date).getTime();
    const periodEndTime = new Date(sampledValues[sampledValues.length - 1].date).getTime(); // 샘플링된 마지막 날짜
    // 실제 기간 시작 시간과 샘플링된 마지막 시간 사이의 교차점만 필터링
    return dateTime >= startTime && dateTime <= periodEndTime; 
  });
  
  // 이평선 위/아래 상태를 분류하는 데이터 (샘플링 기준)
  const abovePoints = [];
  const belowPoints = [];
  for (let i = 0; i < sampledValues.length; i++) {
    const point = { x: i, y: sampledValues[i].price };
    if (sampledValues[i].aboveMA) {
      abovePoints.push(point);
      belowPoints.push(null);
    } else {
      abovePoints.push(null);
      belowPoints.push(point);
    }
  }
  
  // 교차점에 대한 참조선 생성 (가장 가까운 샘플링 날짜 매핑)
  const annotations = crossovers.map((c) => {
    const crossTime = new Date(c.date).getTime();
    let closestIndex = -1;
    let minDiff = Infinity;

    // 샘플링된 레이블 중 가장 가까운 날짜 찾기
    labels.forEach((labelDate, index) => {
        const labelTime = new Date(labelDate).getTime();
        const diff = Math.abs(crossTime - labelTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = index;
        }
    });

    if (closestIndex === -1) return null; // 가까운 날짜 못 찾으면 주석 생성 안함

    return {
      type: 'line',
      xMin: closestIndex,
      xMax: closestIndex,
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
  }).filter(annotation => annotation !== null); // null인 주석 제거

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
          annotations: annotations // 수정된 주석 배열 사용
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
} 