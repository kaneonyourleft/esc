Attribute VB_Name = "M03_SerialNumber"
Option Explicit

' ============================================================
'  M03_SerialNumber - 배치코드, S/N 생성 (방식 B)
'  ESC Production Management System v12.2
'
'  SN 형식: WN251125-AAA-L001
'  시퀀스: 제품 기준 (시트번호 무관하게 이어감)
' ============================================================

Public Sub ShowSerialGenForm()
    On Error GoTo ErrH
    Load frmSerialGen
    frmSerialGen.Show
    Exit Sub
ErrH:
    MsgBox "ShowSerialGenForm 오류: " & Err.Description, vbExclamation
End Sub

' ============================================================
'  배치코드 생성 (YYYYMMDD-001 형식)
' ============================================================
Public Function GenerateBatchCode(prodName As String) As String
    Dim wsProd  As Worksheet
    Dim lastR   As Long
    Dim r       As Long
    Dim today   As String
    Dim prefix  As String
    Dim maxSeq  As Long
    Dim seqVal  As Long
    Dim bCode   As String
    On Error GoTo ErrH

    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    today = Format(Date, "YYYYMMDD")
    prefix = today & "-"
    maxSeq = 0

    lastR = GetLastRow(wsProd, PROD_COL_BATCH)
    If lastR >= PROD_DATA_START Then
        For r = PROD_DATA_START To lastR
            bCode = SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value)
            If Left(bCode, Len(prefix)) = prefix Then
                seqVal = SafeLng(Mid(bCode, Len(prefix) + 1))
                If seqVal > maxSeq Then maxSeq = seqVal
            End If
        Next r
    End If

    GenerateBatchCode = prefix & Format(maxSeq + 1, "000")
    Exit Function
ErrH:
    MsgBox "GenerateBatchCode 오류: " & Err.Description, vbExclamation
    GenerateBatchCode = Format(Date, "YYYYMMDD") & "-001"
End Function

' ============================================================
'  기존 배치코드 목록 (중복 제거, 최신순)
' ============================================================
Public Function GetBatchCodeList() As String
    Dim wsProd  As Worksheet
    Dim lastR   As Long
    Dim r       As Long
    Dim bCode   As String
    Dim dict    As Object
    Dim result  As String
    Dim keys    As Variant
    Dim i       As Long
    On Error GoTo ErrH

    Set dict = CreateObject("Scripting.Dictionary")
    result = ""

    ' Production 시트
    On Error Resume Next
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    On Error GoTo ErrH

    If Not wsProd Is Nothing Then
        lastR = GetLastRow(wsProd, PROD_COL_BATCH)
        If lastR >= PROD_DATA_START Then
            For r = lastR To PROD_DATA_START Step -1
                bCode = SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value)
                If Len(Trim(bCode)) > 0 Then
                    If Not dict.Exists(bCode) Then
                        dict.Add bCode, True
                    End If
                End If
            Next r
        End If
    End If

    ' 결과 조립 (최신순 유지)
    If dict.count > 0 Then
        keys = dict.keys
        For i = 0 To UBound(keys)
            If result <> "" Then result = result & ","
            result = result & keys(i)
        Next i
    End If

    GetBatchCodeList = result
    Exit Function
ErrH:
    GetBatchCodeList = ""
End Function

' ============================================================
'  SN 접두어 조립
' ============================================================
Public Function BuildSNPrefix(ByVal prodType As String, _
                              ByVal prodName As String, _
                              ByVal sheetNo As String) As String
    Dim pT As String
    Dim snCode As String

    pT = UCase(Trim(prodType))
    snCode = UCase(Trim(prodName))
    
    ' ★ 공백 제거
    snCode = Replace(snCode, " ", "")
    pT = Replace(pT, " ", "")

    If Len(snCode) > Len(pT) Then
        If Left(snCode, Len(pT)) = pT Then
            snCode = Mid(snCode, Len(pT) + 1)
        End If
    End If

    BuildSNPrefix = pT & sheetNo & "-" & snCode & "-L"
End Function

' ============================================================
'  시퀀스 검색용 키 (시트번호 제외)
' ============================================================
Public Function BuildSeqSearchKey(ByVal prodType As String, _
                                  ByVal prodName As String) As String
    Dim pT As String
    Dim snCode As String

    pT = UCase(Trim(prodType))
    snCode = UCase(Trim(prodName))

    If Len(snCode) > Len(pT) Then
        If Left(snCode, Len(pT)) = pT Then
            snCode = Mid(snCode, Len(pT) + 1)
        End If
    End If

    BuildSeqSearchKey = "-" & snCode & "-L"
