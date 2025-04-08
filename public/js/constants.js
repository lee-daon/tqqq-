/**
 * 포트폴리오 분석 애플리케이션 상수 모듈
 * 전역에서 사용되는 상수 값들을 정의
 * @module constants
 */

/**
 * 자산별 전체 이름 표시
 * UI에서 자산 선택 시 표시되는 전체 이름 매핑
 * @constant {Object}
 */
export const assetFullNames = {
  'gld': 'GLD (금)',
  'shy': 'SHY (단기 국채)',
  'tlt': 'TLT (장기 국채)',
  'schd': 'SCHD (배당주)',
  'vnq': 'VNQ (부동산)',
  'sqqq': 'SQQQ (인버스 QQQ 3X)',
  'qid': 'QID (인버스 QQQ 2X)',
  'cash': '현금 (무위험)'
};

/**
 * 자산별 차트 색상
 * 차트 및 UI 요소에서 자산을 구분하기 위한 색상 매핑
 * @constant {Object}
 */
export const assetColors = {
  'gld': 'rgba(255, 215, 0, 1)', // 금색
  'shy': 'rgba(0, 128, 0, 1)',   // 녹색
  'tlt': 'rgba(0, 0, 128, 1)',   // 남색
  'schd': 'rgba(128, 0, 128, 1)', // 보라색
  'vnq': 'rgba(165, 42, 42, 1)', // 갈색
  'sqqq': 'rgba(255, 0, 0, 1)',  // 빨간색
  'qid': 'rgba(255, 69, 0, 1)',  // 토마토색
  'cash': 'rgba(128, 128, 128, 1)' // 회색
}; 