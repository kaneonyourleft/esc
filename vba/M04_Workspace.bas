Attribute VB_Name = "M04_Workspace"
'================================================================
' M04_Workspace ? ESC Production Management System v12.1
' 아코디언, 필터, 모드, 편집UI, Gantt, 크로스 하이라이트
' ★ v12.0 기능 유지 + v11 디자인 (색채우기 최소, 선/테두리 활용)
'================================================================
Option Explicit

' ── Unicode 문자
Private CHECK_ON        As String
Private CHECK_OFF       As String
Private TOGGLE_EXPAND   As String
Private TOGGLE_COLLAPSE As String
Private SPIN_UP_CHAR    As String
Private SPIN_DN_CHAR    As String
Private m_CharsInitialized As Boolean

' ── 딕셔너리
Private dictToggle As Object
Private dictCheck  As Object

' ── 일괄 반영 플래그
Private m_BulkUpdating As Boolean

' ── 공정 순서
Private Const PROC_ORDER As String = "탈지,소성,환원소성,평탄화,도금,열처리"

' ── 간트 스크롤 일수
Private Const GANTT_SCROLL_DAYS As Long = 7







' ============================================================
'  InitWSChars
' ============================================================
Private Sub InitWSChars()
    If m_CharsInitialized Then Exit Sub
    CHECK_ON = ChrW(&H2611)
    CHECK_OFF = ChrW(&H2610)
    TOGGLE_EXPAND = ChrW(&H25B6)
    TOGGLE_COLLAPSE = ChrW(&H25BC)
    SPIN_UP_CHAR = ChrW(&H25B2)
    SPIN_DN_CHAR = ChrW(&H25BC)
    m_CharsInitialized = True
End Sub

' ============================================================
'  RefreshWorkSpace
' ============================================================
Public Sub RefreshWorkSpace()
    InitWSChars
    g_CurrentMode = MODE_NONE
    Set dictToggle = Nothing
    Set dictCheck = Nothing

    Dim ws As Worksheet
    Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)

    SetupFilterRow ws
    BuildAccordion
End Sub

' ============================================================
 Private Sub SetupFilterRow(ws As Worksheet)
    On Error Resume Next
    Dim c As Long

    ' ★ 라벨행 (WS_ROW_FILT_LABEL)
    Dim labels As Variant
    labels = Array("뷰", "제품", "배치", "S/N", "공정", "호기", "상태")
    For c = 0 To UBound(labels)
        With ws.Cells(WS_ROW_FILT_LABEL, FLT_COL_VIEW + c)
            .Value = labels(c)
            .Font.Size = 7: .Font.Bold = True
            .Font.Color = CLR_TEXT_DIM
            .HorizontalAlignment = xlCenter
            .Interior.Color = CLR_BG_DARK
        End With
    Next c

    ' ★ 뷰모드
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value = "전체"
    End If
    ' 드롭다운 제거, 자유입력 허용
    On Error Resume Next
    ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Validation.Delete
    On Error GoTo 0
    
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_VIEW), VIEW_BATCH & "," & VIEW_PROCESS

    ' ★ 공정
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PROC).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_PROC).Value = "전체"
    End If
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_PROC), _
        "전체," & PROC_DEGREASING & "," & PROC_SINTERING & "," & PROC_REDUCTION & _
        "," & PROC_FLATTENING & "," & PROC_PLATING & "," & PROC_HEATTREAT

    ' ★ 상태
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_STATUS).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_STATUS).Value = "전체"
    End If
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_STATUS), _
        "전체," & ST_WAIT & "," & ST_PROG & "," & ST_DONE & "," & ST_DELAY

    ' ★ 제품명
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value = "전체"
    End If
    BuildProductFilterList ws

    ' ★ 배치
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value = "전체"
    End If
    BuildBatchFilterList ws, SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value)

    ' ★ S/N
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value = "전체"
    End If
    BuildSNFilterList ws, SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value), _
                          SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value)

    ' ★ 호기(설비)
    If SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_EQUIP).Value) = "" Then
        ws.Cells(WS_ROW_FILTER, FLT_COL_EQUIP).Value = "전체"
    End If
    BuildEquipFilterList ws

    ' ★ 필터행 스타일
    For c = FLT_COL_VIEW To FLT_COL_STATUS
        With ws.Cells(WS_ROW_FILTER, c)
            .Font.Size = 9: .Font.Bold = True
            .Font.Color = CLR_TEXT_MID
            .HorizontalAlignment = xlCenter
            .Interior.Color = CLR_BG_DARK
            With .Borders(xlEdgeBottom)
                .lineStyle = xlContinuous: .Color = CLR_TEXT_DIM: .Weight = xlHairline
            End With
        End With
    Next c

    ' 간트 기준일
    If Not IsDate(ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value) Then
        ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value = Date
    End If
    On Error GoTo 0
End Sub

' ============================================================
'  BuildAccordion
' ============================================================
Public Sub BuildAccordion()
    On Error GoTo ErrH
    InitWSChars

    Dim ws     As Worksheet
    Dim wsProd As Worksheet
    Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    g_EventsDisabled = True

    CheckDelayStatus
    BuildProcCache          ' ★ 이 한 줄 추가

    If dictToggle Is Nothing Then Set dictToggle = CreateObject("Scripting.Dictionary")
    If dictCheck Is Nothing Then Set dictCheck = CreateObject("Scripting.Dictionary")

    Dim oldLast As Long
    oldLast = GetLastRow(ws, WS_COL_MAIN)
    If oldLast < WS_DATA_START Then oldLast = WS_DATA_START
    ws.Range(ws.Cells(WS_DATA_START, WS_COL_CHK), _
             ws.Cells(oldLast + 5, GNT_END_COL)).Clear
    ws.Range(ws.Cells(WS_DATA_START, WS_COL_CHK), _
             ws.Cells(oldLast + 5, GNT_END_COL)).Interior.Color = CLR_BG_DARK
    ws.Range(ws.Cells(WS_DATA_START, META_TYPE), _
             ws.Cells(oldLast + 5, META_CROSS_C)).ClearContents
    ws.Cells(1, META_CROSS_R).ClearContents
    ws.Cells(1, META_CROSS_C).ClearContents

    ' 필터 읽기
    Dim viewMode      As String
    Dim filterProc    As String
    Dim filterStatus  As String
    Dim filterProduct As String
    Dim filterBatch   As String
    Dim filterSN      As String
    Dim filterEquip   As String

    viewMode = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_VIEW).Value)
    If viewMode = "" Then viewMode = VIEW_BATCH
    filterProc = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PROC).Value)
    filterStatus = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_STATUS).Value)
    filterProduct = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value)
    filterBatch = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value)
    filterSN = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value)
    filterEquip = SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_EQUIP).Value)

    RenderGanttHeader ws
    RenderModeBar ws

    Dim NextRow As Long
    NextRow = WS_DATA_START
    If viewMode = VIEW_PROCESS Then
        NextRow = RenderProcessView(ws, wsProd, NextRow, filterProc, filterStatus, _
                                     filterProduct, filterBatch, filterSN, filterEquip)
    Else
        NextRow = RenderBatchView(ws, wsProd, NextRow, filterProc, filterStatus, _
                                   filterProduct, filterBatch, filterSN, filterEquip)
    End If

    RenderTodayLine ws, NextRow

CleanUp:
    g_EventsDisabled = False
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub
ErrH:
    MsgBox "BuildAccordion 오류: " & Err.Description, vbCritical
    Resume CleanUp
End Sub

' ============================================================
Private Function PassFilter(wsProd As Worksheet, r As Long, _
                             filterProc As String, filterStatus As String, _
                             Optional filterProduct As String = "", _
                             Optional filterBatch As String = "", _
                             Optional filterSN As String = "", _
                             Optional filterEquip As String = "") As Boolean
    PassFilter = True
    Dim st As String: st = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
    If st = ST_SCRAP Then PassFilter = False: Exit Function
    
    ' 공정 필터 (부분일치)
    If filterProc <> "" And filterProc <> "전체" Then
        If InStr(1, SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value), filterProc, vbTextCompare) = 0 Then
            PassFilter = False: Exit Function
        End If
    End If
    
    ' 상태 필터 (부분일치)
    If filterStatus <> "" And filterStatus <> "전체" Then
        If InStr(1, st, filterStatus, vbTextCompare) = 0 Then
            PassFilter = False: Exit Function
        End If
    End If
    
    ' 제품명 필터 (부분일치)
    If filterProduct <> "" And filterProduct <> "전체" Then
        If InStr(1, SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value), filterProduct, vbTextCompare) = 0 Then
            PassFilter = False: Exit Function
        End If
    End If
    
    ' 배치 필터 (부분일치)
    If filterBatch <> "" And filterBatch <> "전체" Then
        If InStr(1, SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value), filterBatch, vbTextCompare) = 0 Then
            PassFilter = False: Exit Function
        End If
    End If
    
    ' S/N 필터 (뒤 숫자 우선 + 전체 부분일치 fallback)
    If filterSN <> "" And filterSN <> "전체" Then
        Dim snVal As String: snVal = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
        Dim snTail As String: snTail = ""
        Dim lPos As Long: lPos = InStrRev(snVal, "L")
        If lPos > 0 Then snTail = Mid(snVal, lPos + 1)
        
        If InStr(1, snTail, filterSN, vbTextCompare) = 0 Then
            If InStr(1, snVal, filterSN, vbTextCompare) = 0 Then
                PassFilter = False: Exit Function
            End If
        End If
    End If
    
    ' 호기(설비) 필터 (부분일치)
    If filterEquip <> "" And filterEquip <> "전체" Then
        If InStr(1, SafeStr(wsProd.Cells(r, PROD_COL_EQUIP).Value), filterEquip, vbTextCompare) = 0 Then
            PassFilter = False: Exit Function
        End If
    End If
End Function

' ============================================================
'  CanCheckInMode
' ============================================================
Private Function CanCheckInMode(wsProd As Worksheet, prdRow As Long) As Boolean
    CanCheckInMode = False
    Dim st As String: st = SafeStr(wsProd.Cells(prdRow, PROD_COL_STATUS).Value)
    Select Case g_CurrentMode
        Case MODE_EDIT:  CanCheckInMode = (st <> ST_SCRAP)
        Case MODE_SCRAP: CanCheckInMode = (st = ST_WAIT Or st = ST_PROG)
        Case MODE_NG:    CanCheckInMode = (st <> ST_SCRAP)
    End Select
End Function
' ============================================================
'  RenderModeBar  ★ v12.1: 채우기 대신 상단/하단 테두리선
' ============================================================
Private Sub RenderModeBar(ws As Worksheet)
    On Error Resume Next
    Dim modeRow As Long: modeRow = WS_ROW_MODEBAR

    ws.Range(ws.Cells(modeRow, WS_COL_CHK), _
             ws.Cells(modeRow, GNT_END_COL)).ClearContents
    ws.Range(ws.Cells(modeRow, WS_COL_CHK), _
             ws.Cells(modeRow, GNT_END_COL)).Interior.Color = CLR_BG_DARK
    ' 기존 테두리 초기화
    ws.Range(ws.Cells(modeRow, WS_COL_CHK), _
             ws.Cells(modeRow, WS_COL_DIV)).Borders.lineStyle = xlNone

    Dim shp As Shape
    For Each shp In ws.Shapes
        If shp.Name = "BTN_APPLY" Or shp.Name = "BTN_CANCEL" Then shp.Delete
    Next shp

    If g_CurrentMode = "" Or g_CurrentMode = MODE_NONE Then
        ws.rows(modeRow).rowHeight = 4
        Exit Sub
    End If

    ws.rows(modeRow).rowHeight = 24

    Dim modeColor As Long
    Dim modeLabel As String
    Select Case g_CurrentMode
        Case MODE_EDIT
            modeColor = CLR_CYAN
            modeLabel = "  편집 모드  |  제품행=하위일괄, S/N=개별  |  체크항목만 [적용] 저장"
        Case MODE_SCRAP
            modeColor = CLR_RED
            modeLabel = "  폐기 모드  |  체크 후 [적용]"
        Case MODE_NG
            modeColor = RGB(255, 80, 80)
            modeLabel = "  NG 모드  |  S/N 선택 후 [확인] 클릭"
        Case Else
            modeColor = CLR_BG_LIGHT
            modeLabel = "  " & g_CurrentMode & " 모드"
    End Select

    ' ★ 채우기 대신 상단+하단 테두리선으로 모드 표시
    Dim modeRng As Range
    Set modeRng = ws.Range(ws.Cells(modeRow, WS_COL_CHK), ws.Cells(modeRow, WS_COL_DIV))
    modeRng.Interior.Color = CLR_BG_DARK          ' 배경 없음
    With modeRng.Borders(xlEdgeTop)
        .lineStyle = xlContinuous: .Weight = xlMedium: .Color = modeColor
    End With
    With modeRng.Borders(xlEdgeBottom)
        .lineStyle = xlContinuous: .Weight = xlMedium: .Color = modeColor
    End With

    With ws.Cells(modeRow, WS_COL_MAIN)
        .Value = modeLabel
        .Font.Size = 10: .Font.Bold = True: .Font.Color = modeColor
    End With
    With ws.Cells(modeRow, WS_COL_SDATE)
        .Value = "[취소]"
        .Font.Size = 9: .Font.Bold = True: .Font.Color = CLR_TEXT_MID
        .HorizontalAlignment = xlCenter
    End With
       With ws.Cells(modeRow, WS_COL_EDATE)
        .Value = "[확인]"
        .Font.Size = 9: .Font.Bold = True: .Font.Color = CLR_CYAN
        .HorizontalAlignment = xlCenter
    End With
    On Error GoTo 0
End Sub

