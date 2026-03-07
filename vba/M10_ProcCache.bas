Attribute VB_Name = "M10_ProcCache"
'================================================================
' M08_ProcCache - ProcLog 캐시 엔진
' ESC Production Management System v12.2
'
' 목적: ProcLog 시트를 매번 셀 단위로 읽지 않고
'       메모리 배열 + Dictionary 인덱스로 고속 접근
'
' 사용법:
'   1) BuildProcCache        ← 새로고침 시작 시 1번 호출
'   2) GetCachedProcRows(sn) ← SN의 ProcLog 행 데이터 배열
'   3) GetCachedProcDates(sn, procName) ← 특정 공정의 시작일/종료일
'   4) IsCacheReady          ← 캐시 유효 여부
'   5) InvalidateCache       ← 캐시 무효화 (ProcLog 변경 후)
'================================================================
Option Explicit

' ── 캐시 저장소 ──
Private m_CacheBuilt As Boolean
Private m_CacheData  As Variant          ' 전체 ProcLog 배열 (2차원)
Private m_CacheIndex As Object           ' Dictionary: SN → Collection of 배열 행 인덱스
Private m_CacheRows  As Long             ' 캐시된 총 행 수
Private m_CacheCols  As Long             ' 캐시된 총 열 수

' ── 열 오프셋 (배열은 1부터 시작, 시트 열과 매핑) ──
Private Const OFFSET_BASE As Long = 2    ' 배열 열1 = 시트 C열(3열) → offset = 3-1 = 2

'================================================================
' IsCacheReady: 캐시가 유효한지 확인
'================================================================
Public Function IsCacheReady() As Boolean
    IsCacheReady = m_CacheBuilt
End Function

'================================================================
' InvalidateCache: 캐시 무효화
' ProcLog에 직접 쓰기 작업 후 반드시 호출
'================================================================
Public Sub InvalidateCache()
    m_CacheBuilt = False
    Set m_CacheIndex = Nothing
    Erase m_CacheData
    m_CacheRows = 0
    m_CacheCols = 0
End Sub

'================================================================
' BuildProcCache: ProcLog 시트를 한 번에 읽어서 캐시 구축
'
' 호출 시점: RefreshWorkSpace, BuildAccordion 시작 시
' 소요 시간: ProcLog 10,000행 기준 0.1초 이내
'================================================================
Public Sub BuildProcCache()
    On Error GoTo ErrH
    
    Dim wsPlog As Worksheet
    Set wsPlog = Nothing
    
    On Error Resume Next
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    On Error GoTo ErrH
    
    If wsPlog Is Nothing Then
        m_CacheBuilt = False
        Exit Sub
    End If
    
    Dim lastR As Long
    lastR = GetLastRow(wsPlog, PLOG_COL_LOGID)
    
    ' 데이터 없으면 빈 캐시
    If lastR < PLOG_DATA_START Then
        m_CacheBuilt = True
        m_CacheRows = 0
        Set m_CacheIndex = CreateObject("Scripting.Dictionary")
        Exit Sub
    End If
    
    ' ── 전체 범위를 한 번에 배열로 읽기 ──
    Dim dataRows As Long
    dataRows = lastR - PLOG_DATA_START + 1
    
    Dim rng As Range
    Set rng = wsPlog.Range( _
        wsPlog.Cells(PLOG_DATA_START, PLOG_COL_LOGID), _
        wsPlog.Cells(lastR, PLOG_COL_LOGTIME))
    
    m_CacheData = rng.Value
    m_CacheRows = dataRows
    m_CacheCols = UBound(m_CacheData, 2)
    
    ' ── SN 인덱스 구축 ──
    Set m_CacheIndex = CreateObject("Scripting.Dictionary")
    
    Dim i As Long
    Dim snVal As String
    Dim snColIdx As Long
    
    ' 배열에서 SN 열 위치 계산
    ' 시트: PLOG_COL_SN = 4, 배열 시작열: PLOG_COL_LOGID = 3
    ' 배열 인덱스 = PLOG_COL_SN - PLOG_COL_LOGID + 1 = 4 - 3 + 1 = 2
    snColIdx = PLOG_COL_SN - PLOG_COL_LOGID + 1
    
    For i = 1 To m_CacheRows
        snVal = SafeStr(m_CacheData(i, snColIdx))
        If Len(snVal) > 0 Then
            If Not m_CacheIndex.Exists(snVal) Then
                Dim newColl As Collection
                Set newColl = New Collection
                newColl.Add i
                Set m_CacheIndex(snVal) = newColl
            Else
                m_CacheIndex(snVal).Add i
            End If
        End If
    Next i
    
    m_CacheBuilt = True
    Exit Sub
    
