Attribute VB_Name = "M07_Archive"
Option Explicit

' ============================================================
'  M07_Archive ? 완료 건 아카이브, 서식
' ============================================================

Public Sub ArchiveCompleted()
    Dim wsProd   As Worksheet
    Dim wsArc    As Worksheet
    Dim lastPR   As Long
    Dim r        As Long
    Dim arcR     As Long
    Dim status   As String
    Dim route    As String
    Dim proc     As String
    Dim nextP    As String
    Dim sn       As String
    Dim delRows() As Long
    Dim delCnt   As Long
    Dim i        As Long
    On Error GoTo ErrH

    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Set wsArc = ThisWorkbook.sheets(SHT_ARCHIVE)
    lastPR = GetLastRow(wsProd, PROD_COL_SN)

    If lastPR < PROD_DATA_START Then
        MsgBox "아카이브할 완료 건이 없습니다.", vbInformation
        Exit Sub
    End If

    ReDim delRows(1 To lastPR)
    delCnt = 0
    arcR = GetLastRow(wsArc, ARC_COL_SN) + 1
    If arcR < ARC_DATA_START Then arcR = ARC_DATA_START

    Application.ScreenUpdating = False

    For r = PROD_DATA_START To lastPR
        status = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
        If status <> ST_DONE Then GoTo nextArc

        route = SafeStr(wsProd.Cells(r, PROD_COL_ROUTE).Value)
        proc = SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value)
        nextP = GetNextProc(proc, route)
        If nextP <> "" Then GoTo nextArc

        sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)

        wsArc.Cells(arcR, ARC_COL_BATCH).Value = SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value)
        wsArc.Cells(arcR, ARC_COL_SN).Value = sn
        wsArc.Cells(arcR, ARC_COL_TYPE).Value = SafeStr(wsProd.Cells(r, PROD_COL_TYPE).Value)
        wsArc.Cells(arcR, ARC_COL_NAME).Value = SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value)
        wsArc.Cells(arcR, ARC_COL_DRAWING).Value = SafeStr(wsProd.Cells(r, PROD_COL_DRAWING).Value)
        wsArc.Cells(arcR, ARC_COL_LASTPROC).Value = proc
        wsArc.Cells(arcR, ARC_COL_LASTEQUIP).Value = SafeStr(wsProd.Cells(r, PROD_COL_EQUIP).Value)
        wsArc.Cells(arcR, ARC_COL_STATUS).Value = ST_DONE
        wsArc.Cells(arcR, ARC_COL_FIRSTDATE).Value = GetFirstStartDateFromProcLog(sn)
        wsArc.Cells(arcR, ARC_COL_LASTDATE).Value = SafeStr(wsProd.Cells(r, PROD_COL_END).Value)
        wsArc.Cells(arcR, ARC_COL_COMPLDATE).Value = TodayStr()
        wsArc.Cells(arcR, ARC_COL_ROUTE).Value = route
        wsArc.Cells(arcR, ARC_COL_PROG).Value = 1
        wsArc.Cells(arcR, ARC_COL_ARCDATE).Value = TodayStr()

        FormatArchiveRow wsArc, arcR
        arcR = arcR + 1

        delCnt = delCnt + 1
        delRows(delCnt) = r
nextArc:
    Next r

    Application.DisplayAlerts = False
    For i = delCnt To 1 Step -1
        wsProd.rows(delRows(i)).Delete
    Next i
    Application.DisplayAlerts = True

    Application.ScreenUpdating = True

    If delCnt > 0 Then
        MsgBox delCnt & "건 아카이브 완료. ProcLog는 영구 보존됩니다.", vbInformation
        RefreshWorkSpace
    Else
        MsgBox "아카이브 대상 완료 건이 없습니다.", vbInformation
    End If
    Exit Sub
ErrH:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    MsgBox "ArchiveCompleted 오류: " & Err.Description, vbCritical
End Sub

Private Sub FormatArchiveRow(wsArc As Worksheet, r As Long)
    Dim c     As Long
    Dim pType As String
    On Error GoTo ErrH

    For c = ARC_COL_BATCH To ARC_COL_ARCDATE
        With wsArc.Cells(r, c)
            .Font.Name = "맑은 고딕"
            .Font.Size = 9
            .Font.Color = CLR_TEXT_DIM
            .Interior.Color = CLR_BG_DARK
        End With
        ApplyCellBorder wsArc.Cells(r, c), CLR_BG_MID, xlHairline
    Next c

    wsArc.rows(r).rowHeight = 16
    FormatSNCell wsArc.Cells(r, ARC_COL_SN), SafeStr(wsArc.Cells(r, ARC_COL_SN).Value)

    pType = SafeStr(wsArc.Cells(r, ARC_COL_TYPE).Value)
    wsArc.Cells(r, ARC_COL_TYPE).Font.Color = GetTypeColor(pType)
    wsArc.Cells(r, ARC_COL_STATUS).Font.Color = CLR_BADGE_DONE_BG
    Exit Sub
ErrH:
    MsgBox "FormatArchiveRow 오류: " & Err.Description, vbExclamation
End Sub

Public Sub RefreshArchiveSheet()
    Dim wsArc As Worksheet
    Dim lastR As Long
    Dim r     As Long
    On Error GoTo ErrH

    Set wsArc = ThisWorkbook.sheets(SHT_ARCHIVE)
    lastR = GetLastRow(wsArc, ARC_COL_SN)
    If lastR < ARC_DATA_START Then Exit Sub

    For r = ARC_DATA_START To lastR
        If SafeStr(wsArc.Cells(r, ARC_COL_SN).Value) <> "" Then
            FormatArchiveRow wsArc, r
        End If
    Next r
    Exit Sub
ErrH:
    MsgBox "RefreshArchiveSheet 오류: " & Err.Description, vbExclamation
End Sub