' ============================================================
'  RenderGanttHeader
' ============================================================
Private Sub RenderGanttHeader(ws As Worksheet)
    On Error Resume Next
    Dim baseDate  As Date: baseDate = GetGanttBaseDate(ws)
    Dim todayDate As Date: todayDate = Date
    Dim dayNames  As Variant
    dayNames = Array("월", "화", "수", "목", "금", "토", "일")

    '??????????????????????????????????????????
    ' 공정 색상 범례 (S2행 = WS_ROW_SUBTITLE 간트 영역)
    '??????????????????????????????????????????
    Dim legRow As Long: legRow = WS_ROW_SUBTITLE
    Dim legCol As Long: legCol = GNT_START_COL
    
    '범례 영역 초기화
    ws.Range(ws.Cells(legRow, GNT_START_COL), _
             ws.Cells(legRow, GNT_END_COL)).ClearContents
    ws.Range(ws.Cells(legRow, GNT_START_COL), _
             ws.Cells(legRow, GNT_END_COL)).ClearFormats
    ws.Range(ws.Cells(legRow, GNT_START_COL), _
             ws.Cells(legRow, GNT_END_COL)).Interior.Color = CLR_BG_DARK
    
    '공정 목록 (색상 블록 + 이름)
    Dim procNames As Variant
    procNames = Array(PROC_DEGREASING, PROC_SINTERING, PROC_REDUCTION, _
                      PROC_FLATTENING, PROC_PLATING, PROC_HEATTREAT)
    
    Dim pi As Long
    For pi = 0 To UBound(procNames)
        '색상 셀 (■)
        With ws.Cells(legRow, legCol)
            .Value = ChrW(&H25A0)
            .Font.Size = 10
            .Font.Color = GetProcColor(CStr(procNames(pi)))
            .Font.Name = TITLE_FONT_NAME
            .HorizontalAlignment = xlCenter
            .Interior.Color = CLR_BG_DARK
        End With
        legCol = legCol + 1
        
        '공정명 셀
        With ws.Cells(legRow, legCol)
            .Value = procNames(pi)
            .Font.Size = 7
            .Font.Color = CLR_TEXT_HINT
            .Font.Name = TITLE_FONT_NAME
            .HorizontalAlignment = xlLeft
            .Interior.Color = CLR_BG_DARK
        End With
        legCol = legCol + 1
    Next pi
    
    '상태 범례 (완료/진행중/대기/지연초과)
    legCol = legCol + 1  '간격
    
    '완료
    With ws.Cells(legRow, legCol)
        .Value = ChrW(&H25A0): .Font.Size = 10
        .Font.Color = CLR_BAR_COMPLETE: .Font.Name = TITLE_FONT_NAME
        .HorizontalAlignment = xlCenter: .Interior.Color = CLR_BG_DARK
    End With
    legCol = legCol + 1
    With ws.Cells(legRow, legCol)
        .Value = "완료": .Font.Size = 7: .Font.Color = CLR_TEXT_HINT
        .Font.Name = TITLE_FONT_NAME: .HorizontalAlignment = xlLeft
        .Interior.Color = CLR_BG_DARK
    End With
    legCol = legCol + 1
    
    '남은구간
    With ws.Cells(legRow, legCol)
        .Value = ChrW(&H25A0): .Font.Size = 10
        .Font.Color = CLR_BAR_REMAIN: .Font.Name = TITLE_FONT_NAME
        .HorizontalAlignment = xlCenter: .Interior.Color = CLR_BG_DARK
    End With
    legCol = legCol + 1
    With ws.Cells(legRow, legCol)
        .Value = "남은구간": .Font.Size = 7: .Font.Color = CLR_TEXT_HINT
        .Font.Name = TITLE_FONT_NAME: .HorizontalAlignment = xlLeft
        .Interior.Color = CLR_BG_DARK
    End With
    legCol = legCol + 1
    
    '지연초과
    With ws.Cells(legRow, legCol)
        .Value = ChrW(&H25A0): .Font.Size = 10
        .Font.Color = CLR_BAR_OVERDUE: .Font.Name = TITLE_FONT_NAME
        .HorizontalAlignment = xlCenter: .Interior.Color = CLR_BG_DARK
    End With
    legCol = legCol + 1
    With ws.Cells(legRow, legCol)
        .Value = "지연초과": .Font.Size = 7: .Font.Color = CLR_TEXT_HINT
        .Font.Name = TITLE_FONT_NAME: .HorizontalAlignment = xlLeft
        .Interior.Color = CLR_BG_DARK
    End With

    Dim gc      As Long
    Dim colDate As Date
    Dim isToday As Boolean
    Dim isSun   As Boolean
    Dim isSat   As Boolean
    Dim prevMonth As Long: prevMonth = -1

    '── 6행(WS_ROW_FILT_LABEL 위 또는 별도 행)에 월 표시 ──
    '   WS_ROW_FILT_LABEL = 6 이므로, 간트 영역의 6행에 월 병합 표시
    '   먼저 간트 영역 6행 초기화
    ws.Range(ws.Cells(WS_ROW_FILT_LABEL, GNT_START_COL), _
             ws.Cells(WS_ROW_FILT_LABEL, GNT_END_COL)).ClearContents
    ws.Range(ws.Cells(WS_ROW_FILT_LABEL, GNT_START_COL), _
             ws.Cells(WS_ROW_FILT_LABEL, GNT_END_COL)).ClearFormats
    ws.Range(ws.Cells(WS_ROW_FILT_LABEL, GNT_START_COL), _
             ws.Cells(WS_ROW_FILT_LABEL, GNT_END_COL)).Interior.Color = CLR_BG_DARK

    Dim monthStartCol As Long: monthStartCol = GNT_START_COL

    For gc = GNT_START_COL To GNT_END_COL
        colDate = baseDate + (gc - GNT_TODAY_COL)
        isToday = (colDate = todayDate)
        isSun = (Weekday(colDate, vbMonday) = 7)
        isSat = (Weekday(colDate, vbMonday) = 6)

        '── 월 구분 (6행) ──
        If Month(colDate) <> prevMonth Then
            If prevMonth <> -1 And (gc - 1) >= monthStartCol Then
                '이전 월 병합 완료 (병합은 아래에서 일괄)
            End If
            '월 시작 표시
            With ws.Cells(WS_ROW_FILT_LABEL, gc)
                .Value = Month(colDate) & "월"
                .Font.Size = 9
                .Font.Bold = True
                .Font.Color = CLR_TEXT_LIGHT
                .Font.Name = TITLE_FONT_NAME
                .HorizontalAlignment = xlLeft
                .Interior.Color = CLR_BG_DARK
            End With
            '월 구분 세로선
            With ws.Range(ws.Cells(WS_ROW_FILT_LABEL, gc), _
                          ws.Cells(WS_ROW_GANTT_DOW, gc)).Borders(xlEdgeLeft)
                .lineStyle = xlContinuous
                .Weight = xlThin
                .Color = CLR_TEXT_DIM
            End With
            monthStartCol = gc
            prevMonth = Month(colDate)
        End If

        '── 날짜 행 (7행 = WS_ROW_FILTER) ──
        With ws.Cells(WS_ROW_FILTER, gc)
            .Value = Day(colDate)
            .Font.Size = 9
            .Font.Name = TITLE_FONT_NAME
            .Font.Bold = isToday
            .HorizontalAlignment = xlCenter
            .NumberFormat = "@"
            .Interior.Color = CLR_BG_DARK
            If isToday Then
                .Font.Color = CLR_RED: .Font.Bold = True
            ElseIf isSun Then
                .Font.Color = CLR_RED
            ElseIf isSat Then
                .Font.Color = CLR_BLUE
            Else
                .Font.Color = CLR_TEXT_HINT
            End If
        End With

        '── 요일 행 (8행 = WS_ROW_GANTT_DOW) ──
        With ws.Cells(WS_ROW_GANTT_DOW, gc)
            .Value = dayNames(Weekday(colDate, vbMonday) - 1)
            .Font.Size = 8
            .Font.Name = TITLE_FONT_NAME
            .HorizontalAlignment = xlCenter
            .Interior.Color = CLR_BG_DARK
            .Font.Bold = False
            If isToday Then
                .Font.Color = CLR_RED: .Font.Bold = True
            ElseIf isSun Then
                .Font.Color = CLR_RED
            ElseIf isSat Then
                .Font.Color = CLR_BLUE
            Else
                .Font.Color = CLR_TEXT_HINT
            End If
            With .Borders(xlEdgeBottom)
                .lineStyle = xlContinuous: .Weight = xlHairline: .Color = CLR_TEXT_DIM
            End With
        End With
    Next gc

    '── 간트 좌측 구분선 ──
    Dim divRng As Range
    Set divRng = ws.Range(ws.Cells(WS_ROW_FILT_LABEL, GNT_START_COL), _
                          ws.Cells(WS_ROW_FILTER + 200, GNT_START_COL))
    With divRng.Borders(xlEdgeLeft)
        .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_GANTT_DIVIDER
    End With
    On Error GoTo 0
End Sub

' ============================================================
'  GetGanttBaseDate
' ============================================================
Private Function GetGanttBaseDate(ws As Worksheet) As Date
    Dim v As Variant
    v = ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value
    If IsDate(v) Then
        GetGanttBaseDate = CDate(v)
    Else
        GetGanttBaseDate = Date
        ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value = Date
    End If
End Function

' ============================================================
'  RenderGanttBar  (진행률 기반 ? 기능 동일)
' ============================================================
Private Sub RenderGanttBar(ws As Worksheet, rowNum As Long, _
                            dtStart As Date, dtEnd As Date, _
                            barColor As Long, _
                            Optional status As String = "", _
                            Optional progressPct As Double = 0)
    On Error Resume Next
    Dim baseDate   As Date: baseDate = GetGanttBaseDate(ws)
    Dim todayDate  As Date: todayDate = Date
    Dim isComplete As Boolean
    Dim isOverdue  As Boolean
    
    isComplete = (status = ST_DONE) Or (progressPct >= 1)
    isOverdue = ((status = ST_PROG Or status = ST_DELAY) And todayDate > dtEnd)

    Dim gc      As Long
    Dim colDate As Date
    Dim cellClr As Long

    For gc = GNT_START_COL To GNT_END_COL
        colDate = baseDate + (gc - GNT_TODAY_COL)
        
        ' 바 범위 밖이면 스킵
        If colDate < dtStart Then GoTo NextGC
        
        If isComplete Then
            ' 완료: 전체 구간 완료색
            If colDate >= dtStart And colDate <= dtEnd Then
                ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_COMPLETE
            End If
            
        ElseIf isOverdue Then
            ' 지연: 시작~종료 중 오늘까지=완료, 종료 이후~오늘=초과
            If colDate >= dtStart And colDate <= dtEnd Then
                If colDate <= todayDate Then
                    ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_DONE
                Else
                    ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_REMAIN
                End If
            End If
            ' 종료일 이후 ~ 오늘까지 = 빨간 초과 표시
            If colDate > dtEnd And colDate <= todayDate Then
                ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_OVERDUE
            End If
            
        Else
            ' 진행/대기: 시작~오늘=완료(초록), 오늘이후~종료=남은구간(회색)
            If colDate >= dtStart And colDate <= dtEnd Then
                If status = ST_WAIT Then
                    ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_WAITING
                ElseIf colDate <= todayDate Then
                    ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_DONE
                Else
                    ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_REMAIN
                End If
            End If
        End If
NextGC:
    Next gc
    On Error GoTo 0
End Sub

' ============================================================
'  RenderTodayLine
' ============================================================
Private Sub RenderTodayLine(ws As Worksheet, lastDataRow As Long)
    On Error Resume Next
    If lastDataRow < WS_DATA_START Then lastDataRow = WS_DATA_START

    Dim fullRng As Range
    Set fullRng = ws.Range(ws.Cells(WS_ROW_FILTER, GNT_START_COL), _
                           ws.Cells(lastDataRow, GNT_END_COL))
    fullRng.Borders(xlInsideVertical).lineStyle = xlNone
    fullRng.Borders(xlEdgeLeft).lineStyle = xlNone
    fullRng.Borders(xlEdgeRight).lineStyle = xlNone

    Dim divRng As Range
    Set divRng = ws.Range(ws.Cells(WS_ROW_FILTER, GNT_START_COL), _
                          ws.Cells(lastDataRow, GNT_START_COL))
    With divRng.Borders(xlEdgeLeft)
        .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_GANTT_DIVIDER
    End With

    Dim baseDate As Date: baseDate = GetGanttBaseDate(ws)
    Dim todayCol As Long: todayCol = GNT_TODAY_COL + CLng(Date - baseDate)
    If todayCol < GNT_START_COL Or todayCol > GNT_END_COL Then Exit Sub

    Dim todayRng As Range
    Set todayRng = ws.Range(ws.Cells(WS_ROW_FILTER, todayCol), _
                            ws.Cells(lastDataRow, todayCol))
    With todayRng.Borders(xlEdgeLeft)
        .lineStyle = xlContinuous: .Weight = xlMedium: .Color = CLR_RED
    End With
    With todayRng.Borders(xlEdgeRight)
        .lineStyle = xlContinuous: .Weight = xlMedium: .Color = CLR_RED
    End With
    On Error GoTo 0
End Sub

' ============================================================
'  ★ 행 하단 구분선 헬퍼 (v11 스타일 분리선)
' ============================================================
Private Sub DrawRowBottomBorder(ws As Worksheet, r As Long, _
                                 Optional borderColor As Long = -1)
    If borderColor = -1 Then borderColor = CLR_BG_LIGHT
    Dim rng As Range
    Set rng = ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL))
    With rng.Borders(xlEdgeBottom)
        .lineStyle = xlContinuous
        .Weight = xlHairline
        .Color = borderColor
    End With
End Sub