ErrH:
    m_CacheBuilt = False
    Debug.Print "BuildProcCache 오류: " & Err.Description
End Sub

'================================================================
' CacheColIdx: 시트 열 번호 → 배열 열 인덱스 변환
'================================================================
Private Function CacheColIdx(sheetCol As Long) As Long
    CacheColIdx = sheetCol - PLOG_COL_LOGID + 1
End Function

'================================================================
' GetCacheValue: 캐시에서 값 읽기
'   cacheRow = 배열 행 인덱스 (1~m_CacheRows)
'   sheetCol = 시트 열 번호 (PLOG_COL_LOGID ~ PLOG_COL_LOGTIME)
'================================================================
Public Function GetCacheValue(cacheRow As Long, sheetCol As Long) As Variant
    On Error GoTo ErrH
    If Not m_CacheBuilt Then GetCacheValue = "": Exit Function
    If cacheRow < 1 Or cacheRow > m_CacheRows Then GetCacheValue = "": Exit Function
    
    Dim colIdx As Long
    colIdx = CacheColIdx(sheetCol)
    If colIdx < 1 Or colIdx > m_CacheCols Then GetCacheValue = "": Exit Function
    
    GetCacheValue = m_CacheData(cacheRow, colIdx)
    Exit Function
ErrH:
    GetCacheValue = ""
End Function

'================================================================
' GetCachedSNRows: 특정 SN의 모든 ProcLog 캐시 행 인덱스
' 반환: Collection of Long (캐시 배열 행 인덱스)
'       SN이 없으면 빈 Collection
'================================================================
Public Function GetCachedSNRows(sn As String) As Collection
    Set GetCachedSNRows = New Collection
    On Error GoTo ErrH
    
    If Not m_CacheBuilt Then Exit Function
    If m_CacheRows = 0 Then Exit Function
    If Not m_CacheIndex.Exists(sn) Then Exit Function
    
    Set GetCachedSNRows = m_CacheIndex(sn)
    Exit Function
ErrH:
    Set GetCachedSNRows = New Collection
End Function

'================================================================
' GetCachedProcDates: 특정 SN + 공정명의 시작일/종료일
' 반환: Array(시작일문자열, 종료예정일문자열)
'================================================================
Public Function GetCachedProcDates(sn As String, procName As String) As Variant
    On Error GoTo ErrH
    
    If Not m_CacheBuilt Then
        GetCachedProcDates = Array("", "")
        Exit Function
    End If
    
    Dim rows As Collection
    Set rows = GetCachedSNRows(sn)
    
    If rows.count = 0 Then
        GetCachedProcDates = Array("", "")
        Exit Function
    End If
    
    Dim procColIdx As Long
    procColIdx = CacheColIdx(PLOG_COL_PROC)
    
    Dim sDateColIdx As Long
    sDateColIdx = CacheColIdx(PLOG_COL_SDATE)
    
    Dim planEndColIdx As Long
    planEndColIdx = CacheColIdx(PLOG_COL_PLANEND)
    
    Dim i As Long
    Dim cRow As Long
    
    For i = 1 To rows.count
        cRow = rows(i)
        If SafeStr(m_CacheData(cRow, procColIdx)) = procName Then
            GetCachedProcDates = Array( _
                SafeStr(m_CacheData(cRow, sDateColIdx)), _
                SafeStr(m_CacheData(cRow, planEndColIdx)))
            Exit Function
        End If
    Next i
    
    GetCachedProcDates = Array("", "")
    Exit Function
ErrH:
    GetCachedProcDates = Array("", "")
End Function

'================================================================
' GetCachedProcStatus: 특정 SN + 공정명의 상태
'================================================================
Public Function GetCachedProcStatus(sn As String, procName As String) As String
    On Error GoTo ErrH
    GetCachedProcStatus = ""
    
    If Not m_CacheBuilt Then Exit Function
    
    Dim rows As Collection
    Set rows = GetCachedSNRows(sn)
    If rows.count = 0 Then Exit Function
    
    Dim procColIdx As Long
    procColIdx = CacheColIdx(PLOG_COL_PROC)
    
    Dim statusColIdx As Long
    statusColIdx = CacheColIdx(PLOG_COL_STATUS)
    
    Dim i As Long
    For i = 1 To rows.count
        If SafeStr(m_CacheData(rows(i), procColIdx)) = procName Then
            GetCachedProcStatus = SafeStr(m_CacheData(rows(i), statusColIdx))
            Exit Function
        End If
    Next i
    Exit Function
