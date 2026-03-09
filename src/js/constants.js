export const PROC_ORDER = ['탈지', '소성', '환원소성', '평탄화', '도금', '열처리'];

export const PROC_COLORS = {
  '탈지': '#06b6d4',
  '소성': '#f97316',
  '환원소성': '#a855f7',
  '평탄화': '#10b981',
  '도금': '#eab308',
  '열처리': '#ef4444'
};

export const EQ_MAP = {
  '탈지': ['1호기', '2호기', '3호기'],
  '소성': ['1호기', '4호기', '5호기', '10호기', '11호기', '12호기', '13호기', '14호기', '15호기', '16호기', '17호기', '18호기'],
  '환원소성': ['2호기'],
  '평탄화': ['3호기', '6호기', '7호기', '8호기', '9호기'],
  '도금': ['외주'],
  '열처리': ['GB']
};

export const DEFAULT_WIDGETS = [
  { id: 'kpi', name: 'KPI 요약', enabled: true },
  { id: 'pipeline', name: '공정 파이프라인', enabled: true },
  { id: 'today', name: '오늘의 작업', enabled: true },
  { id: 'alerts', name: '알림/지연', enabled: true },
  { id: 'chart_donut', name: '상태 분포 차트', enabled: true },
  { id: 'chart_weekly', name: '주간 트렌드', enabled: true },
  { id: 'recent', name: '최근 활동', enabled: true }
];