' ============================================================
'  RenderBatchView  ★ v12.1 디자인
' ============================================================
Private Function RenderBatchView(ws As Worksheet, wsProd As Worksheet, _
                                  startRow As Long, filterProc As String, _
                                  filterStatus As String, _
                                  Optional filterProduct As String = "", _
                                  Optional filterBatch As String = "", _
                                  Optional filterSN As String = "", _
                                  Optional filterEquip As String = "") As Long
    On Error Resume Next
    Dim lastPR As Long: lastPR = GetLastRow(wsProd, PROD_COL_SN)
    If lastPR < PROD_DATA_START Then RenderBatchView = startRow: Exit Function

    Dim inEdit As Boolean: inEdit = (g_CurrentMode = MODE_EDIT)
    Dim inMode As Boolean: inMode = (g_CurrentMode <> "" And g_CurrentMode <> MODE_NONE)

    Dim batches As Object: Set batches = CreateObject("Scripting.Dictionary")
    Dim ri As Long
    Dim bc As String
    For ri = PROD_DATA_START To lastPR
        bc = SafeStr(wsProd.Cells(ri, PROD_COL_BATCH).Value)
        If bc <> "" Then
            If Not batches.Exists(bc) Then batches.Add bc, ri
        End If
    Next ri

    Dim r As Long: r = startRow
    Dim bKey As Variant

    For Each bKey In batches.keys
        Dim batchCode As String: batchCode = CStr(bKey)

        Dim allRows() As Long
        Dim allCount  As Long: allCount = 0
        ReDim allRows(1 To lastPR)
        For ri = PROD_DATA_START To lastPR
            If SafeStr(wsProd.Cells(ri, PROD_COL_BATCH).Value) = batchCode Then
                If PassFilter(wsProd, ri, filterProc, filterStatus, filterProduct, filterBatch, filterSN, filterEquip) Then
                    allCount = allCount + 1
                    allRows(allCount) = ri
                End If
            End If
        Next ri
        If allCount = 0 Then GoTo NextBatch

        Dim isBatchExp As Boolean
        If dictToggle.Exists(batchCode) Then
            isBatchExp = dictToggle(batchCode)
        Else
            isBatchExp = False         ' ← 닫힘
            dictToggle(batchCode) = False
        End If

        Dim bMinDate   As Date
        Dim bMaxDate   As Date
        Dim bHasDate   As Boolean: bHasDate = False
        Dim bPctSum    As Double: bPctSum = 0
        Dim bActiveCnt As Long: bActiveCnt = 0
        Dim si         As Long
        Dim sd         As String
        Dim ed         As String

        For si = 1 To allCount
            If SafeStr(wsProd.Cells(allRows(si), PROD_COL_STATUS).Value) <> ST_SCRAP Then
                bActiveCnt = bActiveCnt + 1
                bPctSum = bPctSum + SafeDbl(wsProd.Cells(allRows(si), PROD_COL_PROGRESS).Value)
                sd = SafeStr(wsProd.Cells(allRows(si), PROD_COL_START).Value)
                ed = SafeStr(wsProd.Cells(allRows(si), PROD_COL_END).Value)
                If SafeIsDate(sd) Then
                    If Not bHasDate Then
                        bMinDate = CDate(sd): bMaxDate = bMinDate: bHasDate = True
                    End If
                    If CDate(sd) < bMinDate Then bMinDate = CDate(sd)
                End If
                If SafeIsDate(ed) And bHasDate Then
                    If CDate(ed) > bMaxDate Then bMaxDate = CDate(ed)
                End If
            End If
        Next si
        Dim bAvgPct As Double: bAvgPct = 0
        If bActiveCnt > 0 Then bAvgPct = bPctSum / bActiveCnt

        Dim batchRowPos As Long: batchRowPos = r
        ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL)).Interior.Color = CLR_BG_DARK

        With ws.Cells(r, WS_COL_TOG)
            If isBatchExp Then .Value = TOGGLE_COLLAPSE Else .Value = TOGGLE_EXPAND
            .Font.Size = 10: .Font.Color = CLR_CYAN: .HorizontalAlignment = xlCenter
        End With
        With ws.Cells(r, WS_COL_MAIN)
            .Value = batchCode
            .Font.Size = 11: .Font.Bold = True: .Font.Color = CLR_TEXT_WHITE
            .Font.Name = "Consolas"
        End With
        With ws.Cells(r, WS_COL_QTY)
            .Value = bActiveCnt & "매"
            .Font.Size = 9: .Font.Bold = True: .Font.Color = CLR_TEXT_LIGHT
            .HorizontalAlignment = xlCenter
        End With
        If bHasDate Then
            ws.Cells(r, WS_COL_SDATE).Value = Format(bMinDate, "MM-DD")
            ws.Cells(r, WS_COL_EDATE).Value = Format(bMaxDate, "MM-DD")
            ws.Cells(r, WS_COL_SDATE).Font.Size = 8
            ws.Cells(r, WS_COL_SDATE).Font.Color = CLR_TEXT_HINT
            ws.Cells(r, WS_COL_EDATE).Font.Size = 8
            ws.Cells(r, WS_COL_EDATE).Font.Color = CLR_TEXT_HINT
            ws.Cells(r, WS_COL_SDATE).HorizontalAlignment = xlCenter
            ws.Cells(r, WS_COL_EDATE).HorizontalAlignment = xlCenter
        End If
        ws.Cells(r, WS_COL_PROG).Value = Format(bAvgPct, "0%")
        ws.Cells(r, WS_COL_PROG).Font.Size = 9
        ws.Cells(r, WS_COL_PROG).Font.Bold = True
        ws.Cells(r, WS_COL_PROG).Font.Color = CLR_GREEN
        ws.Cells(r, WS_COL_PROG).HorizontalAlignment = xlCenter

        DrawRowBottomBorder ws, r, CLR_TEXT_DIM

        ws.Cells(r, META_TYPE).Value = RTYPE_BATCH
        ws.Cells(r, META_KEY1).Value = batchCode
        r = r + 1

        If isBatchExp Then
            Dim prodDict As Object: Set prodDict = CreateObject("Scripting.Dictionary")
            Dim pName    As String
            Dim grpProc  As String
            Dim grpEquip As String
            Dim grpKey   As String
            Dim pCnt     As Long
            Dim tmpArr() As Long
            Dim prevA    As Variant
            Dim pi       As Long

            For si = 1 To allCount
                pName = SafeStr(wsProd.Cells(allRows(si), PROD_COL_PRODUCT).Value)
                If pName = "" Then pName = "(미지정)"
                grpProc = SafeStr(wsProd.Cells(allRows(si), PROD_COL_PROCESS).Value)
                grpEquip = SafeStr(wsProd.Cells(allRows(si), PROD_COL_EQUIP).Value)
                grpKey = pName & "|" & grpProc & "|" & grpEquip

                If Not prodDict.Exists(grpKey) Then
                    Dim grpInfo As Object
                    Set grpInfo = CreateObject("Scripting.Dictionary")
                    grpInfo.Add "rows", Array()
                    grpInfo.Add "count", CLng(0)
                    grpInfo.Add "name", pName
                    grpInfo.Add "proc", grpProc
                    grpInfo.Add "equip", grpEquip
                    prodDict.Add grpKey, grpInfo
                End If
                pCnt = prodDict(grpKey)("count") + 1
                prodDict(grpKey)("count") = pCnt
                ReDim tmpArr(1 To pCnt)
                If pCnt > 1 Then
                    prevA = prodDict(grpKey)("rows")
                    For pi = LBound(prevA) To UBound(prevA)
                        tmpArr(pi) = prevA(pi)
                    Next pi
                End If
                tmpArr(pCnt) = allRows(si)
                prodDict(grpKey)("rows") = tmpArr
            Next si

            Dim pKey As Variant
            For Each pKey In prodDict.keys
                Dim grpKeyStr    As String: grpKeyStr = CStr(pKey)
                Dim prodName     As String: prodName = CStr(prodDict(grpKeyStr)("name"))
                Dim grpProcName  As String: grpProcName = CStr(prodDict(grpKeyStr)("proc"))
                Dim grpEquipName As String: grpEquipName = CStr(prodDict(grpKeyStr)("equip"))
                Dim prodSNRows   As Variant: prodSNRows = prodDict(grpKeyStr)("rows")
                Dim prodSNCount  As Long: prodSNCount = prodDict(grpKeyStr)("count")

                Dim prodTogKey As String: prodTogKey = batchCode & "|" & grpKeyStr
                Dim isProdExp  As Boolean
                If dictToggle.Exists(prodTogKey) Then
                    isProdExp = dictToggle(prodTogKey)
                Else
                    isProdExp = False          ' ← 이미 닫힘 OK
                    dictToggle(prodTogKey) = False
                End If

                Dim gPctSum    As Double: gPctSum = 0
                Dim gActiveCnt As Long: gActiveCnt = 0
                Dim gMinD      As Date
                Dim gMaxD      As Date
                Dim gHasD      As Boolean: gHasD = False
                Dim mainProc   As String: mainProc = ""
                Dim mainSts    As String: mainSts = ""
                Dim ci         As Long
                Dim cSts       As String
                Dim cs         As String
                Dim ce         As String

                For ci = LBound(prodSNRows) To UBound(prodSNRows)
                    cSts = SafeStr(wsProd.Cells(CLng(prodSNRows(ci)), PROD_COL_STATUS).Value)
                    If cSts <> ST_SCRAP Then
                        gActiveCnt = gActiveCnt + 1
                        gPctSum = gPctSum + SafeDbl(wsProd.Cells(CLng(prodSNRows(ci)), PROD_COL_PROGRESS).Value)
                        If mainProc = "" Then mainProc = SafeStr(wsProd.Cells(CLng(prodSNRows(ci)), PROD_COL_PROCESS).Value)
                        If mainSts = "" Then mainSts = cSts
                        cs = SafeStr(wsProd.Cells(CLng(prodSNRows(ci)), PROD_COL_START).Value)
                        ce = SafeStr(wsProd.Cells(CLng(prodSNRows(ci)), PROD_COL_END).Value)
                        If SafeIsDate(cs) Then
                            If Not gHasD Then gMinD = CDate(cs): gMaxD = gMinD: gHasD = True
                            If CDate(cs) < gMinD Then gMinD = CDate(cs)
                        End If
                        If SafeIsDate(ce) And gHasD Then
                            If CDate(ce) > gMaxD Then gMaxD = CDate(ce)
                        End If
                    End If
                Next ci
                Dim gAvgPct As Double: gAvgPct = 0
                If gActiveCnt > 0 Then gAvgPct = gPctSum / gActiveCnt

                Dim pType As String
                pType = SafeStr(wsProd.Cells(CLng(prodSNRows(LBound(prodSNRows))), PROD_COL_TYPE).Value)

                Dim prodRowPos As Long: prodRowPos = r
                ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL)).Interior.Color = CLR_BG_DARK

                With ws.Cells(r, WS_COL_TOG).Borders(xlEdgeLeft)
                    .lineStyle = xlContinuous: .Weight = xlMedium: .Color = GetProcColor(mainProc)
                End With

                If inMode And isProdExp Then
                    Dim prodAllChk As Boolean: prodAllChk = True
                    Dim ckSN As String
                    For ci = LBound(prodSNRows) To UBound(prodSNRows)
                        ckSN = SafeStr(wsProd.Cells(CLng(prodSNRows(ci)), PROD_COL_SN).Value)
                        If CanCheckInMode(wsProd, CLng(prodSNRows(ci))) Then
                            If dictCheck.Exists(ckSN) Then
                                If Not dictCheck(ckSN) Then prodAllChk = False
                            Else
                                prodAllChk = False
                            End If
                        End If
                    Next ci
                    With ws.Cells(r, WS_COL_CHK)
                        If prodAllChk Then .Value = CHECK_ON Else .Value = CHECK_OFF
                        .Font.Size = 11: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
                    End With
                End If

                With ws.Cells(r, WS_COL_TOG)
                    If isProdExp Then .Value = TOGGLE_COLLAPSE Else .Value = TOGGLE_EXPAND
                    .Font.Size = 9: .Font.Color = CLR_CYAN: .HorizontalAlignment = xlCenter
                End With
                With ws.Cells(r, WS_COL_MAIN)
                    .Value = "  " & prodName
                    .Font.Size = 10: .Font.Bold = True: .Font.Color = GetTypeColor(pType)
                End With
                With ws.Cells(r, WS_COL_QTY)
                    .Value = gActiveCnt & "매"
                    .Font.Size = 9: .Font.Bold = True: .Font.Color = CLR_TEXT_LIGHT
                    .HorizontalAlignment = xlCenter
                End With
                If mainProc <> "" Then
                    With ws.Cells(r, WS_COL_PROC)
                        .Value = mainProc: .Font.Size = 8: .Font.Bold = True
                        .Font.Color = GetProcColor(mainProc): .HorizontalAlignment = xlCenter
                    End With
                End If
                If grpEquipName <> "" Then
                    With ws.Cells(r, WS_COL_EQUIP)
                        .Value = grpEquipName: .Font.Size = 8: .Font.Bold = True
                        .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
                    End With
                End If
                If mainSts <> "" Then FormatBadgeCell ws.Cells(r, WS_COL_STATUS), mainSts

                ' 간트바
                If gHasD Then
                    ws.Cells(r, WS_COL_SDATE).Value = Format(gMinD, "MM-DD")
                    ws.Cells(r, WS_COL_EDATE).Value = Format(gMaxD, "MM-DD")
                    ws.Cells(r, WS_COL_SDATE).Font.Size = 8
                    ws.Cells(r, WS_COL_SDATE).Font.Color = CLR_TEXT_HINT
                    ws.Cells(r, WS_COL_EDATE).Font.Size = 8
                    ws.Cells(r, WS_COL_EDATE).Font.Color = CLR_TEXT_HINT
                    ws.Cells(r, WS_COL_SDATE).HorizontalAlignment = xlCenter
                    ws.Cells(r, WS_COL_EDATE).HorizontalAlignment = xlCenter
                    Dim gnFirstSN As String
                    gnFirstSN = SafeStr(wsProd.Cells(CLng(prodSNRows(LBound(prodSNRows))), PROD_COL_SN).Value)
                    RenderFullProcGantt ws, r, gnFirstSN, mainSts
                End If

                ws.Cells(r, WS_COL_PROG).Value = Format(gAvgPct, "0%")
                ws.Cells(r, WS_COL_PROG).Font.Size = 8
                ws.Cells(r, WS_COL_PROG).Font.Bold = True
                ws.Cells(r, WS_COL_PROG).Font.Color = CLR_GREEN
                ws.Cells(r, WS_COL_PROG).HorizontalAlignment = xlCenter

                ' 편집 UI
                     ' 편집 UI
                If inEdit And isProdExp Then
                    Dim firstPrdRowE As Long: firstPrdRowE = CLng(prodSNRows(LBound(prodSNRows)))
                    Dim prodRouteE As String: prodRouteE = SafeStr(wsProd.Cells(firstPrdRowE, PROD_COL_ROUTE).Value)
                    Dim prodTypeE As String: prodTypeE = SafeStr(wsProd.Cells(firstPrdRowE, PROD_COL_TYPE).Value)

                    If Len(prodRouteE) > 0 Then
                        AddDataValidation ws.Cells(r, WS_COL_PROC), Replace(prodRouteE, " > ", ",")
                    End If
                    With ws.Cells(r, WS_COL_PROC)
                        .Interior.Color = CLR_BG_DARK
                        With .Borders(xlEdgeBottom)
                            .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
                        End With
                    End With

                    Dim curProdProc As String: curProdProc = SafeStr(ws.Cells(r, WS_COL_PROC).Value)
                    If Len(curProdProc) = 0 Then curProdProc = mainProc
                    Dim prodEqListE As String: prodEqListE = GetEquipListForProc(curProdProc, prodTypeE)
                    If Len(prodEqListE) > 0 Then
                        AddDataValidation ws.Cells(r, WS_COL_EQUIP), prodEqListE
                    End If
                    With ws.Cells(r, WS_COL_EQUIP)
                        .Interior.Color = CLR_BG_DARK
                        .Font.Size = 8
                        .Font.Color = CLR_TEXT_LIGHT
                        .Font.Name = TITLE_FONT_NAME
                        .HorizontalAlignment = xlCenter
                        With .Borders(xlEdgeBottom)
                            .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
                        End With
                    End With
                    Dim stsListProd As String: stsListProd = GetStatusList(mainSts)
                    AddDataValidation ws.Cells(r, WS_COL_STATUS), stsListProd
                    With ws.Cells(r, WS_COL_STATUS)
                        .Interior.Color = CLR_BG_DARK
                        With .Borders(xlEdgeBottom)
                            .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
                        End With
                    End With

                    ' ★ 제품행 시작일 기본값
                    If Not SafeIsDate(ws.Cells(r, WS_COL_SDATE).Value) Then
                        If gHasD Then
                            ws.Cells(r, WS_COL_SDATE).Value = FmtDate(gMinD)
                        Else
                            ws.Cells(r, WS_COL_SDATE).Value = FmtDate(Date)
                        End If
                    End If
                    ' ★ 제품행 종료일 기본값
                    If Not SafeIsDate(ws.Cells(r, WS_COL_EDATE).Value) Then
                        If gHasD Then
                            ws.Cells(r, WS_COL_EDATE).Value = FmtDate(gMaxD)
                        Else
                            Dim peDays As Long
                            peDays = GetProcDays(curProdProc, prodTypeE, _
                                     SafeLng(wsProd.Cells(firstPrdRowE, PROD_COL_STACK).Value), _
                                     SafeStr(wsProd.Cells(firstPrdRowE, PROD_COL_DC).Value))
                                ws.Cells(r, WS_COL_EDATE).Value = FmtDate(Date + peDays)
                        End If
                    End If

                    With ws.Cells(r, WS_COL_SDATE)
                        .Interior.Color = CLR_BG_DARK
                        .Font.Size = 8
                        .Font.Color = CLR_TEXT_LIGHT
                        .Font.Name = TITLE_FONT_NAME
                        .HorizontalAlignment = xlCenter
                        .NumberFormat = "MM/DD"
                        With .Borders(xlEdgeBottom)
                            .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
                        End With
                    End With
                    With ws.Cells(r, WS_COL_EDATE)
                        .Interior.Color = CLR_BG_DARK
                        .Font.Size = 8
                        .Font.Color = CLR_TEXT_LIGHT
                        .Font.Name = TITLE_FONT_NAME
                        .HorizontalAlignment = xlCenter
                        .NumberFormat = "MM/DD"
                        With .Borders(xlEdgeBottom)
                            .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
                        End With
                    End With

                    ws.Cells(r, WS_COL_SPINUP).Value = SPIN_UP_CHAR
                    ws.Cells(r, WS_COL_SPINUP).Font.Size = 8
                    ws.Cells(r, WS_COL_SPINUP).Font.Color = CLR_CYAN
                    ws.Cells(r, WS_COL_SPINUP).HorizontalAlignment = xlCenter
                    ws.Cells(r, WS_COL_SPINDN).Value = SPIN_DN_CHAR
                    ws.Cells(r, WS_COL_SPINDN).Font.Size = 8
                    ws.Cells(r, WS_COL_SPINDN).Font.Color = CLR_CYAN
                    ws.Cells(r, WS_COL_SPINDN).HorizontalAlignment = xlCenter
                End If

                DrawRowBottomBorder ws, r, CLR_BG_LIGHT

                ws.Cells(r, META_TYPE).Value = RTYPE_PRODUCT
                ws.Cells(r, META_KEY1).Value = batchCode
                ws.Cells(r, META_KEY2).Value = prodName
                ws.Cells(r, META_KEY3).Value = prodTogKey
                r = r + 1

                If isProdExp Then
                    For ci = LBound(prodSNRows) To UBound(prodSNRows)
                        r = RenderSNRow(ws, wsProd, r, CLng(prodSNRows(ci)), batchCode, inMode)
                    Next ci
                End If
            Next pKey
        End If

        ' 배치 체크박스
        If inMode Then
            Dim bAllChk As Boolean: bAllChk = True
            Dim bHasChk As Boolean: bHasChk = False
            Dim bSN As String
            For si = 1 To allCount
                bSN = SafeStr(wsProd.Cells(allRows(si), PROD_COL_SN).Value)
                If CanCheckInMode(wsProd, allRows(si)) Then
                    If dictCheck.Exists(bSN) Then
                        If dictCheck(bSN) Then bHasChk = True Else bAllChk = False
                    Else
                        bAllChk = False
                    End If
                End If
            Next si
            If Not bHasChk Then bAllChk = False
            With ws.Cells(batchRowPos, WS_COL_CHK)
                If bAllChk Then .Value = CHECK_ON Else .Value = CHECK_OFF
                .Font.Size = 12: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
            End With
        End If
NextBatch:
    Next bKey
    RenderBatchView = r
    On Error GoTo 0
End Function