ErrH:
    GetCachedProcStatus = ""
End Function

'================================================================
' GetCachedProcField: 특정 SN + 공정명의 임의 필드 값
'================================================================
Public Function GetCachedProcField(sn As String, procName As String, _
                                    sheetCol As Long) As Variant
    On Error GoTo ErrH
    GetCachedProcField = ""
    
    If Not m_CacheBuilt Then Exit Function
    
    Dim rows As Collection
    Set rows = GetCachedSNRows(sn)
    If rows.count = 0 Then Exit Function
    
    Dim procColIdx As Long
    procColIdx = CacheColIdx(PLOG_COL_PROC)
    
    Dim targetColIdx As Long
    targetColIdx = CacheColIdx(sheetCol)
    
    Dim i As Long
    For i = 1 To rows.count
        If SafeStr(m_CacheData(rows(i), procColIdx)) = procName Then
            GetCachedProcField = m_CacheData(rows(i), targetColIdx)
            Exit Function
        End If
    Next i
    Exit Function
ErrH:
    GetCachedProcField = ""
End Function

'================================================================
' GetCachedAllProcs: SN의 전체 공정 정보 (Gantt용)
' 반환: Collection of Dictionary
'   각 Dictionary: "proc", "order", "equip", "status",
'                  "startDate", "planEnd", "actualEnd",
'                  "planDays", "actualDays"
'================================================================
Public Function GetCachedAllProcs(sn As String) As Collection
    Set GetCachedAllProcs = New Collection
    On Error GoTo ErrH
    
    If Not m_CacheBuilt Then Exit Function
    
    Dim rows As Collection
    Set rows = GetCachedSNRows(sn)
    If rows.count = 0 Then Exit Function
    
    Dim i As Long
    Dim cRow As Long
    
    For i = 1 To rows.count
        cRow = rows(i)
        
        Dim procInfo As Object
        Set procInfo = CreateObject("Scripting.Dictionary")
        
        procInfo("proc") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_PROC)))
        procInfo("order") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_ORDER)))
        procInfo("equip") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_EQUIP)))
        procInfo("status") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_STATUS)))
        procInfo("startDate") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_SDATE)))
        procInfo("planEnd") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_PLANEND)))
        procInfo("actualEnd") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_ACTEND)))
        procInfo("planDays") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_PLANDAYS)))
        procInfo("actualDays") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_ACTDAYS)))
        procInfo("defect") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_DEFECT)))
        procInfo("remark") = SafeStr(m_CacheData(cRow, CacheColIdx(PLOG_COL_REMARK)))
        
        GetCachedAllProcs.Add procInfo
    Next i
    Exit Function
ErrH:
    Set GetCachedAllProcs = New Collection
End Function

'================================================================
' GetCachedFirstStartDate: SN의 최초 시작일
'================================================================
Public Function GetCachedFirstStartDate(sn As String) As String
    On Error GoTo ErrH
    GetCachedFirstStartDate = ""
    
    If Not m_CacheBuilt Then Exit Function
    
    Dim rows As Collection
    Set rows = GetCachedSNRows(sn)
    If rows.count = 0 Then Exit Function
    
    Dim sDateColIdx As Long
    sDateColIdx = CacheColIdx(PLOG_COL_SDATE)
    
    Dim minDate As Date
    Dim found As Boolean: found = False
    Dim i As Long
    Dim vS As Variant
    
    For i = 1 To rows.count
        vS = m_CacheData(rows(i), sDateColIdx)
        If SafeIsDate(vS) Then
            If Not found Then
                minDate = CDate(vS)
                found = True
            Else
                If CDate(vS) < minDate Then minDate = CDate(vS)
            End If
        End If
    Next i
    
    If found Then GetCachedFirstStartDate = FmtDate(minDate)
    Exit Function
ErrH:
    GetCachedFirstStartDate = ""
End Function

'================================================================
' GetCacheStats: 디버그/상태 확인용
'================================================================
Public Function GetCacheStats() As String
    If Not m_CacheBuilt Then
        GetCacheStats = "캐시 미구축"
    Else
        Dim snCount As Long
        If Not m_CacheIndex Is Nothing Then snCount = m_CacheIndex.count
        GetCacheStats = "행:" & m_CacheRows & " / SN:" & snCount & "개"
    End If
End Function