End Function

' ============================================================
'  제품 기준 최대 시퀀스 조회 (시트번호 무관)
' ============================================================
Public Function GetMaxSeqForProduct(ByVal prodType As String, _
                                    ByVal prodName As String) As Long
    Dim ws        As Worksheet
    Dim lastR     As Long
    Dim r         As Long
    Dim sn        As String
    Dim snUC      As String
    Dim maxSeq    As Long
    Dim seqNum    As Long
    Dim searchKey As String
    Dim typeUC    As String
    Dim lPos      As Long
    Dim sPart     As String

    maxSeq = 0
    typeUC = UCase(Trim(prodType))
    searchKey = UCase(BuildSeqSearchKey(prodType, prodName))

    ' --- Production ---
    On Error Resume Next
    Set ws = ThisWorkbook.sheets(SHT_PRODUCTION)
    On Error GoTo 0

    If Not ws Is Nothing Then
        lastR = GetLastRow(ws, PROD_COL_SN)
        If lastR >= PROD_DATA_START Then
            For r = PROD_DATA_START To lastR
                sn = SafeStr(ws.Cells(r, PROD_COL_SN).Value)
                snUC = UCase(sn)
                If Left(snUC, Len(typeUC)) = typeUC Then
                    If InStr(snUC, searchKey) > 0 Then
                        lPos = InStrRev(snUC, "-L")
                        If lPos > 0 Then
                            sPart = Mid(sn, lPos + 2)
                            If IsNumeric(sPart) And Len(sPart) > 0 Then
                                seqNum = CLng(sPart)
                                If seqNum > maxSeq Then maxSeq = seqNum
                            End If
                        End If
                    End If
                End If
            Next r
        End If
    End If

    ' --- Archive ---
    Set ws = Nothing
    On Error Resume Next
    Set ws = ThisWorkbook.sheets(SHT_ARCHIVE)
    On Error GoTo 0

    If Not ws Is Nothing Then
        lastR = GetLastRow(ws, ARC_COL_SN)
        If lastR >= ARC_DATA_START Then
            For r = ARC_DATA_START To lastR
                sn = SafeStr(ws.Cells(r, ARC_COL_SN).Value)
                snUC = UCase(sn)
                If Left(snUC, Len(typeUC)) = typeUC Then
                    If InStr(snUC, searchKey) > 0 Then
                        lPos = InStrRev(snUC, "-L")
                        If lPos > 0 Then
                            sPart = Mid(sn, lPos + 2)
                            If IsNumeric(sPart) And Len(sPart) > 0 Then
                                seqNum = CLng(sPart)
                                If seqNum > maxSeq Then maxSeq = seqNum
                            End If
                        End If
                    End If
                End If
            Next r
        End If
    End If

    If maxSeq >= 999 Then
        GetMaxSeqForProduct = 0
    Else
        GetMaxSeqForProduct = maxSeq
    End If
End Function