' ============================================================
'  RenderSNRow  ★ v12.1 디자인
' ============================================================
Private Function RenderSNRow(ws As Worksheet, wsProd As Worksheet, _
                              r As Long, prdRow As Long, _
                              batchCode As String, inMode As Boolean) As Long
    On Error Resume Next
    Dim snVal   As String: snVal = SafeStr(wsProd.Cells(prdRow, PROD_COL_SN).Value)
    Dim snSts   As String: snSts = SafeStr(wsProd.Cells(prdRow, PROD_COL_STATUS).Value)
    Dim canChk  As Boolean: canChk = inMode And CanCheckInMode(wsProd, prdRow)
    Dim inEdit  As Boolean: inEdit = (g_CurrentMode = MODE_EDIT)
    Dim isChecked As Boolean: isChecked = False
    If dictCheck.Exists(snVal) Then isChecked = dictCheck(snVal)

    ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL)).Interior.Color = CLR_BG_DARK
    If isChecked Then
        With ws.Cells(r, WS_COL_CHK).Borders(xlEdgeLeft)
            .lineStyle = xlContinuous: .Weight = xlMedium: .Color = CLR_CYAN
        End With
    End If

    If canChk Then
        With ws.Cells(r, WS_COL_CHK)
            If isChecked Then .Value = CHECK_ON Else .Value = CHECK_OFF
            .Font.Size = 11: .HorizontalAlignment = xlCenter
            If isChecked Then .Font.Color = CLR_CYAN Else .Font.Color = CLR_TEXT_HINT
        End With
    End If

    With ws.Cells(r, WS_COL_MAIN)
        .Value = "      " & snVal
        .Font.Size = 9: .Font.Color = CLR_TEXT_LIGHT: .Font.Name = "Consolas"
    End With

    Dim snProc As String: snProc = SafeStr(wsProd.Cells(prdRow, PROD_COL_PROCESS).Value)
    With ws.Cells(r, WS_COL_PROC)
        .Value = snProc: .Font.Size = 8
        .Font.Color = GetProcColor(snProc): .HorizontalAlignment = xlCenter
    End With

    Dim snEquip As String: snEquip = SafeStr(wsProd.Cells(prdRow, PROD_COL_EQUIP).Value)
    With ws.Cells(r, WS_COL_EQUIP)
        .Value = snEquip: .Font.Size = 8
        .Font.Color = CLR_TEXT_HINT: .HorizontalAlignment = xlCenter
    End With

    FormatBadgeCell ws.Cells(r, WS_COL_STATUS), snSts

    Dim snSD As String: snSD = SafeStr(wsProd.Cells(prdRow, PROD_COL_START).Value)
    Dim snED As String: snED = SafeStr(wsProd.Cells(prdRow, PROD_COL_END).Value)
    ws.Cells(r, WS_COL_SDATE).Value = snSD
    ws.Cells(r, WS_COL_SDATE).Font.Size = 8
    ws.Cells(r, WS_COL_SDATE).Font.Color = CLR_TEXT_HINT
    ws.Cells(r, WS_COL_SDATE).HorizontalAlignment = xlCenter
    ws.Cells(r, WS_COL_EDATE).Value = snED
    ws.Cells(r, WS_COL_EDATE).Font.Size = 8
    ws.Cells(r, WS_COL_EDATE).Font.Color = CLR_TEXT_HINT
    ws.Cells(r, WS_COL_EDATE).HorizontalAlignment = xlCenter

    Dim pctVal As Double: pctVal = SafeDbl(wsProd.Cells(prdRow, PROD_COL_PROGRESS).Value)
    ws.Cells(r, WS_COL_PROG).Value = Format(pctVal, "0%")
    ws.Cells(r, WS_COL_PROG).Font.Size = 8
    ws.Cells(r, WS_COL_PROG).HorizontalAlignment = xlCenter
    ws.Cells(r, WS_COL_PROG).Font.Color = CLR_TEXT_HINT

    If SafeIsDate(snSD) And (snSts = ST_PROG Or snSts = ST_DELAY) Then
        Dim dPlus As Long: dPlus = Date - CDate(snSD)
        ws.Cells(r, WS_COL_DPLUS).Value = "D+" & dPlus
        ws.Cells(r, WS_COL_DPLUS).Font.Size = 8
        ws.Cells(r, WS_COL_DPLUS).HorizontalAlignment = xlCenter
        If snSts = ST_DELAY Then
            ws.Cells(r, WS_COL_DPLUS).Font.Color = CLR_RED
        Else
            ws.Cells(r, WS_COL_DPLUS).Font.Color = CLR_TEXT_HINT
        End If
    End If

    ' ── 편집 모드 UI ──
    If inEdit Then
        Dim pTypeS  As String: pTypeS = SafeStr(wsProd.Cells(prdRow, PROD_COL_TYPE).Value)
        Dim routeS  As String: routeS = SafeStr(wsProd.Cells(prdRow, PROD_COL_ROUTE).Value)
        Dim stackS  As Long: stackS = SafeLng(wsProd.Cells(prdRow, PROD_COL_STACK).Value)
        Dim dcS     As String: dcS = SafeStr(wsProd.Cells(prdRow, PROD_COL_DC).Value)

        If Len(routeS) > 0 Then AddDataValidation ws.Cells(r, WS_COL_PROC), Replace(routeS, " > ", ",")
        Dim eqListS As String: eqListS = GetEquipListForProc(snProc, pTypeS)
        If Len(eqListS) > 0 Then AddDataValidation ws.Cells(r, WS_COL_EQUIP), eqListS

        Dim stsListSN As String: stsListSN = GetStatusList(snSts)
        AddDataValidation ws.Cells(r, WS_COL_STATUS), stsListSN
        With ws.Cells(r, WS_COL_STATUS)
            .Interior.Color = CLR_BG_DARK
            With .Borders(xlEdgeBottom)
                .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
            End With
        End With

        ' 시작일 기본값
        If Not SafeIsDate(ws.Cells(r, WS_COL_SDATE).Value) Then
            ws.Cells(r, WS_COL_SDATE).Value = FmtDate(Date)
            snSD = FmtDate(Date)
        End If
        ' 종료일 기본값
        If Not SafeIsDate(ws.Cells(r, WS_COL_EDATE).Value) Then
            If SafeIsDate(ws.Cells(r, WS_COL_SDATE).Value) Then
                Dim edProcDays As Long
                edProcDays = GetProcDays(snProc, pTypeS, stackS, dcS)
                Dim edEndDate As String
                edEndDate = FmtDate(CDate(ws.Cells(r, WS_COL_SDATE).Value) + edProcDays)
                ws.Cells(r, WS_COL_EDATE).Value = edEndDate
                snED = edEndDate
            End If
        End If

        With ws.Cells(r, WS_COL_EQUIP)
            .Interior.Color = CLR_BG_DARK: .Font.Color = CLR_TEXT_LIGHT
            With .Borders(xlEdgeBottom)
                .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
            End With
        End With
        With ws.Cells(r, WS_COL_SDATE)
            .Interior.Color = CLR_BG_DARK: .Font.Color = CLR_TEXT_LIGHT
            .NumberFormat = "MM/DD"
            With .Borders(xlEdgeBottom)
                .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
            End With
        End With
        With ws.Cells(r, WS_COL_EDATE)
            .Interior.Color = CLR_BG_DARK: .Font.Color = CLR_TEXT_LIGHT
            .NumberFormat = "MM/DD"
            With .Borders(xlEdgeBottom)
                .lineStyle = xlContinuous: .Weight = xlThin: .Color = CLR_CYAN
            End With
        End With

        ws.Cells(r, WS_COL_SPINUP).Value = SPIN_UP_CHAR
        ws.Cells(r, WS_COL_SPINUP).Font.Size = 8
        ws.Cells(r, WS_COL_SPINUP).Font.Color = CLR_CYAN
        ws.Cells(r, WS_COL_SPINUP).HorizontalAlignment = xlCenter
        ws.Cells(r, WS_COL_SPINDN).Value = SPIN_DN_CHAR
        ws.Cells(r, WS_COL_SPINDN).Font.Size = 8
        ws.Cells(r, WS_COL_SPINDN).Font.Color = CLR_CYAN
        ws.Cells(r, WS_COL_SPINDN).HorizontalAlignment = xlCenter
    End If

    ' 간트바
    RenderFullProcGantt ws, r, snVal, snSts

    ws.Cells(r, META_TYPE).Value = RTYPE_SN
    ws.Cells(r, META_KEY1).Value = batchCode
    ws.Cells(r, META_KEY2).Value = snVal
    ws.Cells(r, META_PRDROW).Value = prdRow

    RenderSNRow = r + 1
    On Error GoTo 0
End Function
' ============================================================
'  RenderFullProcGantt: ProcLog 기반 전체 공정 간트바
'  각 공정을 고유 색상으로 연결 표시
'  완료=밝은초록, 진행=공정색(오늘이후 회색), 대기=흐린 공정색
' ============================================================
Private Sub RenderFullProcGantt(ws As Worksheet, rowNum As Long, _
                                 sn As String, curStatus As String)
    On Error Resume Next
    
    Dim baseDate  As Date: baseDate = GetGanttBaseDate(ws)
    Dim todayDate As Date: todayDate = Date
    
    Dim procName  As String
    Dim procSt    As String
    Dim sDate     As String
    Dim eDate     As String
    Dim dtStart   As Date
    Dim dtEnd     As Date
    Dim gc        As Long
    Dim colDate   As Date
    Dim isOverdue As Boolean
    
    ' ── 캐시가 있으면 캐시 사용 ──
    If IsCacheReady() Then
        Dim allProcs As Collection
        Set allProcs = GetCachedAllProcs(sn)
        
        If allProcs.count = 0 Then Exit Sub
        
        Dim pi As Long
        Dim procInfo As Object
        
        For pi = 1 To allProcs.count
            Set procInfo = allProcs(pi)
            
            procName = procInfo("proc")
            procSt = procInfo("status")
            sDate = procInfo("startDate")
            eDate = procInfo("planEnd")
            
            If Not SafeIsDate(sDate) Or Not SafeIsDate(eDate) Then GoTo NextCachedProc
            
            dtStart = CDate(sDate)
            dtEnd = CDate(eDate)
            
            For gc = GNT_START_COL To GNT_END_COL
                colDate = baseDate + (gc - GNT_TODAY_COL)
                
                If colDate >= dtStart And colDate <= dtEnd Then
                    Select Case procSt
                        Case ST_DONE
                            ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_COMPLETE
                        Case ST_PROG
                            If colDate <= todayDate Then
                                ws.Cells(rowNum, gc).Interior.Color = GetProcColor(procName)
                            Else
                                ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_REMAIN
                            End If
                        Case ST_DELAY
                            If colDate <= todayDate Then
                                ws.Cells(rowNum, gc).Interior.Color = GetProcColor(procName)
                            Else
                                ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_REMAIN
                            End If
                        Case Else
                            ws.Cells(rowNum, gc).Interior.Color = GetProcColorDim(procName)
                    End Select
                End If
                
                If (procSt = ST_PROG Or procSt = ST_DELAY) Then
                    If colDate > dtEnd And colDate <= todayDate Then
                        ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_OVERDUE
                    End If
                End If
            Next gc
NextCachedProc:
        Next pi
        
        Exit Sub
    End If
    
    ' ── fallback: 캐시 없으면 기존 방식 ──
    Dim wsPlog As Worksheet
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    
    Dim lastR As Long
    lastR = GetLastRow(wsPlog, PLOG_COL_LOGID)
    If lastR < PLOG_DATA_START Then Exit Sub
    
    Dim r As Long
    For r = PLOG_DATA_START To lastR
        If SafeStr(wsPlog.Cells(r, PLOG_COL_SN).Value) <> sn Then GoTo NextPLogFB
        
        procName = SafeStr(wsPlog.Cells(r, PLOG_COL_PROC).Value)
        procSt = SafeStr(wsPlog.Cells(r, PLOG_COL_STATUS).Value)
        sDate = SafeStr(wsPlog.Cells(r, PLOG_COL_SDATE).Value)
        eDate = SafeStr(wsPlog.Cells(r, PLOG_COL_PLANEND).Value)
        
        If Not SafeIsDate(sDate) Or Not SafeIsDate(eDate) Then GoTo NextPLogFB
        
        dtStart = CDate(sDate)
        dtEnd = CDate(eDate)
        
        For gc = GNT_START_COL To GNT_END_COL
            colDate = baseDate + (gc - GNT_TODAY_COL)
            
            If colDate >= dtStart And colDate <= dtEnd Then
                Select Case procSt
                    Case ST_DONE
                        ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_COMPLETE
                    Case ST_PROG
                        If colDate <= todayDate Then
                            ws.Cells(rowNum, gc).Interior.Color = GetProcColor(procName)
                        Else
                            ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_REMAIN
                        End If
                    Case ST_DELAY
                        If colDate <= todayDate Then
                            ws.Cells(rowNum, gc).Interior.Color = GetProcColor(procName)
                        Else
                            ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_REMAIN
                        End If
                    Case Else
                        ws.Cells(rowNum, gc).Interior.Color = GetProcColorDim(procName)
                End Select
            End If
            
            If (procSt = ST_PROG Or procSt = ST_DELAY) Then
                If colDate > dtEnd And colDate <= todayDate Then
                    ws.Cells(rowNum, gc).Interior.Color = CLR_BAR_OVERDUE
                End If
            End If
        Next gc
NextPLogFB:
    Next r
    On Error GoTo 0
End Sub

