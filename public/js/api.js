/**
 * API 통신 모듈
 * 서버 API와의 통신을 담당하는 함수들 제공
 * @module api
 */

/**
 * 포트폴리오 분석 데이터 가져오기
 * 선택한 자산 유형에 따른 TQQQ와의 포트폴리오 분석 결과를 가져옴
 * 
 * @async
 * @param {string} assetType - 분석할 자산 유형 (예: 'gld', 'tlt')
 * @returns {Promise<Object>} 포트폴리오 분석 결과 객체
 * @throws {Error} API 요청 실패 시 에러 발생
 */
export async function fetchAnalysis(assetType) {
  try {
    const response = await fetch(`/api/analyze?asset=${assetType}`);
    if (!response.ok) {
      throw new Error('API 응답 오류: ' + response.status);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching analysis data:', error);
    throw error;
  }
}

/**
 * 현금(무위험 자산) 데이터 생성 함수
 * 실제 API 호출 없이 연 2% 수익률로 현금 자산의 가치 변화 데이터 생성
 * 
 * @returns {Array<Object>} 현금 자산 가치 데이터 배열 (날짜별 가격 정보)
 */
export function generateCashData() {
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