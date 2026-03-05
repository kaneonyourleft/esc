export const PROC_ORDER=['탈지','소성','환원소성','평탄화','도금','열처리'];
export const PROC_COLORS={'탈지':'#3b82f6','소성':'#f59e0b','환원소성':'#a855f7','평탄화':'#10b981','도금':'#06b6d4','열처리':'#ec4899'};
export const EQ_MAP={
'탈지':{'BL':['1호기','2호기','3호기'],'WN':['1호기','2호기','3호기'],'HP':['1호기','2호기','3호기']},
'소성':{'BL':['1호기','4호기'],'WN':['5호기','10호기','11호기','12호기','13호기','14호기','15호기','16호기','17호기','18호기'],'HP':['5호기','10호기','11호기','12호기','13호기','14호기','15호기','16호기','17호기','18호기']},
'환원소성':{'BL':['2호기'],'WN':[],'HP':[]},
'평탄화':{'BL':['3호기'],'WN':['6호기','7호기','8호기','9호기'],'HP':['6호기','7호기','8호기','9호기']},
'도금':{'BL':['외주'],'WN':['외주'],'HP':['외주']},
'열처리':{'BL':['GB'],'WN':['GB'],'HP':['GB']}
};
export const DEFAULT_WIDGETS=[
{id:'todayTask',label:'📌 오늘 할 일',enabled:true,order:1},
{id:'preventAlert',label:'🔔 예방적 알림',enabled:true,order:2},
{id:'kpiGrid',label:'📊 KPI 카드',enabled:true,order:3},
{id:'pipeline',label:'🔄 라이브 파이프라인',enabled:true,order:4},
{id:'kanban',label:'🎯 드래그 보드',enabled:false,order:5},
{id:'equipStatus',label:'🏭 설비 현황',enabled:false,order:6},
{id:'charts',label:'📈 상태분포/주간완료 차트',enabled:true,order:7},
{id:'recentActivity',label:'🕐 최근 활동',enabled:true,order:8}
];