'============================================================
Private Function RenderProcessView(ws As Worksheet, wsProd As Worksheet, _
                                    startRow As Long, filterProc As String, _
                                    filterStatus As String, _
                                    Optional filterProduct As String = "", _
                                    Optional filterBatch As String = "", _
                                    Optional filterSN As String = "", _
                                    Optional filterEquip As String = "") As Long
    On Error Resume Next
    Dim lastPR As Long: lastPR = GetLastRow(wsProd, PROD_COL_SN)
    If lastPR < PROD_DATA_START Then RenderProcessView = startRow: Exit Function

    Dim procList As Variant: procList = Split(PROC_ORDER, ",")
    Dim r As Long: r = startRow
    Dim pi As Long

    For pi = 0 To UBound(procList)
        Dim procName As String: procName = procList(pi)

        If filterProc <> "" And filterProc <> "전체" Then
            If procName <> filterProc Then GoTo NextProcPV
        End If

        Dim pRows() As Long
        Dim pCount As Long: pCount = 0
        ReDim pRows(1 To lastPR)
        Dim ri As Long
        For ri = PROD_DATA_START To lastPR
            If SafeStr(wsProd.Cells(ri, PROD_COL_PROCESS).Value) = procName Then
                If PassFilter(wsProd, ri, filterProc, filterStatus, filterProduct, filterBatch, filterSN, filterEquip) Then
                    pCount = pCount + 1: pRows(pCount) = ri
                End If
            End If
        Next ri
        If pCount = 0 Then GoTo NextProcPV

        Dim procProgCnt As Long: procProgCnt = 0
        Dim procWaitCnt As Long: procWaitCnt = 0
        Dim procDoneCnt As Long: procDoneCnt = 0
        Dim si As Long
        For si = 1 To pCount
            Dim tmpSts As String: tmpSts = SafeStr(wsProd.Cells(pRows(si), PROD_COL_STATUS).Value)
            Select Case tmpSts
                Case ST_PROG, ST_DELAY: procProgCnt = procProgCnt + 1
                Case ST_WAIT: procWaitCnt = procWaitCnt + 1
                Case ST_DONE: procDoneCnt = procDoneCnt + 1
            End Select
        Next si

        Dim procKey As String: procKey = "PROC_" & procName
        Dim pExp As Boolean
        If dictToggle.Exists(procKey) Then
            pExp = dictToggle(procKey)
        Else
            pExp = False               ' ← 닫힘
            dictToggle(procKey) = False
        End If

        ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL)).Interior.Color = CLR_BG_DARK
        With ws.Cells(r, WS_COL_TOG).Borders(xlEdgeLeft)
            .lineStyle = xlContinuous: .Weight = xlThick: .Color = GetProcColor(procName)
        End With
        With ws.Cells(r, WS_COL_TOG)
            If pExp Then .Value = TOGGLE_COLLAPSE Else .Value = TOGGLE_EXPAND
            .Font.Size = 10: .Font.Color = GetProcColor(procName): .HorizontalAlignment = xlCenter
        End With
        With ws.Cells(r, WS_COL_MAIN)
            .Value = procName
            .Font.Size = 11: .Font.Bold = True: .Font.Color = GetProcColor(procName)
        End With
        With ws.Cells(r, WS_COL_QTY)
            .Value = pCount & "매"
            .Font.Size = 9: .Font.Bold = True: .Font.Color = CLR_TEXT_LIGHT
            .HorizontalAlignment = xlCenter
        End With
        Dim procSummary As String: procSummary = ""
        If procProgCnt > 0 Then procSummary = procSummary & "진행" & procProgCnt & " "
        If procWaitCnt > 0 Then procSummary = procSummary & "대기" & procWaitCnt & " "
        If procDoneCnt > 0 Then procSummary = procSummary & "완료" & procDoneCnt
        With ws.Cells(r, WS_COL_STATUS)
            .Value = Trim(procSummary)
            .Font.Size = 8: .Font.Color = CLR_TEXT_HINT: .HorizontalAlignment = xlCenter
        End With

        DrawRowBottomBorder ws, r, CLR_TEXT_DIM
        ws.Cells(r, META_TYPE).Value = RTYPE_PROC_GROUP
        ws.Cells(r, META_KEY1).Value = procKey
        r = r + 1

        If pExp Then
            Dim equipDict As Object: Set equipDict = CreateObject("Scripting.Dictionary")
            Dim equipNames() As String
            Dim equipCnt As Long: equipCnt = 0

            For si = 1 To pCount
                Dim eqName As String
                eqName = SafeStr(wsProd.Cells(pRows(si), PROD_COL_EQUIP).Value)
                If eqName = "" Then eqName = "(미배정)"

                If Not equipDict.Exists(eqName) Then
                    Dim eInfo As Object
                    Set eInfo = CreateObject("Scripting.Dictionary")
                    eInfo.Add "rows", Array()
                    eInfo.Add "count", CLng(0)
                    equipDict.Add eqName, eInfo
                    equipCnt = equipCnt + 1
                End If

                Dim eCnt As Long: eCnt = equipDict(eqName)("count") + 1
                equipDict(eqName)("count") = eCnt
                Dim eArr() As Long: ReDim eArr(1 To eCnt)
                If eCnt > 1 Then
                    Dim pA As Variant: pA = equipDict(eqName)("rows")
                    Dim ei As Long
                    For ei = LBound(pA) To UBound(pA): eArr(ei) = pA(ei): Next ei
                End If
                eArr(eCnt) = pRows(si)
                equipDict(eqName)("rows") = eArr
            Next si

            ReDim equipNames(0 To equipCnt - 1)
            Dim eKey As Variant
            Dim idx As Long: idx = 0
            For Each eKey In equipDict.keys
                equipNames(idx) = CStr(eKey)
                idx = idx + 1
            Next eKey

            Dim ti As Long, tj As Long, tmp As String
            For ti = 0 To equipCnt - 2
                For tj = ti + 1 To equipCnt - 1
                    If equipNames(tj) < equipNames(ti) Then
                        tmp = equipNames(ti)
                        equipNames(ti) = equipNames(tj)
                        equipNames(tj) = tmp
                    End If
                Next tj
            Next ti

            Dim eIdx As Long
            For eIdx = 0 To equipCnt - 1
                Dim equipNameStr As String: equipNameStr = equipNames(eIdx)
                Dim equipRows As Variant: equipRows = equipDict(equipNameStr)("rows")
                Dim equipRowCnt As Long: equipRowCnt = equipDict(equipNameStr)("count")

                Dim eMinD As Date, eMaxD As Date, eHasD As Boolean: eHasD = False
                Dim eProgCnt As Long: eProgCnt = 0
                Dim eWaitCnt As Long: eWaitCnt = 0
                Dim eDoneCnt As Long: eDoneCnt = 0
                Dim esD As String, eeD As String, eSts As String

                For ei = LBound(equipRows) To UBound(equipRows)
                    eSts = SafeStr(wsProd.Cells(CLng(equipRows(ei)), PROD_COL_STATUS).Value)
                    Select Case eSts
                        Case ST_PROG, ST_DELAY: eProgCnt = eProgCnt + 1
                        Case ST_WAIT: eWaitCnt = eWaitCnt + 1
                        Case ST_DONE: eDoneCnt = eDoneCnt + 1
                    End Select
                    esD = SafeStr(wsProd.Cells(CLng(equipRows(ei)), PROD_COL_START).Value)
                    eeD = SafeStr(wsProd.Cells(CLng(equipRows(ei)), PROD_COL_END).Value)
                    If SafeIsDate(esD) Then
                        If Not eHasD Then eMinD = CDate(esD): eMaxD = eMinD: eHasD = True
                        If CDate(esD) < eMinD Then eMinD = CDate(esD)
                    End If
                    If SafeIsDate(eeD) And eHasD Then
                        If CDate(eeD) > eMaxD Then eMaxD = CDate(eeD)
                    End If
                Next ei

                ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL)).Interior.Color = CLR_BG_DARK
                With ws.Cells(r, WS_COL_TOG).Borders(xlEdgeLeft)
                    .lineStyle = xlContinuous: .Weight = xlThin: .Color = GetProcColor(procName)
                End With
                With ws.Cells(r, WS_COL_MAIN)
                    .Value = "  " & equipNameStr
                    .Font.Size = 10: .Font.Bold = True: .Font.Color = CLR_TEXT_LIGHT
                End With
                With ws.Cells(r, WS_COL_QTY)
                    .Value = equipRowCnt & "매"
                    .Font.Size = 9: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
                End With

                Dim eqSummary As String: eqSummary = ""
                If eProgCnt > 0 Then eqSummary = eqSummary & "진행" & eProgCnt & " "
                If eWaitCnt > 0 Then eqSummary = eqSummary & "대기" & eWaitCnt
                With ws.Cells(r, WS_COL_STATUS)
                    .Value = Trim(eqSummary)
                    .Font.Size = 8: .Font.Color = CLR_TEXT_HINT: .HorizontalAlignment = xlCenter
                End With

                If eHasD Then
                    ws.Cells(r, WS_COL_SDATE).Value = Format(eMinD, "MM-DD")
                    ws.Cells(r, WS_COL_EDATE).Value = Format(eMaxD, "MM-DD")
                    ws.Cells(r, WS_COL_SDATE).Font.Size = 8
                    ws.Cells(r, WS_COL_SDATE).Font.Color = CLR_TEXT_HINT
                    ws.Cells(r, WS_COL_SDATE).HorizontalAlignment = xlCenter
                    ws.Cells(r, WS_COL_EDATE).Font.Size = 8
                    ws.Cells(r, WS_COL_EDATE).Font.Color = CLR_TEXT_HINT
                    ws.Cells(r, WS_COL_EDATE).HorizontalAlignment = xlCenter

                    Dim eDPlus As Long: eDPlus = Date - eMinD
                    If eDPlus > 0 Then
                        ws.Cells(r, WS_COL_DPLUS).Value = "D+" & eDPlus
                        ws.Cells(r, WS_COL_DPLUS).Font.Size = 8
                        ws.Cells(r, WS_COL_DPLUS).HorizontalAlignment = xlCenter
                        If eDPlus > 7 Then
                            ws.Cells(r, WS_COL_DPLUS).Font.Color = CLR_RED
                        Else
                            ws.Cells(r, WS_COL_DPLUS).Font.Color = CLR_TEXT_HINT
                        End If
                    End If
                End If

                DrawRowBottomBorder ws, r, CLR_BG_LIGHT
                ws.Cells(r, META_TYPE).Value = RTYPE_EQUIP
                ws.Cells(r, META_KEY1).Value = procKey
                ws.Cells(r, META_KEY2).Value = equipNameStr
                r = r + 1

                ' 진행중 제품 요약
                Dim prodCntDict As Object: Set prodCntDict = CreateObject("Scripting.Dictionary")
                Dim pn2 As String, pSts2 As String

                For ei = LBound(equipRows) To UBound(equipRows)
                    pSts2 = SafeStr(wsProd.Cells(CLng(equipRows(ei)), PROD_COL_STATUS).Value)
                    If pSts2 = ST_PROG Or pSts2 = ST_DELAY Then
                        pn2 = SafeStr(wsProd.Cells(CLng(equipRows(ei)), PROD_COL_PRODUCT).Value)
                        If pn2 = "" Then pn2 = "(미지정)"
                        If Not prodCntDict.Exists(pn2) Then prodCntDict.Add pn2, CLng(0)
                        prodCntDict(pn2) = prodCntDict(pn2) + 1
                    End If
                Next ei

                If prodCntDict.count > 0 Then
                    ws.Range(ws.Cells(r, WS_COL_CHK), ws.Cells(r, GNT_END_COL)).Interior.Color = CLR_BG_DARK

                    Dim pSummaryStr As String: pSummaryStr = "    "
                    Dim pk2 As Variant
                    For Each pk2 In prodCntDict.keys
                        pSummaryStr = pSummaryStr & CStr(pk2) & " " & prodCntDict(pk2) & "매  "
                    Next pk2

                    With ws.Cells(r, WS_COL_MAIN)
                        .Value = pSummaryStr
                        .Font.Size = 9: .Font.Color = CLR_TEXT_HINT
                    End With

                    If eHasD Then
                        Dim firstEqSN As String
                        firstEqSN = SafeStr(wsProd.Cells(CLng(equipRows(LBound(equipRows))), PROD_COL_SN).Value)
                        RenderFullProcGantt ws, r, firstEqSN, ST_PROG
                    End If

                    ws.Cells(r, META_TYPE).Value = RTYPE_PROD_SUMMARY
                    r = r + 1
                End If

            Next eIdx
        End If
NextProcPV:
    Next pi
    RenderProcessView = r
    On Error GoTo 0
End Function
' ============================================================
'  모드 진입 / 해제 / 적용
' ============================================================
Public Sub EnterEditMode()
    InitWSChars
    g_CurrentMode = MODE_EDIT
    Set dictCheck = CreateObject("Scripting.Dictionary")
    BuildAccordion
End Sub

Public Sub EnterScrapMode()
    InitWSChars
    g_CurrentMode = MODE_SCRAP
    Set dictCheck = CreateObject("Scripting.Dictionary")
    BuildAccordion
End Sub

Public Sub ExitMode()
    InitWSChars
    g_CurrentMode = MODE_NONE
    Set dictCheck = CreateObject("Scripting.Dictionary")
    BuildAccordion
End Sub

Public Sub ApplyMode()
    Select Case g_CurrentMode
        Case MODE_EDIT:  ProcessEdit
        Case MODE_SCRAP: ProcessScrap
        Case MODE_NG:    EnterNGMode
    End Select
End Sub

' ============================================================
'  HandleWSSelectionChange
' ============================================================
Public Sub HandleWSSelectionChange(Target As Range)
    InitWSChars
    If g_EventsDisabled Then Exit Sub
    On Error Resume Next

    Dim ws  As Worksheet: Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    Dim r   As Long: r = Target.row
    Dim c   As Long: c = Target.Column

    If r = WS_ROW_MODEBAR Then
        If c = WS_COL_SDATE Then ExitMode: Exit Sub
        If c = WS_COL_EDATE Then ApplyMode: Exit Sub
        Exit Sub
    End If

    If r < WS_DATA_START Then Exit Sub

    Dim metaType As String: metaType = SafeStr(ws.Cells(r, META_TYPE).Value)
    Dim inMode   As Boolean: inMode = (g_CurrentMode <> "" And g_CurrentMode <> MODE_NONE)

    If c = WS_COL_CHK And inMode Then
        HandleCheckClick ws, r, metaType
        Exit Sub
    End If

    If c = WS_COL_TOG Then
        HandleToggleClick ws, r, metaType
        Exit Sub
    End If

    If (c = WS_COL_SPINUP Or c = WS_COL_SPINDN) And inMode Then
        Dim offset As Long
        offset = IIf(c = WS_COL_SPINUP, 1, -1)
        If metaType = RTYPE_SN Then
            SpinDateWithBulk ws, r, offset
        ElseIf metaType = RTYPE_PRODUCT And g_CurrentMode = MODE_EDIT Then
            SpinProductDates ws, r, offset
        End If
        If c = WS_COL_SPINUP Then
            ws.Cells(r, c - 1).Select
        Else
            ws.Cells(r, c + 1).Select
        End If
        Exit Sub
    End If

    ' 간트 클릭 → 크로스 하이라이트 ★ 테두리만 사용
     If c >= GNT_START_COL And c <= GNT_END_COL And r >= WS_DATA_START Then
        RestoreCrossHighlight ws

        Dim ganttClickDate As Date
        ganttClickDate = GetGanttBaseDate(ws) + (c - GNT_TODAY_COL)

        '── 제품/S/N 행: 메인 텍스트 노란색 강조 ──
        If metaType = RTYPE_PRODUCT Or metaType = RTYPE_SN Then
            ws.Cells(r, WS_COL_MAIN).Font.Color = CLR_YELLOW
        End If

        '── 헤더 컬럼 강조 ──
        ws.Cells(WS_ROW_FILTER, c).Font.Color = CLR_YELLOW
        ws.Cells(WS_ROW_FILTER, c).Font.Bold = True
        ws.Cells(WS_ROW_GANTT_DOW, c).Font.Color = CLR_YELLOW
        ws.Cells(WS_ROW_GANTT_DOW, c).Font.Bold = True

        ws.Cells(1, META_CROSS_R).Value = r
        ws.Cells(1, META_CROSS_C).Value = c

        Dim clickPN As String: clickPN = Trim(SafeStr(ws.Cells(r, WS_COL_MAIN).Value))
        Dim clickSD As String: clickSD = SafeStr(ws.Cells(r, WS_COL_SDATE).Value)
        Dim clickED As String: clickED = SafeStr(ws.Cells(r, WS_COL_EDATE).Value)
        Application.StatusBar = Format(ganttClickDate, "YYYY-MM-DD") & _
            " (" & Choose(Weekday(ganttClickDate, vbMonday), _
            "월", "화", "수", "목", "금", "토", "일") & ")" & _
            " | " & clickPN & " | " & clickSD & " ~ " & clickED
    Else
        RestoreCrossHighlight ws
        Application.StatusBar = False
    End If
    On Error GoTo 0
End Sub