' ============================================================
'  시리얼 넘버 일괄 생성
' ============================================================
Public Sub GenerateSerialNumbers(prodName As String, qty As Long, _
                                 batch As String, startSeq As Long, _
                                 sheetNo As String)
    Dim wsProd   As Worksheet
    Dim pInfo    As Variant
    Dim pType    As String
    Dim drawing  As String
    Dim shrink   As String
    Dim stack    As Long
    Dim dc       As String
    Dim heat     As String
    Dim route    As String
    Dim firstP   As String
    Dim sn       As String
    Dim snPrefix As String
    Dim newR     As Long
    Dim i        As Long
    Dim p        As Long
    Dim parts()  As String
    Dim equip    As String
    Dim planD    As Long
    Dim pStatus  As String
    Dim snList   As Object
    On Error GoTo ErrH

    If Trim(prodName) = "" Then
        MsgBox "제품명을 선택하세요.", vbExclamation: Exit Sub
    End If
    If qty < 1 Then
        MsgBox "수량은 1 이상이어야 합니다.", vbExclamation: Exit Sub
    End If
    If Len(sheetNo) <> 6 Then
        MsgBox "SheetNo는 6자리여야 합니다.", vbExclamation: Exit Sub
    End If

    pInfo = GetProductInfo(prodName)
    If IsEmpty(pInfo) Then
        MsgBox "제품 정보를 찾을 수 없습니다: " & prodName, vbExclamation: Exit Sub
    End If

    pType = CStr(pInfo(0))
    drawing = CStr(pInfo(1))
    shrink = CStr(pInfo(2))
    stack = CLng(pInfo(3))
    dc = CStr(pInfo(4))
    heat = CStr(pInfo(5))
    route = CStr(pInfo(6))

    If route = "" Then route = BuildRoute(pType, heat)
    firstP = GetFirstProc(route)
    If Trim(batch) = "" Then batch = GenerateBatchCode(prodName)

    snPrefix = BuildSNPrefix(pType, prodName, sheetNo)

    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    parts = Split(route, " > ")

    Application.ScreenUpdating = False

    For i = 1 To qty
      Dim seqNum As Long
        seqNum = ((startSeq + i - 2) Mod 999) + 1
        sn = snPrefix & Format(seqNum, "000")

        newR = GetLastRow(wsProd, PROD_COL_SN) + 1
        If newR < PROD_DATA_START Then newR = PROD_DATA_START

        wsProd.Cells(newR, PROD_COL_BATCH).Value = batch
        wsProd.Cells(newR, PROD_COL_SN).Value = sn
        wsProd.Cells(newR, PROD_COL_TYPE).Value = pType
        wsProd.Cells(newR, PROD_COL_PRODUCT).Value = prodName
        wsProd.Cells(newR, PROD_COL_DRAWING).Value = drawing
        wsProd.Cells(newR, PROD_COL_SHRINK).Value = shrink
        wsProd.Cells(newR, PROD_COL_STACK).Value = stack
        wsProd.Cells(newR, PROD_COL_DC).Value = dc
        wsProd.Cells(newR, PROD_COL_HEAT).Value = heat
        wsProd.Cells(newR, PROD_COL_EQUIP).Value = GetAutoEquip(firstP, pType)
        wsProd.Cells(newR, PROD_COL_PROCESS).Value = firstP
        wsProd.Cells(newR, PROD_COL_STATUS).Value = ST_WAIT
        wsProd.Cells(newR, PROD_COL_START).Value = ""
        wsProd.Cells(newR, PROD_COL_END).Value = ""
        wsProd.Cells(newR, PROD_COL_PROGRESS).Value = 0
        wsProd.Cells(newR, PROD_COL_ROUTE).Value = route
        wsProd.Cells(newR, PROD_COL_SHEETNO).Value = sheetNo
        wsProd.Cells(newR, PROD_COL_REGDATE).Value = TodayStr()

        FormatProductionRow wsProd, newR

        For p = 0 To UBound(parts)
            equip = GetAutoEquip(Trim(parts(p)), pType)
            pStatus = IIf(p = 0, ST_WAIT, "")
            planD = GetProcDays(Trim(parts(p)), pType, stack, dc)
            InsertProcLog sn, batch, prodName, pType, Trim(parts(p)), p + 1, _
                          equip, pStatus, "", "", planD
        Next p
    Next i

    ' SyncAfterEdit는 루프 밖에서 한 번만 호출
    Set snList = CreateObject("Scripting.Dictionary")
      For i = 1 To qty
        Dim seqDisp As Long
        seqDisp = ((startSeq + i - 2) Mod 999) + 1
        snList.Add snPrefix & Format(seqDisp, "000"), True
    Next i
    SyncAfterEdit snList

    Application.ScreenUpdating = True
    MsgBox qty & "개 S/N 생성 완료." & vbCrLf & _
           "첫 번째: " & snPrefix & Format(startSeq, "000") & vbCrLf & _
           "마지막: " & snPrefix & Format(startSeq + qty - 1, "000") & vbCrLf & _
           "배치: " & batch, vbInformation
    RefreshWorkSpace
    Exit Sub
ErrH:
    Application.ScreenUpdating = True
    MsgBox "GenerateSerialNumbers 오류: " & Err.Description, vbCritical
End Sub

Public Sub FormatProductionRow(wsProd As Worksheet, r As Long)
    On Error Resume Next
    Dim status As String: status = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
    Dim c As Long
    For c = PROD_COL_BATCH To PROD_COL_INSP_MEMO
        wsProd.Cells(r, c).Font.Name = TITLE_FONT_NAME
        wsProd.Cells(r, c).Font.Size = 9
        Select Case status
            Case ST_SCRAP
                wsProd.Cells(r, c).Font.Color = CLR_TEXT_DIM
            Case ST_DONE
                wsProd.Cells(r, c).Font.Color = CLR_TEXT_HINT
            Case Else
                wsProd.Cells(r, c).Font.Color = CLR_TEXT_LIGHT
        End Select
    Next c
    On Error GoTo 0
End Sub