' ============================================================
'  RestoreCrossHighlight  ★ v12.2: 모든 행 타입별 원래 색상 완벽 복원
' ============================================================
Private Sub RestoreCrossHighlight(ws As Worksheet)
    On Error Resume Next
    Dim prevR As Long: prevR = SafeLng(ws.Cells(1, META_CROSS_R).Value)
    Dim prevC As Long: prevC = SafeLng(ws.Cells(1, META_CROSS_C).Value)
    If prevR = 0 And prevC = 0 Then Exit Sub

    Dim evtState As Boolean: evtState = Application.EnableEvents
    Application.EnableEvents = False

    '??????????????????????????????????????????????????????????
    ' [1] 메인 텍스트(WS_COL_MAIN) 색상 복원
    '??????????????????????????????????????????????????????????
    If prevR >= WS_DATA_START Then
        Dim prevType As String: prevType = SafeStr(ws.Cells(prevR, META_TYPE).Value)

        Select Case prevType

        '── 배치행: CLR_TEXT_WHITE (15658734) ──
        Case RTYPE_BATCH
            ws.Cells(prevR, WS_COL_MAIN).Font.Color = CLR_TEXT_WHITE

        '── 제품행: GetTypeColor(제품타입) ──
        Case RTYPE_PRODUCT
            Dim pType As String: pType = ""
            Dim bCodeR As String: bCodeR = SafeStr(ws.Cells(prevR, META_KEY1).Value)
            Dim pNameR As String: pNameR = SafeStr(ws.Cells(prevR, META_KEY2).Value)
            Dim wsProdR As Worksheet: Set wsProdR = ThisWorkbook.sheets(SHT_PRODUCTION)

            ' ── 1차: 아래쪽 S/N 행에서 prdRow 참조 (펼침 상태) ──
            Dim wsLrR As Long: wsLrR = GetLastRow(ws, WS_COL_MAIN)
            Dim foundType As Boolean: foundType = False
            Dim searchR As Long

            For searchR = prevR + 1 To wsLrR
                Dim srType As String: srType = SafeStr(ws.Cells(searchR, META_TYPE).Value)
                If srType = RTYPE_SN And SafeStr(ws.Cells(searchR, META_KEY1).Value) = bCodeR Then
                    Dim prdRowR As Long: prdRowR = SafeLng(ws.Cells(searchR, META_PRDROW).Value)
                    If prdRowR > 0 Then
                        pType = SafeStr(wsProdR.Cells(prdRowR, PROD_COL_TYPE).Value)
                        foundType = True
                    End If
                    Exit For
                ElseIf srType <> RTYPE_SN Then
                    Exit For
                End If
            Next searchR

            ' ── 2차: Production 시트 직접 검색 (접힘 상태) ──
            If Not foundType Then
                Dim prodLR As Long: prodLR = GetLastRow(wsProdR, PROD_COL_SN)
                Dim pr As Long
                For pr = PROD_DATA_START To prodLR
                    If SafeStr(wsProdR.Cells(pr, PROD_COL_BATCH).Value) = bCodeR Then
                        If SafeStr(wsProdR.Cells(pr, PROD_COL_PRODUCT).Value) = pNameR Then
                            pType = SafeStr(wsProdR.Cells(pr, PROD_COL_TYPE).Value)
                            foundType = True
                            Exit For
                        End If
                    End If
                Next pr
            End If

            ws.Cells(prevR, WS_COL_MAIN).Font.Color = GetTypeColor(pType)

        '── S/N행: CLR_TEXT_LIGHT (12632256) ──
        Case RTYPE_SN
            ws.Cells(prevR, WS_COL_MAIN).Font.Color = CLR_TEXT_LIGHT

        '── 공정뷰 공정그룹행: GetProcColor(공정명) ──
        Case RTYPE_PROC_GROUP
            Dim procKeyR As String: procKeyR = SafeStr(ws.Cells(prevR, META_KEY1).Value)
            ' META_KEY1 = "PROC_탈지" 형태 → "PROC_" 제거
            Dim procNmR As String: procNmR = Mid(procKeyR, 6)
            ws.Cells(prevR, WS_COL_MAIN).Font.Color = GetProcColor(procNmR)

        '── 설비행: CLR_TEXT_LIGHT (12632256) ──
        Case RTYPE_EQUIP
            ws.Cells(prevR, WS_COL_MAIN).Font.Color = CLR_TEXT_LIGHT

        '── 제품요약행: CLR_TEXT_HINT (8421504) ──
        Case RTYPE_PROD_SUMMARY
            ws.Cells(prevR, WS_COL_MAIN).Font.Color = CLR_TEXT_HINT

        '── 기타 (혹시 누락된 타입) ──
        Case Else
            ws.Cells(prevR, WS_COL_MAIN).Font.Color = CLR_TEXT_LIGHT

        End Select
    End If

    '??????????????????????????????????????????????????????????
    ' [2] 간트 헤더 날짜/요일 색상 복원
    '??????????????????????????????????????????????????????????
    If prevC >= GNT_START_COL And prevC <= GNT_END_COL Then
        Dim baseDate As Date: baseDate = GetGanttBaseDate(ws)
        Dim colDate  As Date: colDate = baseDate + (prevC - GNT_TODAY_COL)
        Dim isToday  As Boolean: isToday = (colDate = Date)
        Dim isSun    As Boolean: isSun = (Weekday(colDate, vbMonday) = 7)
        Dim isSat    As Boolean: isSat = (Weekday(colDate, vbMonday) = 6)

        ' 날짜행 (WS_ROW_FILTER = 7)
        With ws.Cells(WS_ROW_FILTER, prevC)
            .Font.Size = 9
            .Font.Name = TITLE_FONT_NAME
            .Font.Bold = isToday
            If isToday Then
                .Font.Color = CLR_RED       ' 4474111
            ElseIf isSun Then
                .Font.Color = CLR_RED       ' 4474111
            ElseIf isSat Then
                .Font.Color = CLR_BLUE      ' 14912512
            Else
                .Font.Color = CLR_TEXT_HINT  ' 8421504
            End If
        End With

        ' 요일행 (WS_ROW_GANTT_DOW = 8)
        With ws.Cells(WS_ROW_GANTT_DOW, prevC)
            .Font.Size = 8
            .Font.Name = TITLE_FONT_NAME
            .Font.Bold = isToday
            If isToday Then
                .Font.Color = CLR_RED
            ElseIf isSun Then
                .Font.Color = CLR_RED
            ElseIf isSat Then
                .Font.Color = CLR_BLUE
            Else
                .Font.Color = CLR_TEXT_HINT
            End If
        End With
    End If

    '??????????????????????????????????????????????????????????
    ' [3] 크로스 좌표 초기화
    '??????????????????????????????????????????????????????????
    ws.Cells(1, META_CROSS_R).ClearContents
    ws.Cells(1, META_CROSS_C).ClearContents
    Application.EnableEvents = evtState
    On Error GoTo 0
End Sub

' ============================================================
'  HandleCheckClick
' ============================================================
Private Sub HandleCheckClick(ws As Worksheet, r As Long, metaType As String)
    On Error Resume Next
    ws.Cells(r, WS_COL_CHK).offset(0, -1).Select
    On Error GoTo 0

    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim inEdit As Boolean: inEdit = (g_CurrentMode = MODE_EDIT)

    Application.EnableEvents = False
    Application.ScreenUpdating = False

    Select Case metaType
    Case RTYPE_BATCH
        Dim bCode  As String: bCode = SafeStr(ws.Cells(r, META_KEY1).Value)
        Dim bAllOn As Boolean: bAllOn = IsAllCheckedForBatch(wsProd, bCode)
        SetCheckForBatch wsProd, bCode, Not bAllOn

        If inEdit Then
            ' ★ 편집모드: 화면만 갱신, BuildAccordion 안 함
            UpdateCheckDisplayForBatch ws, wsProd, bCode
        Else
            BuildAccordion
        End If

    Case RTYPE_PRODUCT
        Dim pBatch As String: pBatch = SafeStr(ws.Cells(r, META_KEY1).Value)
        Dim pName  As String: pName = SafeStr(ws.Cells(r, META_KEY2).Value)
        Dim pAllOn As Boolean: pAllOn = IsAllCheckedForProduct(wsProd, pBatch, pName)
        SetCheckForProduct wsProd, pBatch, pName, Not pAllOn

        If inEdit Then
            UpdateCheckDisplayForProduct ws, wsProd, pBatch, pName
        Else
            BuildAccordion
        End If

    Case RTYPE_SN
        Dim snVal  As String: snVal = SafeStr(ws.Cells(r, META_KEY2).Value)
        Dim prdRow As Long: prdRow = SafeLng(ws.Cells(r, META_PRDROW).Value)
        If Not CanCheckInMode(wsProd, prdRow) Then GoTo ChkDone
        Dim wasOn As Boolean: wasOn = False
        If dictCheck.Exists(snVal) Then wasOn = dictCheck(snVal)
        If dictCheck.Exists(snVal) Then
            dictCheck(snVal) = Not wasOn
        Else
            dictCheck.Add snVal, True
        End If

        If inEdit Then
            ' ★ 편집모드: 해당 행 체크 표시만 변경
            UpdateCheckDisplayForSN ws, r, snVal
        Else
            BuildAccordion
        End If
    End Select

ChkDone:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
End Sub

' ============================================================
'  ★ 새 함수: 편집모드 체크 표시 갱신 (BuildAccordion 없이)
' ============================================================

' ── S/N 행 체크 표시만 갱신 ──
Private Sub UpdateCheckDisplayForSN(ws As Worksheet, r As Long, snVal As String)
    Dim isChecked As Boolean: isChecked = False
    If dictCheck.Exists(snVal) Then isChecked = dictCheck(snVal)

    With ws.Cells(r, WS_COL_CHK)
        If isChecked Then
            .Value = CHECK_ON
            .Font.Color = CLR_CYAN
        Else
            .Value = CHECK_OFF
            .Font.Color = CLR_TEXT_HINT
        End If
        .Font.Size = 11
        .HorizontalAlignment = xlCenter
    End With

    ' 좌측 테두리 강조
    If isChecked Then
        With ws.Cells(r, WS_COL_CHK).Borders(xlEdgeLeft)
            .lineStyle = xlContinuous: .Weight = xlMedium: .Color = CLR_CYAN
        End With
    Else
        ws.Cells(r, WS_COL_CHK).Borders(xlEdgeLeft).lineStyle = xlNone
    End If
End Sub

' ── 배치 하위 전체 체크 표시 갱신 ──
Private Sub UpdateCheckDisplayForBatch(ws As Worksheet, wsProd As Worksheet, bCode As String)
    Dim wsLr As Long: wsLr = GetLastRow(ws, WS_COL_MAIN)
    Dim ri As Long
    Dim mT As String
    Dim snVal As String

    For ri = WS_DATA_START To wsLr
        mT = SafeStr(ws.Cells(ri, META_TYPE).Value)

        ' 배치행 체크 표시
        If mT = RTYPE_BATCH And SafeStr(ws.Cells(ri, META_KEY1).Value) = bCode Then
            Dim bAllChk As Boolean: bAllChk = IsAllCheckedForBatch(wsProd, bCode)
            With ws.Cells(ri, WS_COL_CHK)
                If bAllChk Then .Value = CHECK_ON Else .Value = CHECK_OFF
                .Font.Size = 12: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
            End With
        End If

        ' 제품행 체크 표시
        If mT = RTYPE_PRODUCT And SafeStr(ws.Cells(ri, META_KEY1).Value) = bCode Then
            Dim pName As String: pName = SafeStr(ws.Cells(ri, META_KEY2).Value)
            Dim pAllChk As Boolean: pAllChk = IsAllCheckedForProduct(wsProd, bCode, pName)
            With ws.Cells(ri, WS_COL_CHK)
                If pAllChk Then .Value = CHECK_ON Else .Value = CHECK_OFF
                .Font.Size = 11: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
            End With
        End If

        ' S/N행 체크 표시
        If mT = RTYPE_SN And SafeStr(ws.Cells(ri, META_KEY1).Value) = bCode Then
            snVal = SafeStr(ws.Cells(ri, META_KEY2).Value)
            UpdateCheckDisplayForSN ws, ri, snVal
        End If
    Next ri
End Sub

' ── 제품 하위 체크 표시 갱신 ──
Private Sub UpdateCheckDisplayForProduct(ws As Worksheet, wsProd As Worksheet, _
                                          bCode As String, prodName As String)
    Dim wsLr As Long: wsLr = GetLastRow(ws, WS_COL_MAIN)
    Dim ri As Long
    Dim mT As String
    Dim snVal As String

    For ri = WS_DATA_START To wsLr
        mT = SafeStr(ws.Cells(ri, META_TYPE).Value)

        ' 해당 제품행 체크 표시
        If mT = RTYPE_PRODUCT And SafeStr(ws.Cells(ri, META_KEY1).Value) = bCode _
           And SafeStr(ws.Cells(ri, META_KEY2).Value) = prodName Then
            Dim pAllChk As Boolean: pAllChk = IsAllCheckedForProduct(wsProd, bCode, prodName)
            With ws.Cells(ri, WS_COL_CHK)
                If pAllChk Then .Value = CHECK_ON Else .Value = CHECK_OFF
                .Font.Size = 11: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
            End With
        End If

        ' 해당 제품의 S/N행 체크 표시
        If mT = RTYPE_SN And SafeStr(ws.Cells(ri, META_KEY1).Value) = bCode Then
            Dim snPrdRow As Long: snPrdRow = SafeLng(ws.Cells(ri, META_PRDROW).Value)
            If snPrdRow > 0 Then
                If SafeStr(wsProd.Cells(snPrdRow, PROD_COL_PRODUCT).Value) = prodName Then
                    snVal = SafeStr(ws.Cells(ri, META_KEY2).Value)
                    UpdateCheckDisplayForSN ws, ri, snVal
                End If
            End If
        End If
    Next ri

    ' 상위 배치행도 갱신
    For ri = WS_DATA_START To wsLr
        mT = SafeStr(ws.Cells(ri, META_TYPE).Value)
        If mT = RTYPE_BATCH And SafeStr(ws.Cells(ri, META_KEY1).Value) = bCode Then
            Dim bAllChk As Boolean: bAllChk = IsAllCheckedForBatch(wsProd, bCode)
            With ws.Cells(ri, WS_COL_CHK)
                If bAllChk Then .Value = CHECK_ON Else .Value = CHECK_OFF
                .Font.Size = 12: .Font.Color = CLR_TEXT_LIGHT: .HorizontalAlignment = xlCenter
            End With
            Exit For
        End If
    Next ri
End Sub

' ── 체크 헬퍼 ──
Private Function IsAllCheckedForBatch(wsProd As Worksheet, bCode As String) As Boolean
    IsAllCheckedForBatch = True
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_SN)
    Dim r  As Long
    Dim sn As String
    For r = PROD_DATA_START To lr
        If SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value) = bCode Then
            If CanCheckInMode(wsProd, r) Then
                sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
                If dictCheck.Exists(sn) Then
                    If Not dictCheck(sn) Then IsAllCheckedForBatch = False: Exit Function
                Else
                    IsAllCheckedForBatch = False: Exit Function
                End If
            End If
        End If
    Next r
End Function

Private Sub SetCheckForBatch(wsProd As Worksheet, bCode As String, val As Boolean)
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_SN)
    Dim r  As Long
    Dim sn As String
    For r = PROD_DATA_START To lr
        If SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value) = bCode Then
            If CanCheckInMode(wsProd, r) Then
                sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
                If dictCheck.Exists(sn) Then dictCheck(sn) = val _
                Else: dictCheck.Add sn, val
            End If
        End If
    Next r
End Sub

Private Function IsAllCheckedForProduct(wsProd As Worksheet, bCode As String, _
                                         pName As String) As Boolean
    IsAllCheckedForProduct = True
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_SN)
    Dim r  As Long
    Dim sn As String
    For r = PROD_DATA_START To lr
        If SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value) = bCode And _
           SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value) = pName Then
            If CanCheckInMode(wsProd, r) Then
                sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
                If dictCheck.Exists(sn) Then
                    If Not dictCheck(sn) Then IsAllCheckedForProduct = False: Exit Function
                Else
                    IsAllCheckedForProduct = False: Exit Function
                End If
            End If
        End If
    Next r
End Function

Private Sub SetCheckForProduct(wsProd As Worksheet, bCode As String, _
                                pName As String, val As Boolean)
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_SN)
    Dim r  As Long
    Dim sn As String
    For r = PROD_DATA_START To lr
        If SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value) = bCode And _
           SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value) = pName Then
            If CanCheckInMode(wsProd, r) Then
                sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
                If dictCheck.Exists(sn) Then dictCheck(sn) = val _
                Else: dictCheck.Add sn, val
            End If
        End If
    Next r
End Sub

' ============================================================
'  HandleToggleClick
' ============================================================
Private Sub HandleToggleClick(ws As Worksheet, r As Long, metaType As String)
    On Error Resume Next
    If dictToggle Is Nothing Then Set dictToggle = CreateObject("Scripting.Dictionary")

    Dim tKey As String
    Select Case metaType
        Case RTYPE_BATCH:      tKey = SafeStr(ws.Cells(r, META_KEY1).Value)
        Case RTYPE_PRODUCT:    tKey = SafeStr(ws.Cells(r, META_KEY3).Value)
        Case RTYPE_PROC_GROUP: tKey = SafeStr(ws.Cells(r, META_KEY1).Value)
        Case Else: Exit Sub
    End Select
    If tKey = "" Then Exit Sub

    If dictToggle.Exists(tKey) Then
        dictToggle(tKey) = Not dictToggle(tKey)
    Else
        dictToggle.Add tKey, False
    End If

    BuildAccordion

    On Error Resume Next
    ws.Cells(r, WS_COL_TOG + 1).Select
    On Error GoTo 0
End Sub

' ============================================================
'  HandleWSChange
' ============================================================
Public Sub HandleWSChange(Target As Range)
    InitWSChars
    If m_BulkUpdating Then Exit Sub
    If g_EventsDisabled Then Exit Sub
    On Error Resume Next

    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    Dim r  As Long: r = Target.row
    Dim c  As Long: c = Target.Column
    
    ' ★ 필터행 변경 시 즉시 반영 + 연동
    If r = WS_ROW_FILTER Then
        If c >= FLT_COL_VIEW And c <= FLT_COL_STATUS Then
            Application.EnableEvents = False
            
            If c = FLT_COL_PRODUCT Then
                ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value = "전체"
                ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value = "전체"
                BuildBatchFilterList ws, SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value)
                BuildSNFilterList ws, SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value), "전체"
            End If
            
            If c = FLT_COL_BATCH Then
                ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value = "전체"
                BuildSNFilterList ws, SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value), _
                                      SafeStr(ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value)
            End If
            
            BuildAccordion
            Application.EnableEvents = True
            Exit Sub
        End If
    End If

    If r < WS_DATA_START Then Exit Sub
    If g_CurrentMode = "" Or g_CurrentMode = MODE_NONE Then Exit Sub

    Dim metaType As String: metaType = SafeStr(ws.Cells(r, META_TYPE).Value)
    Dim newVal   As String: newVal = SafeStr(ws.Cells(r, c).Value)
    Dim wsProd   As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)

    m_BulkUpdating = True
    Application.EnableEvents = False

    ' ── 제품행 변경 → 하위 S/N 전체 일괄 반영 ──
    If metaType = RTYPE_PRODUCT And g_CurrentMode = MODE_EDIT Then
        Dim batchKey As String: batchKey = SafeStr(ws.Cells(r, META_KEY1).Value)
        Dim wsLr     As Long: wsLr = GetLastRow(ws, WS_COL_MAIN)
        Dim sri      As Long

        If c = WS_COL_PROC Then
            Dim firstChild As Long: firstChild = r + 1
            Dim prodPType  As String: prodPType = ""
            If firstChild <= wsLr Then
                If SafeStr(ws.Cells(firstChild, META_TYPE).Value) = RTYPE_SN Then
                    Dim fpRow As Long: fpRow = SafeLng(ws.Cells(firstChild, META_PRDROW).Value)
                    If fpRow > 0 Then prodPType = SafeStr(wsProd.Cells(fpRow, PROD_COL_TYPE).Value)
                End If
            End If
            Dim prodNewEqList As String
            prodNewEqList = GetEquipListForProc(newVal, prodPType)
            If Len(prodNewEqList) > 0 Then AddDataValidation ws.Cells(r, WS_COL_EQUIP), prodNewEqList
            Dim prodAutoEq As String: prodAutoEq = GetAutoEquip(newVal, prodPType)
            If prodAutoEq <> "" Then
                ws.Cells(r, WS_COL_EQUIP).Value = prodAutoEq
            Else
                ws.Cells(r, WS_COL_EQUIP).Value = ""
            End If
        End If

        Dim snPrdRow As Long
        Dim tmpEnd As Date
        
        For sri = r + 1 To wsLr
            If SafeStr(ws.Cells(sri, META_TYPE).Value) <> RTYPE_SN Then Exit For
            If SafeStr(ws.Cells(sri, META_KEY1).Value) <> batchKey Then Exit For

            snPrdRow = SafeLng(ws.Cells(sri, META_PRDROW).Value)
            If snPrdRow = 0 Then GoTo NextProdChild

            Dim cType As String
            Dim cStk  As Long
            Dim cDC   As String

            Select Case c
                Case WS_COL_PROC
                    ws.Cells(sri, WS_COL_PROC).Value = newVal
                    cType = SafeStr(wsProd.Cells(snPrdRow, PROD_COL_TYPE).Value)
                    Dim cEqList As String: cEqList = GetEquipListForProc(newVal, cType)
                    If Len(cEqList) > 0 Then AddDataValidation ws.Cells(sri, WS_COL_EQUIP), cEqList
                    Dim cAutoEq As String: cAutoEq = GetAutoEquip(newVal, cType)
                    If cAutoEq <> "" Then
                        ws.Cells(sri, WS_COL_EQUIP).Value = cAutoEq
                    Else
                        ws.Cells(sri, WS_COL_EQUIP).Value = ""
                    End If
                    If SafeIsDate(ws.Cells(sri, WS_COL_SDATE).Value) Then
                        cStk = SafeLng(wsProd.Cells(snPrdRow, PROD_COL_STACK).Value)
                        cDC = SafeStr(wsProd.Cells(snPrdRow, PROD_COL_DC).Value)
                        Dim cDaysP As Long: cDaysP = GetProcDays(newVal, cType, cStk, cDC)
                        tmpEnd = CDate(ws.Cells(sri, WS_COL_SDATE).Value) + cDaysP
                        tmpEnd = AdjustToWeekday(tmpEnd)
                        ws.Cells(sri, WS_COL_EDATE).Value = FmtDate(tmpEnd)
                    End If

                Case WS_COL_EQUIP
                    ws.Cells(sri, WS_COL_EQUIP).Value = newVal

                Case WS_COL_STATUS
                    ws.Cells(sri, WS_COL_STATUS).Value = newVal
                    FormatBadgeCell ws.Cells(sri, WS_COL_STATUS), newVal
                    
                Case WS_COL_SDATE
                    ws.Cells(sri, WS_COL_SDATE).Value = newVal
                    If SafeIsDate(newVal) Then
                        cType = SafeStr(wsProd.Cells(snPrdRow, PROD_COL_TYPE).Value)
                        cStk = SafeLng(wsProd.Cells(snPrdRow, PROD_COL_STACK).Value)
                        cDC = SafeStr(wsProd.Cells(snPrdRow, PROD_COL_DC).Value)
                        Dim cProc As String: cProc = SafeStr(ws.Cells(sri, WS_COL_PROC).Value)
                        Dim cDays As Long: cDays = GetProcDays(cProc, cType, cStk, cDC)
                        tmpEnd = CDate(newVal) + cDays
                        tmpEnd = AdjustToWeekday(tmpEnd)
                        ws.Cells(sri, WS_COL_EDATE).Value = FmtDate(tmpEnd)
                    End If

                Case WS_COL_EDATE
                    ws.Cells(sri, WS_COL_EDATE).Value = newVal
            End Select
NextProdChild:
        Next sri

        If c = WS_COL_SDATE And SafeIsDate(newVal) Then
            Dim fc As Long: fc = r + 1
            If fc <= wsLr Then
                If SafeStr(ws.Cells(fc, META_TYPE).Value) = RTYPE_SN Then
                    Dim fcPrd As Long: fcPrd = SafeLng(ws.Cells(fc, META_PRDROW).Value)
                    If fcPrd > 0 Then
                        Dim pnE As String: pnE = SafeStr(ws.Cells(r, WS_COL_PROC).Value)
                        Dim ptE As String: ptE = SafeStr(wsProd.Cells(fcPrd, PROD_COL_TYPE).Value)
                        Dim skE As Long: skE = SafeLng(wsProd.Cells(fcPrd, PROD_COL_STACK).Value)
                        Dim dcE As String: dcE = SafeStr(wsProd.Cells(fcPrd, PROD_COL_DC).Value)
                        Dim pdE As Long: pdE = GetProcDays(pnE, ptE, skE, dcE)
                        tmpEnd = CDate(newVal) + pdE
                        tmpEnd = AdjustToWeekday(tmpEnd)
                        ws.Cells(r, WS_COL_EDATE).Value = FmtDate(tmpEnd)
                    End If
                End If
            End If
        End If

        Application.EnableEvents = True
        m_BulkUpdating = False
        Exit Sub
    End If

    ' ── S/N 행 변경 ──
    If metaType <> RTYPE_SN Then GoTo ChangeDone

    Dim prdRow As Long: prdRow = SafeLng(ws.Cells(r, META_PRDROW).Value)
    If prdRow = 0 Then GoTo ChangeDone

    Dim snType  As String: snType = SafeStr(wsProd.Cells(prdRow, PROD_COL_TYPE).Value)
    Dim snStack As Long: snStack = SafeLng(wsProd.Cells(prdRow, PROD_COL_STACK).Value)
    Dim snDC    As String: snDC = SafeStr(wsProd.Cells(prdRow, PROD_COL_DC).Value)

    If c = WS_COL_SDATE Then
        If SafeIsDate(newVal) Then
            Dim curPC As String: curPC = SafeStr(ws.Cells(r, WS_COL_PROC).Value)
            Dim daysC As Long: daysC = GetProcDays(curPC, snType, snStack, snDC)
            tmpEnd = CDate(newVal) + daysC
            tmpEnd = AdjustToWeekday(tmpEnd)
            ws.Cells(r, WS_COL_EDATE).Value = FmtDate(tmpEnd)
        End If
    End If

    If c = WS_COL_PROC Then
        Dim newEqList As String: newEqList = GetEquipListForProc(newVal, snType)
        If Len(newEqList) > 0 Then AddDataValidation ws.Cells(r, WS_COL_EQUIP), newEqList
        Dim snAutoEq As String: snAutoEq = GetAutoEquip(newVal, snType)
        If snAutoEq <> "" Then
            ws.Cells(r, WS_COL_EQUIP).Value = snAutoEq
        Else
            ws.Cells(r, WS_COL_EQUIP).Value = ""
        End If
        If SafeIsDate(ws.Cells(r, WS_COL_SDATE).Value) Then
            Dim daysP As Long: daysP = GetProcDays(newVal, snType, snStack, snDC)
            tmpEnd = CDate(ws.Cells(r, WS_COL_SDATE).Value) + daysP
            tmpEnd = AdjustToWeekday(tmpEnd)
            ws.Cells(r, WS_COL_EDATE).Value = FmtDate(tmpEnd)
        End If
    End If

ChangeDone:
    Application.EnableEvents = True
    m_BulkUpdating = False
    On Error GoTo 0
End Sub

' ============================================================
'  SpinDateWithBulk
' ============================================================
Private Sub SpinDateWithBulk(ws As Worksheet, r As Long, offsetDays As Long)
    On Error GoTo SpinErr
    m_BulkUpdating = True
    Application.EnableEvents = False

    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)

    Dim curSD As String: curSD = SafeStr(ws.Cells(r, WS_COL_SDATE).Value)
    If SafeIsDate(curSD) Then
        Dim newSD As Date: newSD = CDate(curSD) + offsetDays
        ws.Cells(r, WS_COL_SDATE).Value = FmtDate(newSD)

        Dim spPrdRow As Long: spPrdRow = SafeLng(ws.Cells(r, META_PRDROW).Value)
        If spPrdRow > 0 Then
            Dim spProc  As String: spProc = SafeStr(ws.Cells(r, WS_COL_PROC).Value)
            Dim spType  As String: spType = SafeStr(wsProd.Cells(spPrdRow, PROD_COL_TYPE).Value)
            Dim spStack As Long:  spStack = SafeLng(wsProd.Cells(spPrdRow, PROD_COL_STACK).Value)
            Dim spDC    As String: spDC = SafeStr(wsProd.Cells(spPrdRow, PROD_COL_DC).Value)
            Dim spDays  As Long:  spDays = GetProcDays(spProc, spType, spStack, spDC)
            Dim tmpEnd  As Date:  tmpEnd = newSD + spDays
            tmpEnd = AdjustToWeekday(tmpEnd)
            ws.Cells(r, WS_COL_EDATE).Value = FmtDate(tmpEnd)
        End If
    End If

    Application.EnableEvents = True
    m_BulkUpdating = False
    Exit Sub
SpinErr:
    Application.EnableEvents = True
    m_BulkUpdating = False
End Sub

' ============================================================
'  SpinProductDates
' ============================================================
Private Sub SpinProductDates(ws As Worksheet, prodRow As Long, offsetDays As Long)
    On Error GoTo SpinPErr
    m_BulkUpdating = True
    Application.EnableEvents = False

    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)

    Dim curPSD As String: curPSD = SafeStr(ws.Cells(prodRow, WS_COL_SDATE).Value)
    If Not SafeIsDate(curPSD) Then GoTo SpinDone

    Dim newPSD As Date: newPSD = CDate(curPSD) + offsetDays
    ws.Cells(prodRow, WS_COL_SDATE).Value = FmtDate(newPSD)

    Dim tmpEnd As Date

    ' ── 제품행 종료일
    Dim fc As Long: fc = prodRow + 1
    If SafeStr(ws.Cells(fc, META_TYPE).Value) = RTYPE_SN Then
        Dim fcPrd As Long: fcPrd = SafeLng(ws.Cells(fc, META_PRDROW).Value)
        If fcPrd > 0 Then
            Dim pnP As String: pnP = SafeStr(ws.Cells(prodRow, WS_COL_PROC).Value)
            Dim ptP As String: ptP = SafeStr(wsProd.Cells(fcPrd, PROD_COL_TYPE).Value)
            Dim skP As Long:   skP = SafeLng(wsProd.Cells(fcPrd, PROD_COL_STACK).Value)
            Dim dcP As String: dcP = SafeStr(wsProd.Cells(fcPrd, PROD_COL_DC).Value)
            Dim pdP As Long:   pdP = GetProcDays(pnP, ptP, skP, dcP)
            tmpEnd = newPSD + pdP
            tmpEnd = AdjustToWeekday(tmpEnd)
            ws.Cells(prodRow, WS_COL_EDATE).Value = FmtDate(tmpEnd)
        End If
    End If

    ' ── 하위 S/N 전파
    Dim wsLr As Long: wsLr = GetLastRow(ws, WS_COL_MAIN)
    Dim ri As Long
    For ri = prodRow + 1 To wsLr
        If SafeStr(ws.Cells(ri, META_TYPE).Value) <> RTYPE_SN Then Exit For
        ws.Cells(ri, WS_COL_SDATE).Value = FmtDate(newPSD)

        Dim spRow As Long: spRow = SafeLng(ws.Cells(ri, META_PRDROW).Value)
        If spRow > 0 Then
            Dim spProc  As String: spProc = SafeStr(ws.Cells(ri, WS_COL_PROC).Value)
            Dim spType  As String: spType = SafeStr(wsProd.Cells(spRow, PROD_COL_TYPE).Value)
            Dim spStack As Long:  spStack = SafeLng(wsProd.Cells(spRow, PROD_COL_STACK).Value)
            Dim spDC    As String: spDC = SafeStr(wsProd.Cells(spRow, PROD_COL_DC).Value)
            Dim spDays  As Long:  spDays = GetProcDays(spProc, spType, spStack, spDC)
            tmpEnd = newPSD + spDays
            tmpEnd = AdjustToWeekday(tmpEnd)
            ws.Cells(ri, WS_COL_EDATE).Value = FmtDate(tmpEnd)
        End If
    Next ri

SpinDone:
    Application.EnableEvents = True
    m_BulkUpdating = False
    Exit Sub
SpinPErr:
    Application.EnableEvents = True
    m_BulkUpdating = False
End Sub
' ============================================================
'  ProcessEdit  ★ 필터 리셋 추가
' ============================================================
Public Sub ProcessEdit()
    InitWSChars
    On Error GoTo ErrH

    Dim ws     As Worksheet: Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    If dictCheck Is Nothing Then Exit Sub

    Dim checkedCount As Long: checkedCount = 0
    Dim cK As Variant
    For Each cK In dictCheck.keys
        If dictCheck(cK) = True Then checkedCount = checkedCount + 1
    Next cK
    If checkedCount = 0 Then
        MsgBox "저장할 S/N을 체크하세요.", vbExclamation
        Exit Sub
    End If

    If MsgBox(checkedCount & "건의 편집 내용을 저장하시겠습니까?" & vbCrLf & _
              "(시작일 입력 → 진행, 상태=완료 → 다음공정)", _
              vbQuestion + vbYesNo) <> vbYes Then Exit Sub

    Application.ScreenUpdating = False
    Application.EnableEvents = False
    g_EventsDisabled = True

    Dim processed As Long: processed = 0
    Dim wsLr As Long: wsLr = GetLastRow(ws, WS_COL_MAIN)
    Dim ri   As Long

    For ri = WS_DATA_START To wsLr
        If SafeStr(ws.Cells(ri, META_TYPE).Value) <> RTYPE_SN Then GoTo NextEdit
        Dim snKey As String: snKey = SafeStr(ws.Cells(ri, META_KEY2).Value)
        If Not dictCheck.Exists(snKey) Then GoTo NextEdit
        If Not dictCheck(snKey) Then GoTo NextEdit

        Dim prdRow        As Long: prdRow = SafeLng(ws.Cells(ri, META_PRDROW).Value)
        If prdRow = 0 Then GoTo NextEdit

        Dim sn            As String: sn = SafeStr(wsProd.Cells(prdRow, PROD_COL_SN).Value)
        Dim wsProc        As String: wsProc = SafeStr(ws.Cells(ri, WS_COL_PROC).Value)
        Dim wsEquip       As String: wsEquip = SafeStr(ws.Cells(ri, WS_COL_EQUIP).Value)
        Dim wsSDate       As String: wsSDate = SafeStr(ws.Cells(ri, WS_COL_SDATE).Value)
        Dim wsEDate       As String: wsEDate = SafeStr(ws.Cells(ri, WS_COL_EDATE).Value)
        Dim wsStatus      As String: wsStatus = SafeStr(ws.Cells(ri, WS_COL_STATUS).Value)
        Dim curProdStatus As String: curProdStatus = SafeStr(wsProd.Cells(prdRow, PROD_COL_STATUS).Value)
        Dim route         As String: route = SafeStr(wsProd.Cells(prdRow, PROD_COL_ROUTE).Value)
        Dim pType         As String: pType = SafeStr(wsProd.Cells(prdRow, PROD_COL_TYPE).Value)
        Dim stack         As Long: stack = SafeLng(wsProd.Cells(prdRow, PROD_COL_STACK).Value)
        Dim dc            As String: dc = SafeStr(wsProd.Cells(prdRow, PROD_COL_DC).Value)

        ' 1. 공정 저장
        If wsProc <> "" Then wsProd.Cells(prdRow, PROD_COL_PROCESS).Value = wsProc

        ' 2. 설비 저장
        If wsEquip = "" Then
            Dim autoEq As String: autoEq = GetAutoEquip(wsProc, pType)
            If autoEq <> "" Then wsEquip = autoEq
        End If
        wsProd.Cells(prdRow, PROD_COL_EQUIP).Value = wsEquip
        UpdateProcLogField sn, wsProc, PLOG_COL_EQUIP, wsEquip

        ' 3. 시작일 저장
         If SafeIsDate(wsSDate) Then
            wsProd.Cells(prdRow, PROD_COL_START).Value = FmtDate(CDate(wsSDate))
            
            ' ★ 대기 → 진행 전환
            If curProdStatus = ST_WAIT Then
                wsProd.Cells(prdRow, PROD_COL_STATUS).Value = ST_PROG
                curProdStatus = ST_PROG
                UpdateProcLogStatus sn, wsProc, ST_PROG
            End If
            
            ' ★ 대기/진행 모두: ProcLog에 시작일·종료일·설비 반영
            If curProdStatus = ST_PROG Or curProdStatus = ST_WAIT Then
                UpdateProcLogField sn, wsProc, PLOG_COL_SDATE, FmtDate(CDate(wsSDate))
                If SafeIsDate(wsEDate) Then
                    UpdateProcLogField sn, wsProc, PLOG_COL_PLANEND, FmtDate(CDate(wsEDate))
                End If
            End If
            
            ' ★ 대기/진행 모두: 첫 공정이면 전체 일정 계산
            Dim firstProc As String
            firstProc = GetFirstProc(route)
            If wsProc = firstProc Then
                CalcFullSchedule sn
            End If
            
            If Not SafeIsDate(wsEDate) Then
                Dim pDaysE As Long: pDaysE = GetProcDays(wsProc, pType, stack, dc)
                wsEDate = FmtDate(CDate(wsSDate) + pDaysE)
                wsProd.Cells(prdRow, PROD_COL_END).Value = wsEDate
            End If
        End If

        ' 4. 종료일 저장
        If SafeIsDate(wsEDate) Then
            wsProd.Cells(prdRow, PROD_COL_END).Value = FmtDate(CDate(wsEDate))
        End If

        ' 5. 완료 전환
         If wsStatus = ST_DONE And curProdStatus <> ST_DONE Then
            Dim actDays As Long: actDays = 0
            If SafeIsDate(wsSDate) Then
                actDays = DateDiff("d", CDate(wsSDate), Date)
                If actDays < 0 Then actDays = 0
            End If
            UpdateProcLogStatus sn, wsProc, ST_DONE, FmtDate(Date), actDays, ""

            Dim nextP As String: nextP = GetNextProc(wsProc, route)
            If nextP <> "" Then
                Dim nAutoEq As String: nAutoEq = GetAutoEquip(nextP, pType)
                wsProd.Cells(prdRow, PROD_COL_PROCESS).Value = nextP
                wsProd.Cells(prdRow, PROD_COL_STATUS).Value = ST_WAIT
                wsProd.Cells(prdRow, PROD_COL_EQUIP).Value = nAutoEq

                ' ★ ProcLog에서 다음 공정 날짜 가져와서 Production에 반영
                Dim nextDates As Variant
                nextDates = GetProcLogDates(sn, nextP)
                If SafeIsDate(nextDates(0)) Then
                    wsProd.Cells(prdRow, PROD_COL_START).Value = CStr(nextDates(0))
                Else
                    wsProd.Cells(prdRow, PROD_COL_START).Value = ""
                End If
                If SafeIsDate(nextDates(1)) Then
                    wsProd.Cells(prdRow, PROD_COL_END).Value = CStr(nextDates(1))
                Else
                    wsProd.Cells(prdRow, PROD_COL_END).Value = ""
                End If

                UpdateProcLogStatus sn, nextP, ST_WAIT
            Else
                wsProd.Cells(prdRow, PROD_COL_STATUS).Value = ST_DONE
                wsProd.Cells(prdRow, PROD_COL_PROGRESS).Value = 1
            End If
        End If

        ' 6. 진행률 재계산
        CalcAndWriteProgress wsProd, prdRow
        FormatProductionRow wsProd, prdRow
        processed = processed + 1
NextEdit:
    Next ri

    ' ★ 필터 리셋: 편집 후 전체 표시
    ws.Cells(WS_ROW_FILTER, FLT_COL_STATUS).Value = "전체"
    ws.Cells(WS_ROW_FILTER, FLT_COL_PROC).Value = "전체"
    ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT).Value = "전체"
    ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH).Value = "전체"
    ws.Cells(WS_ROW_FILTER, FLT_COL_SN).Value = "전체"
    ws.Cells(WS_ROW_FILTER, FLT_COL_EQUIP).Value = "전체"

    g_EventsDisabled = False
    Application.EnableEvents = True
    Application.ScreenUpdating = True
   ' ★ Firebase 자동 동기화
    SyncAfterEdit dictCheck
    
    ExitMode
    If processed > 0 Then
        MsgBox processed & "건 저장 완료.", vbInformation
    Else
        MsgBox "저장할 항목이 없습니다.", vbInformation
    End If
    Exit Sub
ErrH:
    g_EventsDisabled = False
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "ProcessEdit 오류: " & Err.Description, vbCritical
End Sub

' ============================================================
'  ProcessScrap
' ============================================================
Public Sub ProcessScrap()
    InitWSChars
    On Error GoTo ErrH

    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    If dictCheck Is Nothing Then Exit Sub

    Dim checkedCount As Long: checkedCount = 0
    Dim cK As Variant
    For Each cK In dictCheck.keys
        If dictCheck(cK) = True Then checkedCount = checkedCount + 1
    Next cK
    If checkedCount = 0 Then
        MsgBox "선택된 S/N이 없습니다.", vbInformation
        Exit Sub
    End If

    Dim defType As String
    defType = InputBox("불량 유형을 입력하세요:" & vbCrLf & _
                       "크랙 / 도금불량 / 치수불량 / 기타", _
                       "폐기 처리", "크랙")
    If Len(defType) = 0 Then Exit Sub

    If MsgBox(checkedCount & "건을 [" & defType & "] 사유로 폐기 처리하시겠습니까?", _
              vbExclamation + vbYesNo) <> vbYes Then Exit Sub

    Application.ScreenUpdating = False
    Application.EnableEvents = False

    Dim processed As Long: processed = 0
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_SN)
    Dim r  As Long
    For r = PROD_DATA_START To lr
        Dim sn As String: sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
        If dictCheck.Exists(sn) Then
            If dictCheck(sn) = True Then
                Dim sts As String: sts = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
                If sts = ST_WAIT Or sts = ST_PROG Then
                    Dim proc As String: proc = SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value)
                    wsProd.Cells(r, PROD_COL_STATUS).Value = ST_SCRAP
                    wsProd.Cells(r, PROD_COL_DEFECT).Value = defType
                    wsProd.Cells(r, PROD_COL_DEFPROC).Value = proc
                    wsProd.Cells(r, PROD_COL_PROGRESS).Value = 0
                    UpdateProcLogStatus sn, proc, ST_SCRAP, , , defType
                    FormatProductionRow wsProd, r
                    processed = processed + 1
                End If
            End If
        End If
    Next r

    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox processed & "건 폐기 처리 완료.", vbInformation
     ' ★ Firebase 자동 동기화
    SyncAfterScrap dictCheck
    
    ExitMode
    Exit Sub
ErrH:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "ProcessScrap 오류: " & Err.Description, vbCritical
End Sub

' ============================================================
'  Gantt 네비게이션
' ============================================================
Public Sub GanttPrev()
    InitWSChars
    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value = GetGanttBaseDate(ws) - GANTT_SCROLL_DAYS
    BuildAccordion
End Sub

Public Sub GanttNext()
    InitWSChars
    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value = GetGanttBaseDate(ws) + GANTT_SCROLL_DAYS
    BuildAccordion
End Sub

Public Sub GanttToday()
    InitWSChars
    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    ws.Cells(WS_ROW_FILTER, META_BASEDATE).Value = Date
    BuildAccordion
End Sub
' ============================================================
'  제품명 드롭다운
' ============================================================
Private Sub BuildProductFilterList(ws As Worksheet)
    On Error Resume Next
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim lastR As Long: lastR = GetLastRow(wsProd, PROD_COL_SN)
    Dim dict As Object: Set dict = CreateObject("Scripting.Dictionary")
    dict.Add "전체", 1
    Dim r As Long
    For r = PROD_DATA_START To lastR
        Dim pn As String: pn = SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value)
        If pn <> "" And Not dict.Exists(pn) Then dict.Add pn, 1
    Next r
    Dim lst As String: lst = ""
    Dim k As Variant
    For Each k In dict.keys
        If lst = "" Then lst = CStr(k) Else lst = lst & "," & CStr(k)
    Next k
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_PRODUCT), lst
    On Error GoTo 0
End Sub

' ============================================================
'  배치 드롭다운 (제품 연동)
' ============================================================
Private Sub BuildBatchFilterList(ws As Worksheet, filterProduct As String)
    On Error Resume Next
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim lastR As Long: lastR = GetLastRow(wsProd, PROD_COL_SN)
    Dim dict As Object: Set dict = CreateObject("Scripting.Dictionary")
    dict.Add "전체", 1
    Dim r As Long
    For r = PROD_DATA_START To lastR
        If filterProduct = "" Or filterProduct = "전체" Or _
           SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value) = filterProduct Then
            Dim bc As String: bc = SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value)
            If bc <> "" And Not dict.Exists(bc) Then dict.Add bc, 1
        End If
    Next r
    Dim lst As String: lst = ""
    Dim k As Variant
    For Each k In dict.keys
        If lst = "" Then lst = CStr(k) Else lst = lst & "," & CStr(k)
    Next k
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_BATCH), lst
    On Error GoTo 0
End Sub

' ============================================================
'  S/N 드롭다운 (제품 + 배치 연동)
' ============================================================
Private Sub BuildSNFilterList(ws As Worksheet, filterProduct As String, filterBatch As String)
    On Error Resume Next
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim lastR As Long: lastR = GetLastRow(wsProd, PROD_COL_SN)
    Dim dict As Object: Set dict = CreateObject("Scripting.Dictionary")
    dict.Add "전체", 1
    Dim r As Long
    For r = PROD_DATA_START To lastR
        Dim ok As Boolean: ok = True
        If filterProduct <> "" And filterProduct <> "전체" Then
            If SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value) <> filterProduct Then ok = False
        End If
        If filterBatch <> "" And filterBatch <> "전체" Then
            If SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value) <> filterBatch Then ok = False
        End If
        If ok Then
            Dim sn As String: sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
            If sn <> "" And Not dict.Exists(sn) Then dict.Add sn, 1
        End If
    Next r
    Dim lst As String: lst = ""
    Dim k As Variant
    For Each k In dict.keys
        If lst = "" Then lst = CStr(k) Else lst = lst & "," & CStr(k)
    Next k
    If Len(lst) > 255 Then lst = "전체"
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_SN), lst
    On Error GoTo 0
End Sub

' ============================================================
'  호기(설비) 드롭다운
' ============================================================
Private Sub BuildEquipFilterList(ws As Worksheet)
    On Error Resume Next
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim lastR As Long: lastR = GetLastRow(wsProd, PROD_COL_SN)
    Dim dict As Object: Set dict = CreateObject("Scripting.Dictionary")
    dict.Add "전체", 1
    Dim r As Long
    For r = PROD_DATA_START To lastR
        Dim eq As String: eq = SafeStr(wsProd.Cells(r, PROD_COL_EQUIP).Value)
        If eq <> "" And Not dict.Exists(eq) Then dict.Add eq, 1
    Next r
    Dim lst As String: lst = ""
    Dim k As Variant
    For Each k In dict.keys
        If lst = "" Then lst = CStr(k) Else lst = lst & "," & CStr(k)
    Next k
    AddDataValidation ws.Cells(WS_ROW_FILTER, FLT_COL_EQUIP), lst
    On Error GoTo 0
End Sub

Private Function AdjustForSpin(dt As Date, delta As Long) As Date
    Dim wd As Long: wd = Weekday(dt, vbSunday)
    If delta > 0 Then
        ' 올릴 때: 토→월, 일→월
        If wd = 7 Then AdjustForSpin = dt + 2: Exit Function
        If wd = 1 Then AdjustForSpin = dt + 1: Exit Function
    Else
        ' 내릴 때: 토→금, 일→금
        If wd = 7 Then AdjustForSpin = dt - 1: Exit Function
        If wd = 1 Then AdjustForSpin = dt - 2: Exit Function
    End If
    AdjustForSpin = dt
End Function
'────────────────────────────────────────────────────────────────
' 체크된 S/N의 Production 행 번호 목록 반환 ("|" 구분)
'────────────────────────────────────────────────────────────────
Public Function GetCheckedSNRows() As String
    Dim wsProd As Worksheet
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    
    Dim lastR As Long
    lastR = GetLastRow(wsProd, PROD_COL_SN)
    
    Dim result As String
    result = ""
    Dim cnt As Long
    cnt = 0
    
    If dictCheck Is Nothing Then
        GetCheckedSNRows = ""
        Exit Function
    End If
    
    Dim i As Long
    For i = PROD_DATA_START To lastR
        Dim sn As String
        sn = SafeStr(wsProd.Cells(i, PROD_COL_SN).Value)
        
        If Len(sn) > 0 Then
            If dictCheck.Exists(sn) Then
                If CBool(dictCheck(sn)) Then
                    cnt = cnt + 1
                    If cnt > 1 Then result = result & "|"
                    result = result & i
                End If
            End If
        End If
    Next i
    
    GetCheckedSNRows = result
End Function
'────────────────────────────────────────────────────────────────
' NG 모드 진입 / 실행
'────────────────────────────────────────────────────────────────

Public Sub EnterNGMode()
    If g_CurrentMode = MODE_NG Then
        Dim rowList As String
        rowList = GetCheckedSNRows()
        
        If Len(rowList) = 0 Then
            MsgBox "S/N을 체크박스로 선택하세요.", vbInformation
            Exit Sub
        End If
        
        Dim frm As frmNG
        Set frm = New frmNG
        frm.tag = rowList
        frm.BuildUI          ' ← Tag 설정 후 UI 생성
        
        g_CurrentMode = MODE_NONE
        HideModeBar
        
        frm.Show vbModal
        BuildAccordion
    Else
        g_CurrentMode = MODE_NG
        Set dictCheck = CreateObject("Scripting.Dictionary")
        BuildAccordion
        ShowModeBar "NG 모드: S/N 선택 후 [NG] 버튼을 다시 클릭하세요", RGB(255, 80, 80)
    End If
End Sub

'────────────────────────────────────────────────────────────────
' 모드바 표시 (상단 안내 텍스트)
'────────────────────────────────────────────────────────────────
Public Sub ShowModeBar(msg As String, clr As Long)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    
    With ws.Cells(WS_ROW_MODEBAR, WS_COL_MAIN)
        .Value = msg
        .Font.Size = 9
        .Font.Bold = True
        .Font.Color = clr
        .HorizontalAlignment = xlLeft
    End With
    
    ws.rows(WS_ROW_MODEBAR).rowHeight = 20
End Sub

Public Sub HideModeBar()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    
    ws.Cells(WS_ROW_MODEBAR, WS_COL_MAIN).Value = ""
    ws.rows(WS_ROW_MODEBAR).rowHeight = 4
End Sub
