Attribute VB_Name = "M08_Utils"
Public Function SafeStr(v As Variant) As String
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Then SafeStr = "" Else SafeStr = CStr(v)
    On Error GoTo 0
End Function

Public Function SafeLng(v As Variant) As Long
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Or Not IsNumeric(v) Then SafeLng = 0 Else SafeLng = CLng(v)
    On Error GoTo 0
End Function

Public Function SafeDbl(v As Variant) As Double
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Or Not IsNumeric(v) Then SafeDbl = 0 Else SafeDbl = CDbl(v)
    On Error GoTo 0
End Function

Public Function SafeIsDate(v As Variant) As Boolean
    On Error Resume Next
    If IsNull(v) Or IsEmpty(v) Then SafeIsDate = False Else SafeIsDate = IsDate(v)
    On Error GoTo 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ³¯Â¥ ÇÔ¼ö
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function FmtDate(dt As Date) As String
    FmtDate = Format(dt, "YYYY-MM-DD")
End Function

Public Function TodayStr() As String
    TodayStr = FmtDate(Date)
End Function

Public Function ParseDate(v As Variant) As Date
    On Error Resume Next
    If SafeIsDate(v) Then ParseDate = CDate(v) Else ParseDate = 0
    On Error GoTo 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  AdjustToWeekday: ÁÖ¸»ÀÌ¸é ´ÙÀ½ ¿ù¿äÀÏ, ÆòÀÏÀÌ¸é ±×´ë·Î
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
Public Function AdjustToWeekday(dt As Date) As Date
    Dim wd As Long: wd = Weekday(dt, vbSunday)
    If wd = 7 Then          ' Åä¿äÀÏ ¡æ +2
        AdjustToWeekday = dt + 2
    ElseIf wd = 1 Then      ' ÀÏ¿äÀÏ ¡æ +1
        AdjustToWeekday = dt + 1
    Else
        AdjustToWeekday = dt
    End If
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  GetLastRow / GetLastCol
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetLastRow(ws As Worksheet, col As Long) As Long
    On Error Resume Next
    GetLastRow = ws.Cells(ws.rows.count, col).End(xlUp).row
    If GetLastRow = 0 Then GetLastRow = 1
    On Error GoTo 0
End Function

Public Function GetLastCol(ws As Worksheet, r As Long) As Long
    On Error Resume Next
    GetLastCol = ws.Cells(r, ws.Columns.count).End(xlToLeft).Column
    If GetLastCol = 0 Then GetLastCol = 1
    On Error GoTo 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  Route ÇÔ¼ö
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function BuildRoute(prodType As String, heat As String, _
                           Optional dcJoint As String = "") As String
    Dim t As String: t = UCase(Trim(prodType))
    Dim h As String: h = UCase(Trim(heat))
    Dim d As String: d = UCase(Trim(dcJoint))
    Dim parts() As String
    Dim cnt As Long: cnt = 0
    ReDim parts(1 To 6)

    cnt = cnt + 1: parts(cnt) = PROC_DEGREASING
    cnt = cnt + 1: parts(cnt) = PROC_SINTERING
    If t = "BL" Then cnt = cnt + 1: parts(cnt) = PROC_REDUCTION
    cnt = cnt + 1: parts(cnt) = PROC_FLATTENING
    If d <> "BRAZING" Then cnt = cnt + 1: parts(cnt) = PROC_PLATING
    If h = "Y" Then cnt = cnt + 1: parts(cnt) = PROC_HEATTREAT

    Dim result As String: result = ""
    Dim i As Long
    For i = 1 To cnt
        If i > 1 Then result = result & " > "
        result = result & parts(i)
    Next i
    BuildRoute = result
End Function
Public Function GetFirstProc(route As String) As String
    Dim parts() As String
    If Trim(route) = "" Then GetFirstProc = "": Exit Function
    parts = Split(route, " > ")
    GetFirstProc = Trim(parts(0))
End Function

Public Function GetNextProc(currentProc As String, route As String) As String
    Dim parts() As String
    Dim i As Long
    If Trim(route) = "" Then GetNextProc = "": Exit Function
    parts = Split(route, " > ")
    For i = 0 To UBound(parts) - 1
        If Trim(parts(i)) = Trim(currentProc) Then
            GetNextProc = Trim(parts(i + 1)): Exit Function
        End If
    Next i
    GetNextProc = ""
End Function

Public Function CountProcsInRoute(route As String) As Long
    Dim parts() As String
    If Trim(route) = "" Then CountProcsInRoute = 0: Exit Function
    parts = Split(route, " > ")
    CountProcsInRoute = UBound(parts) + 1
End Function

Public Function GetProcIndex(procName As String, route As String) As Long
    Dim parts() As String
    Dim i As Long
    If Trim(route) = "" Then GetProcIndex = 0: Exit Function
    parts = Split(route, " > ")
    For i = 0 To UBound(parts)
        If Trim(parts(i)) = Trim(procName) Then GetProcIndex = i + 1: Exit Function
    Next i
    GetProcIndex = 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  °øÁ¤ ¼Ò¿äÀÏ¼ö (4ÀÎÀÚ ¹öÀü ? ±âº»)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetProcDays(procName As String, prodType As String, _
                              stackQty As Long, dcJoint As String) As Long
    Select Case Trim(procName)
        Case PROC_DEGREASING
            GetProcDays = 6
        Case PROC_SINTERING
            If stackQty >= 9 Then GetProcDays = 5 Else GetProcDays = 3
        Case PROC_REDUCTION
            If UCase(Trim(prodType)) = "BL" Then GetProcDays = 3 Else GetProcDays = 0
        Case PROC_FLATTENING
            GetProcDays = 3
        Case PROC_PLATING
            Select Case Trim(dcJoint)
                Case "Brazing":              GetProcDays = 0
                Case "Spring", "Soldering":  GetProcDays = 1
                Case Else:                   GetProcDays = 1
            End Select
        Case PROC_HEATTREAT
            GetProcDays = 1
        Case Else
            GetProcDays = 0
    End Select
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  °øÁ¤ ¼Ò¿äÀÏ¼ö (2ÀÎÀÚ ¹öÀü ? Á¦Ç°¸í ±â¹Ý ÀÚµ¿ Á¶È¸, v9.6 ÀÌ½Ä)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetProcDaysByName(prodName As String, procName As String) As Long
       On Error Resume Next
    Dim wsPrd As Worksheet: Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    Dim days As Long: days = 0
    
    Select Case Trim(procName)
        Case PROC_DEGREASING:  days = SafeLng(wsPrd.Cells(pRow, PRD_COL_D1).Value)
        Case PROC_SINTERING:   days = SafeLng(wsPrd.Cells(pRow, PRD_COL_D2).Value)
        Case PROC_REDUCTION:   days = SafeLng(wsPrd.Cells(pRow, PRD_COL_D3).Value)
        Case PROC_FLATTENING:  days = SafeLng(wsPrd.Cells(pRow, PRD_COL_D4).Value)
        Case PROC_PLATING:     days = SafeLng(wsPrd.Cells(pRow, PRD_COL_D5).Value)
        Case PROC_HEATTREAT:   days = SafeLng(wsPrd.Cells(pRow, PRD_COL_D6).Value)
    End Select
    
    GetProcDaysByProduct = days
    On Error GoTo 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ¼Ò¿äÀÏ¼ö ÀÏ°ý °è»ê + Product ½ÃÆ® ±â·Ï
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Sub CalcAndWriteDays(wsPrd As Worksheet, r As Long)
    Dim pType As String: pType = SafeStr(wsPrd.Cells(r, PRD_COL_TYPE).Value)
    Dim stack As Long: stack = SafeLng(wsPrd.Cells(r, PRD_COL_STACK).Value)
    Dim dc    As String: dc = SafeStr(wsPrd.Cells(r, PRD_COL_DC).Value)
    Dim heat  As String: heat = SafeStr(wsPrd.Cells(r, PRD_COL_HEAT).Value)
    Dim route As String: route = BuildRoute(pType, heat)
    Dim d1 As Long, d2 As Long, d3 As Long, d4 As Long, d5 As Long, d6 As Long

    d1 = GetProcDays(PROC_DEGREASING, pType, stack, dc)
    d2 = GetProcDays(PROC_SINTERING, pType, stack, dc)
    d3 = IIf(InStr(route, PROC_REDUCTION) > 0, GetProcDays(PROC_REDUCTION, pType, stack, dc), 0)
    d4 = GetProcDays(PROC_FLATTENING, pType, stack, dc)
    d5 = GetProcDays(PROC_PLATING, pType, stack, dc)
    d6 = IIf(UCase(heat) = "Y", GetProcDays(PROC_HEATTREAT, pType, stack, dc), 0)

    wsPrd.Cells(r, PRD_COL_D1).Value = d1
    wsPrd.Cells(r, PRD_COL_D2).Value = d2
    wsPrd.Cells(r, PRD_COL_D3).Value = d3
    wsPrd.Cells(r, PRD_COL_D4).Value = d4
    wsPrd.Cells(r, PRD_COL_D5).Value = d5
    wsPrd.Cells(r, PRD_COL_D6).Value = d6
    wsPrd.Cells(r, PRD_COL_LT).Value = d1 + d2 + d3 + d4 + d5 + d6
    wsPrd.Cells(r, PRD_COL_ROUTE).Value = route
End Sub

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ¼³ºñ ¸ñ·Ï (ÇöÀå ¹Ý¿µ ? v10.0 ÀÌ½Ä)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetEquipListForProc(procName As String, prodType As String) As String
    Dim r As String: r = ""
    Dim t As String: t = UCase(Trim(prodType))
    Select Case Trim(procName)
        Case PROC_DEGREASING
            r = "1È£±â,2È£±â,3È£±â"
        Case PROC_SINTERING
            If t = "BL" Then
                r = "1È£±â,4È£±â"
            Else
                r = "5È£±â,10È£±â,11È£±â,12È£±â,13È£±â,14È£±â,15È£±â,16È£±â,17È£±â,18È£±â"
            End If
        Case PROC_REDUCTION
            If t = "BL" Then r = "2È£±â" Else r = ""
        Case PROC_FLATTENING
            If t = "BL" Then
                r = "3È£±â"
            Else
                r = "6È£±â,7È£±â,8È£±â,9È£±â"
            End If
        Case PROC_PLATING
            r = "¿ÜÁÖ"
        Case PROC_HEATTREAT
            r = "GB"
        Case Else
            r = ""
    End Select
    GetEquipListForProc = r
End Function

Public Function IsAutoEquip(procName As String, prodType As String) As Boolean
    Dim lst As String: lst = GetEquipListForProc(procName, prodType)
    IsAutoEquip = (Len(lst) = 0) Or (InStr(lst, ",") = 0)
End Function

Public Function GetAutoEquip(procName As String, prodType As String) As String
    Dim lst As String: lst = GetEquipListForProc(procName, prodType)
    If Len(lst) = 0 Or InStr(lst, ",") > 0 Then
        GetAutoEquip = ""
    Else
        GetAutoEquip = lst
    End If
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ÁøÇà·ü (v9.6 ¹æ½Ä: ÁøÇà Áß = Áß°£°ª)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function CalcProgressPct(currentProc As String, currentStatus As String, _
                                  route As String) As Double
    CalcProgressPct = 0
    If currentStatus = ST_DONE Then CalcProgressPct = 1: Exit Function
    If currentStatus = ST_WAIT Or currentStatus = "" Then Exit Function
    If currentStatus = ST_SCRAP Then Exit Function

    Dim total As Long: total = CountProcsInRoute(route)
    If total = 0 Then total = 1
    Dim idx As Long: idx = GetProcIndex(currentProc, route)
    If idx = 0 Then idx = 1

    ' ÁøÇà Áß = ÀÌÀü °øÁ¤ ¿Ï·áºÐ + ÇöÀç °øÁ¤ÀÇ 50%
    CalcProgressPct = (idx - 1) / total + (1 / total * 0.5)
    If CalcProgressPct > 1 Then CalcProgressPct = 1
End Function

Public Sub CalcAndWriteProgress(wsProd As Worksheet, r As Long)
    Dim proc   As String: proc = SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value)
    Dim status As String: status = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
    Dim route  As String: route = SafeStr(wsProd.Cells(r, PROD_COL_ROUTE).Value)
    wsProd.Cells(r, PROD_COL_PROGRESS).Value = CalcProgressPct(proc, status, route)
End Sub

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  Áö¿¬ Ã¼Å©
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Sub CheckDelayStatus()
    Dim wsProd As Worksheet
    Dim lastR  As Long
    Dim r      As Long
    Dim status As String
    Dim vEnd   As Variant
    On Error GoTo ErrH

    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    lastR = GetLastRow(wsProd, PROD_COL_SN)
    If lastR < PROD_DATA_START Then Exit Sub

    For r = PROD_DATA_START To lastR
        If Len(SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)) = 0 Then GoTo nextChk
        status = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
        If status = ST_PROG Then
            vEnd = wsProd.Cells(r, PROD_COL_END).Value
            If SafeIsDate(vEnd) Then
                If CDate(vEnd) < Date Then
                    wsProd.Cells(r, PROD_COL_STATUS).Value = ST_DELAY
                End If
            End If
        End If
        ' D+ °»½Å
        If status = ST_PROG Or status = ST_DELAY Then
            If SafeIsDate(wsProd.Cells(r, PROD_COL_START).Value) Then
                wsProd.Cells(r, PROD_COL_DPLUS).Value = _
                    Date - CDate(wsProd.Cells(r, PROD_COL_START).Value)
            End If
        End If
nextChk:
    Next r
    Exit Sub
ErrH:
    ' ¹«½Ã
End Sub

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  »ö»ó ÇïÆÛ
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetProcColor(procName As String) As Long
    Select Case Trim(procName)
        Case PROC_DEGREASING: GetProcColor = CLR_CYAN
        Case PROC_SINTERING:  GetProcColor = CLR_ORANGE
        Case PROC_REDUCTION:  GetProcColor = CLR_PURPLE
        Case PROC_FLATTENING: GetProcColor = CLR_GREEN
        Case PROC_PLATING:    GetProcColor = CLR_YELLOW
        Case PROC_HEATTREAT:  GetProcColor = CLR_RED
        Case Else:            GetProcColor = CLR_TEXT_MID
    End Select
End Function

Public Function GetProcColorDim(procName As String) As Long
    Select Case Trim(procName)
        Case PROC_DEGREASING: GetProcColorDim = RGB(30, 60, 70)
        Case PROC_SINTERING:  GetProcColorDim = RGB(70, 55, 30)
        Case PROC_REDUCTION:  GetProcColorDim = RGB(60, 35, 70)
        Case PROC_FLATTENING: GetProcColorDim = RGB(30, 60, 40)
        Case PROC_PLATING:    GetProcColorDim = RGB(65, 65, 35)
        Case PROC_HEATTREAT:  GetProcColorDim = RGB(70, 35, 35)
        Case Else:            GetProcColorDim = CLR_BG_MID
    End Select
End Function

Public Function GetTypeColor(pType As String) As Long
    Select Case UCase(Trim(pType))
        Case "BL": GetTypeColor = CLR_BLUE
        Case "WN": GetTypeColor = CLR_GREEN
        Case "HP": GetTypeColor = CLR_ORANGE
        Case Else: GetTypeColor = CLR_TEXT_MID
    End Select
End Function

Public Function GetStatusBadgeBG(status As String) As Long
    Select Case status
        Case ST_WAIT:  GetStatusBadgeBG = CLR_BADGE_WAIT_BG
        Case ST_PROG:  GetStatusBadgeBG = CLR_BADGE_PROG_BG
        Case ST_DONE:  GetStatusBadgeBG = CLR_BADGE_DONE_BG
        Case ST_DELAY: GetStatusBadgeBG = CLR_BADGE_DELAY_BG
        Case ST_SCRAP: GetStatusBadgeBG = CLR_BADGE_SCRAP_BG
        Case Else:     GetStatusBadgeBG = CLR_BG_MID
    End Select
End Function

Public Function GetStatusBadgeTX(status As String) As Long
    Select Case status
        Case ST_WAIT:  GetStatusBadgeTX = CLR_BADGE_WAIT_TX
        Case ST_PROG:  GetStatusBadgeTX = CLR_WHITE
        Case ST_DONE:  GetStatusBadgeTX = CLR_WHITE
        Case ST_DELAY: GetStatusBadgeTX = CLR_WHITE
        Case ST_SCRAP: GetStatusBadgeTX = CLR_BADGE_SCRAP_TX
        Case Else:     GetStatusBadgeTX = CLR_TEXT_LIGHT
    End Select
End Function

Public Function GetStatusList(currentStatus As String) As String
    Select Case currentStatus
        Case ST_WAIT:  GetStatusList = ST_WAIT & "," & ST_PROG
        Case ST_PROG:  GetStatusList = ST_PROG & "," & ST_DONE
        Case ST_DELAY: GetStatusList = ST_DELAY & "," & ST_DONE
        Case ST_DONE:  GetStatusList = ST_DONE
        Case ST_SCRAP: GetStatusList = ST_SCRAP
        Case Else:     GetStatusList = ST_WAIT
    End Select
End Function

Public Function GetProcessList() As String
    GetProcessList = PROC_DEGREASING & "," & PROC_SINTERING & "," & PROC_REDUCTION & _
                     "," & PROC_FLATTENING & "," & PROC_PLATING & "," & PROC_HEATTREAT
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ¼­½Ä À¯Æ¿
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Sub ApplyCellBorder(cell As Range, borderColor As Long, lineStyle As XlLineStyle)
    With cell.Borders(xlEdgeBottom)
        .lineStyle = lineStyle
        .Color = borderColor
        .Weight = xlThin
    End With
End Sub

Public Sub FormatSNCell(cell As Range, snValue As String)
    cell.Value = snValue
    cell.Font.Name = "Consolas"
    cell.Font.Size = 8
    cell.Font.Color = CLR_TEXT_LIGHT
End Sub

Public Sub FormatBadgeCell(cell As Range, status As String)
    cell.Value = status
    cell.Interior.Color = GetStatusBadgeBG(status)
    cell.Font.Color = GetStatusBadgeTX(status)
    cell.Font.Bold = True
    cell.Font.Size = 8
    cell.HorizontalAlignment = xlCenter
End Sub

Public Sub CenterAcross(ws As Worksheet, r As Long, colStart As Long, colEnd As Long, _
                         txt As String, fontSize As Long, isBold As Boolean, fontColor As Long)
    On Error Resume Next
    Dim rng As Range
    Set rng = ws.Range(ws.Cells(r, colStart), ws.Cells(r, colEnd))
    rng.MergeCells = False
    rng.UnMerge
    rng.HorizontalAlignment = xlCenterAcrossSelection
    rng.VerticalAlignment = xlVAlignCenter
    With ws.Cells(r, colStart)
        .Value = txt
        .Font.Name = "¸¼Àº °íµñ"
        .Font.Size = fontSize
        .Font.Bold = isBold
        .Font.Color = fontColor
    End With
    Dim ci As Long
    For ci = colStart + 1 To colEnd
        ws.Cells(r, ci).Value = ""
    Next ci
    On Error GoTo 0
End Sub

Public Sub AddDataValidation(rng As Range, listStr As String)
    On Error Resume Next
    With rng.Validation
        .Delete
        .Add Type:=xlValidateList, _
             AlertStyle:=xlValidAlertInformation, _
             Formula1:=listStr
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowInput = False
        .ShowError = False    ' ¡Ú ¸ñ·Ï ¿Ü Á÷Á¢ÀÔ·Â Çã¿ë
    End With
    On Error GoTo 0
End Sub

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  Á¦Ç° Á¶È¸ (v9.6 ÀÌ½Ä)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function FindProductRow(prodName As String) As Long
    FindProductRow = 0
    On Error Resume Next
    Dim wsPrd As Worksheet: Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    If wsPrd Is Nothing Then Exit Function
    Dim lr As Long: lr = GetLastRow(wsPrd, PRD_COL_NAME)
    Dim ri As Long
    For ri = PRD_DATA_START To lr
        If SafeStr(wsPrd.Cells(ri, PRD_COL_NAME).Value) = Trim(prodName) Then
            FindProductRow = ri: Exit Function
        End If
    Next ri
    On Error GoTo 0
End Function

Public Function GetProductList() As Variant
    On Error Resume Next
    Dim wsPrd As Worksheet: Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    If wsPrd Is Nothing Then GetProductList = Array(): Exit Function
    Dim lr As Long: lr = GetLastRow(wsPrd, PRD_COL_NAME)
    If lr < PRD_DATA_START Then GetProductList = Array(): Exit Function

    Dim arr() As String
    Dim cnt   As Long: cnt = 0
    Dim ri    As Long
    Dim pn    As String
    For ri = PRD_DATA_START To lr
        pn = SafeStr(wsPrd.Cells(ri, PRD_COL_NAME).Value)
        If pn <> "" Then
            cnt = cnt + 1
            ReDim Preserve arr(1 To cnt)
            arr(cnt) = pn
        End If
    Next ri
    If cnt = 0 Then GetProductList = Array() Else GetProductList = arr
    On Error GoTo 0
End Function

Public Function GetProductInfo(prodName As String) As Variant
    Dim wsPrd As Worksheet
    Dim lastR As Long
    Dim r     As Long
    On Error GoTo ErrH

    Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    lastR = GetLastRow(wsPrd, PRD_COL_NAME)
    If lastR < PRD_DATA_START Then GetProductInfo = Empty: Exit Function

    For r = PRD_DATA_START To lastR
        If SafeStr(wsPrd.Cells(r, PRD_COL_NAME).Value) = Trim(prodName) Then
            GetProductInfo = Array( _
                SafeStr(wsPrd.Cells(r, PRD_COL_TYPE).Value), _
                SafeStr(wsPrd.Cells(r, PRD_COL_DRAWING).Value), _
                SafeStr(wsPrd.Cells(r, PRD_COL_SHRINK).Value), _
                SafeLng(wsPrd.Cells(r, PRD_COL_STACK).Value), _
                SafeStr(wsPrd.Cells(r, PRD_COL_DC).Value), _
                SafeStr(wsPrd.Cells(r, PRD_COL_HEAT).Value), _
                SafeStr(wsPrd.Cells(r, PRD_COL_ROUTE).Value) _
            )
            Exit Function
        End If
    Next r
    GetProductInfo = Empty
    Exit Function
ErrH:
    GetProductInfo = Empty
End Function

Public Function CleanProductCode(pName As String) As String
    On Error Resume Next
    Dim s As String: s = Replace(pName, " ", "")
    s = Replace(s, "-", "")
    If Len(s) > 8 Then s = Left(s, 8)
    CleanProductCode = UCase(s)
    On Error GoTo 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  SN Ä«¿îÆ® (v9.6 ÀÌ½Ä)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetSNCountForBatch(batchCode As String) As Long
    GetSNCountForBatch = 0
    If Len(batchCode) = 0 Then Exit Function
    On Error Resume Next
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    If wsProd Is Nothing Then Exit Function
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_BATCH)
    If lr < PROD_DATA_START Then Exit Function
    Dim r As Long
    Dim cnt As Long: cnt = 0
    For r = PROD_DATA_START To lr
        If SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value) = batchCode Then cnt = cnt + 1
    Next r
    GetSNCountForBatch = cnt
    On Error GoTo 0
End Function

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ProcLog CRUD
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Function GetMaxLogID() As Long
    Dim wsPlog As Worksheet
    Dim lastR  As Long
    Dim r      As Long
    Dim maxID  As Long
    Dim v      As Long
    On Error GoTo ErrH
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    lastR = GetLastRow(wsPlog, PLOG_COL_LOGID)
    maxID = 0
    If lastR >= PLOG_DATA_START Then
        For r = PLOG_DATA_START To lastR
            v = SafeLng(wsPlog.Cells(r, PLOG_COL_LOGID).Value)
            If v > maxID Then maxID = v
        Next r
    End If
    GetMaxLogID = maxID
    Exit Function
ErrH:
    GetMaxLogID = 0
End Function

Public Sub InsertProcLog(sn As String, batch As String, pName As String, _
                          pType As String, proc As String, pOrder As Long, _
                          equip As String, status As String, _
                          sDate As String, eDate As String, planDays As Long)
    Dim wsPlog As Worksheet
    Dim newR   As Long
    Dim newID  As Long
    On Error GoTo ErrH
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    newR = GetLastRow(wsPlog, PLOG_COL_LOGID) + 1
    If newR < PLOG_DATA_START Then newR = PLOG_DATA_START
    newID = GetMaxLogID() + 1

    wsPlog.Cells(newR, PLOG_COL_LOGID).Value = newID
    wsPlog.Cells(newR, PLOG_COL_SN).Value = sn
    wsPlog.Cells(newR, PLOG_COL_BATCH).Value = batch
    wsPlog.Cells(newR, PLOG_COL_NAME).Value = pName
    wsPlog.Cells(newR, PLOG_COL_TYPE).Value = pType
    wsPlog.Cells(newR, PLOG_COL_PROC).Value = proc
    wsPlog.Cells(newR, PLOG_COL_ORDER).Value = pOrder
    wsPlog.Cells(newR, PLOG_COL_EQUIP).Value = equip
    wsPlog.Cells(newR, PLOG_COL_STATUS).Value = status
    wsPlog.Cells(newR, PLOG_COL_SDATE).Value = sDate
    wsPlog.Cells(newR, PLOG_COL_PLANEND).Value = eDate
    wsPlog.Cells(newR, PLOG_COL_PLANDAYS).Value = planDays
    wsPlog.Cells(newR, PLOG_COL_LOGTIME).Value = Now()
    Exit Sub
ErrH:
    ' ¹«½Ã
End Sub

Public Sub UpdateProcLogStatus(sn As String, procName As String, _
                                 newStatus As String, _
                                 Optional completedDate As String = "", _
                                 Optional actualDays As Long = 0, _
                                 Optional defectType As String = "")
    Dim wsPlog As Worksheet
    Dim lastR  As Long
    Dim r      As Long
    Dim foundR As Long
    On Error GoTo ErrH
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    lastR = GetLastRow(wsPlog, PLOG_COL_LOGID)
    foundR = 0
    For r = lastR To PLOG_DATA_START Step -1
        If SafeStr(wsPlog.Cells(r, PLOG_COL_SN).Value) = sn And _
           SafeStr(wsPlog.Cells(r, PLOG_COL_PROC).Value) = procName Then
            foundR = r: Exit For
        End If
    Next r
    If foundR = 0 Then Exit Sub
    wsPlog.Cells(foundR, PLOG_COL_STATUS).Value = newStatus
    If completedDate <> "" Then wsPlog.Cells(foundR, PLOG_COL_ACTEND).Value = completedDate
    If actualDays > 0 Then wsPlog.Cells(foundR, PLOG_COL_ACTDAYS).Value = actualDays
    If defectType <> "" Then wsPlog.Cells(foundR, PLOG_COL_DEFECT).Value = defectType
    wsPlog.Cells(foundR, PLOG_COL_LOGTIME).Value = Now()
    Exit Sub
ErrH:
    ' ¹«½Ã
End Sub

Public Sub UpdateProcLogField(sn As String, procName As String, _
                               fieldCol As Long, Value As Variant)
    Dim wsPlog As Worksheet
    Dim lastR  As Long
    Dim r      As Long
    Dim foundR As Long
    On Error GoTo ErrH
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    lastR = GetLastRow(wsPlog, PLOG_COL_LOGID)
    foundR = 0
    For r = lastR To PLOG_DATA_START Step -1
        If SafeStr(wsPlog.Cells(r, PLOG_COL_SN).Value) = sn And _
           SafeStr(wsPlog.Cells(r, PLOG_COL_PROC).Value) = procName Then
            foundR = r: Exit For
        End If
    Next r
    If foundR = 0 Then Exit Sub
    wsPlog.Cells(foundR, fieldCol).Value = Value
    wsPlog.Cells(foundR, PLOG_COL_LOGTIME).Value = Now()
    Exit Sub
ErrH:
    ' ¹«½Ã
End Sub

Public Function GetFirstStartDateFromProcLog(sn As String) As String
    ' ¡Ú Ä³½Ã ¿ì¼±
    If IsCacheReady() Then
        GetFirstStartDateFromProcLog = GetCachedFirstStartDate(sn)
        Exit Function
    End If
    
    ' ¦¡¦¡ ±âÁ¸ ¹æ½Ä fallback ¦¡¦¡
    Dim wsPlog  As Worksheet
    Dim lastR   As Long
    Dim r       As Long
    Dim minDate As Date
    Dim vS      As Variant
    Dim found   As Boolean
    On Error GoTo ErrH
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    lastR = GetLastRow(wsPlog, PLOG_COL_SN)
    found = False
    minDate = #12/31/9999#
    GetFirstStartDateFromProcLog = ""
    If lastR >= PLOG_DATA_START Then
        For r = PLOG_DATA_START To lastR
            If SafeStr(wsPlog.Cells(r, PLOG_COL_SN).Value) = sn Then
                vS = wsPlog.Cells(r, PLOG_COL_SDATE).Value
                If SafeIsDate(vS) Then
                    If CDate(vS) < minDate Then minDate = CDate(vS): found = True
                End If
            End If
        Next r
    End If
    If found Then GetFirstStartDateFromProcLog = FmtDate(minDate)
    Exit Function
ErrH:
    GetFirstStartDateFromProcLog = ""
End Function

Public Sub RebuildProcLog()
    Dim wsProd  As Worksheet
    Dim wsPlog  As Worksheet
    Dim lastR   As Long
    Dim r       As Long
    Dim sn As String, batch As String, pName As String, pType As String
    Dim route As String, stack As Long, dc As String
    Dim parts() As String
    Dim p As Long, equip As String, pStatus As String, planD As Long
    On Error GoTo ErrH
    If MsgBox("ProcLog¸¦ ÀüÃ¼ Àç±¸ÃàÇÕ´Ï´Ù. ±âÁ¸ µ¥ÀÌÅÍ°¡ »èÁ¦µË´Ï´Ù. °è¼ÓÇÏ½Ã°Ú½À´Ï±î?", _
              vbYesNo + vbWarning) = vbNo Then Exit Sub
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    lastR = GetLastRow(wsPlog, PLOG_COL_LOGID)
    If lastR >= PLOG_DATA_START Then wsPlog.rows(PLOG_DATA_START & ":" & lastR).Delete
    lastR = GetLastRow(wsProd, PROD_COL_SN)
    If lastR >= PROD_DATA_START Then
        For r = PROD_DATA_START To lastR
            sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
            If sn = "" Then GoTo nextRebuild
            batch = SafeStr(wsProd.Cells(r, PROD_COL_BATCH).Value)
            pName = SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value)
            pType = SafeStr(wsProd.Cells(r, PROD_COL_TYPE).Value)
            route = SafeStr(wsProd.Cells(r, PROD_COL_ROUTE).Value)
            stack = SafeLng(wsProd.Cells(r, PROD_COL_STACK).Value)
            dc = SafeStr(wsProd.Cells(r, PROD_COL_DC).Value)
            parts = Split(route, " > ")
            For p = 0 To UBound(parts)
                equip = GetAutoEquip(Trim(parts(p)), pType)
                pStatus = IIf(p = 0, ST_WAIT, "")
                planD = GetProcDays(Trim(parts(p)), pType, stack, dc)
                InsertProcLog sn, batch, pName, pType, Trim(parts(p)), p + 1, _
                              equip, pStatus, "", "", planD
            Next p
nextRebuild:
        Next r
    End If
    MsgBox "ProcLog Àç±¸Ãà ¿Ï·á.", vbInformation
    Exit Sub
ErrH:
    MsgBox "RebuildProcLog ¿À·ù: " & Err.Description, vbCritical
End Sub

' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡
'  ResetWorkbook (v9.6 ÀÌ½Ä)
' ¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡¦¡

Public Sub ResetWorkbook()
    On Error Resume Next
    If MsgBox("ÀüÃ¼ µ¥ÀÌÅÍ¸¦ ÃÊ±âÈ­ÇÏ½Ã°Ú½À´Ï±î?" & vbCrLf & _
              "¸ðµç ½ÃÆ®°¡ »èÁ¦µÇ°í Àç»ý¼ºµË´Ï´Ù.", _
              vbQuestion + vbYesNo) <> vbYes Then Exit Sub
    Application.DisplayAlerts = False
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If ThisWorkbook.Worksheets.count > 1 Then ws.Delete
    Next ws
    Application.DisplayAlerts = True
    InitializeSystem
    On Error GoTo 0
End Sub

' ============================================================
'  µ¥ÀÌÅÍ ÃÊ±âÈ­ (½ÃÆ® ±¸Á¶ À¯Áö, µ¥ÀÌÅÍ¸¸ »èÁ¦)
' ============================================================
Public Sub ResetAllData()
    On Error GoTo ErrH
    If MsgBox("¸ðµç »ý»ê µ¥ÀÌÅÍ¸¦ ÃÊ±âÈ­ÇÏ½Ã°Ú½À´Ï±î?" & vbCrLf & _
              "(Product ¸¶½ºÅÍ´Â À¯ÁöµË´Ï´Ù)", _
              vbQuestion + vbYesNo) <> vbYes Then Exit Sub

    Application.ScreenUpdating = False
    Application.DisplayAlerts = False

    ' Production µ¥ÀÌÅÍ »èÁ¦
    Dim wsProd As Worksheet: Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim lr As Long: lr = GetLastRow(wsProd, PROD_COL_SN)
    If lr >= PROD_DATA_START Then
        wsProd.rows(PROD_DATA_START & ":" & lr).Delete
    End If

    ' ProcLog µ¥ÀÌÅÍ »èÁ¦
    Dim wsPlog As Worksheet: Set wsPlog = ThisWorkbook.sheets(SHT_PROCLOG)
    lr = GetLastRow(wsPlog, PLOG_COL_LOGID)
    If lr >= PLOG_DATA_START Then
        wsPlog.rows(PLOG_DATA_START & ":" & lr).Delete
    End If

    ' Archive µ¥ÀÌÅÍ »èÁ¦
    Dim wsArc As Worksheet: Set wsArc = ThisWorkbook.sheets(SHT_ARCHIVE)
    lr = GetLastRow(wsArc, ARC_COL_SN)
    If lr >= ARC_DATA_START Then
        wsArc.rows(ARC_DATA_START & ":" & lr).Delete
    End If

    Application.DisplayAlerts = True
    Application.ScreenUpdating = True

    RefreshWorkSpace
    MsgBox "µ¥ÀÌÅÍ ÃÊ±âÈ­ ¿Ï·á. Product ¸¶½ºÅÍ´Â À¯ÁöµË´Ï´Ù.", vbInformation
    Exit Sub
ErrH:
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    MsgBox "ResetAllData ¿À·ù: " & Err.Description, vbCritical
End Sub

Sub ChkAfter()
    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets("ProcLog")
    Dim r As Long
    For r = 6 To 10
        Debug.Print "R" & r & ": " & ws.Cells(r, 8).Value & " | »óÅÂ=" & ws.Cells(r, 11).Value & " | ½ÃÀÛ=" & ws.Cells(r, 12).Value & " | ¿¹Á¤=" & ws.Cells(r, 13).Value
    Next r
End Sub


Sub ChkEdit2()
    ' 1. ÆíÁý¸ðµå °­Á¦ ÁøÀÔ
    EnterEditMode
    
    ' 2. ¸ðµå È®ÀÎ
    Debug.Print "¸ðµå: [" & g_CurrentMode & "]"
    
    ' 3. µµÇü È®ÀÎ
    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets("Work Space")
    Dim shp As Shape
    Dim cnt As Long: cnt = 0
    For Each shp In ws.Shapes
        If Left(shp.Name, 4) = "SPIN" Or Left(shp.Name, 3) = "DD_" Then
            cnt = cnt + 1
            If cnt <= 5 Then Debug.Print shp.Name & " Top=" & Int(shp.Top)
        End If
    Next shp
    Debug.Print "ÆíÁý µµÇü ¼ö: " & cnt
    
    ' 4. Á¦Ç°Çà ½ÃÀÛÀÏ
    Debug.Print "R10 C10=" & ws.Cells(10, 10).Value & " | C11=" & ws.Cells(10, 11).Value
    
    ' 5. SNÇà ½ÃÀÛÀÏ
    Debug.Print "R11 C10=" & ws.Cells(11, 10).Value & " | C11=" & ws.Cells(11, 11).Value
End Sub
Sub ChkPLog2()
    Dim ws As Worksheet: Set ws = ThisWorkbook.sheets(SHT_PROCLOG)
    Dim r As Long
    For r = 6 To 30
        If InStr(SafeStr(ws.Cells(r, PLOG_COL_SN).Value), "ASASD-L001") > 0 Then
            Debug.Print "R" & r & ": " & _
                ws.Cells(r, PLOG_COL_PROC).Value & " | " & _
                ws.Cells(r, PLOG_COL_STATUS).Value & " | " & _
                ws.Cells(r, PLOG_COL_SDATE).Value & " | " & _
                ws.Cells(r, PLOG_COL_PLANEND).Value & " | " & _
                ws.Cells(r, PLOG_COL_PLANDAYS).Value
        End If
    Next r
End Sub

'================================================================
' ToggleWSView: Work Space ¿­ Á¢±â/ÆîÄ¡±â
'================================================================
Public Sub ToggleWSView()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.sheets(SHT_WORKSPACE)
    
    On Error GoTo ErrH
    Application.ScreenUpdating = False
    
    ' ÇöÀç »óÅÂ ÆÇº°: °øÁ¤ ¿­ ÆøÀÌ 0ÀÌ¸é Á¢Èù »óÅÂ
    If ws.Columns(WS_COL_PROC).ColumnWidth < 1 Then
        ' ¦¡¦¡ ÆîÄ¡±â ¦¡¦¡
        ApplyWSColumnWidths ws, False
    Else
        ' ¦¡¦¡ Á¢±â ¦¡¦¡
        ApplyWSColumnWidths ws, True
    End If
    
    Application.ScreenUpdating = True
    Exit Sub
ErrH:
    Application.ScreenUpdating = True
    MsgBox "ToggleWSView ¿À·ù: " & Err.Description, vbExclamation
End Sub

'================================================================
' ApplyWSColumnWidths: ¿­ Æø ÀÏ°ý Àû¿ë
'================================================================
Public Sub ApplyWSColumnWidths(ws As Worksheet, isCollapsed As Boolean)
    On Error Resume Next
    
    If isCollapsed Then
        ' ¦¡¦¡ Á¢Èù »óÅÂ: ÇÙ½É¸¸ ¦¡¦¡
        ws.Columns(WS_COL_MAIN).ColumnWidth = WS_CW_MAIN_COLL
        ws.Columns(WS_COL_QTY).ColumnWidth = WS_CW_QTY_COLL
        ws.Columns(WS_COL_PROC).ColumnWidth = WS_CW_PROC_COLL
        ws.Columns(WS_COL_EQUIP).ColumnWidth = WS_CW_EQUIP_COLL
        ws.Columns(WS_COL_STATUS).ColumnWidth = WS_CW_STATUS_COLL
        ws.Columns(WS_COL_SDATE).ColumnWidth = WS_CW_SDATE_COLL
        ws.Columns(WS_COL_EDATE).ColumnWidth = WS_CW_EDATE_COLL
        ws.Columns(WS_COL_PROG).ColumnWidth = WS_CW_PROG_COLL
        ws.Columns(WS_COL_DPLUS).ColumnWidth = WS_CW_DPLUS_COLL
        ws.Columns(WS_COL_SPINUP).ColumnWidth = WS_CW_SPIN_COLL
        ws.Columns(WS_COL_SPINDN).ColumnWidth = WS_CW_SPIN_COLL
        ws.Columns(WS_COL_DIV).ColumnWidth = 0
    Else
        ' ¦¡¦¡ ÆîÄ£ »óÅÂ: ÀüÃ¼ ¦¡¦¡
        ws.Columns(WS_COL_MAIN).ColumnWidth = WS_CW_MAIN_EXP
        ws.Columns(WS_COL_QTY).ColumnWidth = WS_CW_QTY_EXP
        ws.Columns(WS_COL_PROC).ColumnWidth = WS_CW_PROC_EXP
        ws.Columns(WS_COL_EQUIP).ColumnWidth = WS_CW_EQUIP_EXP
        ws.Columns(WS_COL_STATUS).ColumnWidth = WS_CW_STATUS_EXP
        ws.Columns(WS_COL_SDATE).ColumnWidth = WS_CW_SDATE_EXP
        ws.Columns(WS_COL_EDATE).ColumnWidth = WS_CW_EDATE_EXP
        ws.Columns(WS_COL_PROG).ColumnWidth = WS_CW_PROG_EXP
        ws.Columns(WS_COL_DPLUS).ColumnWidth = WS_CW_DPLUS_EXP
        ws.Columns(WS_COL_SPINUP).ColumnWidth = WS_CW_SPIN_EXP
        ws.Columns(WS_COL_SPINDN).ColumnWidth = WS_CW_SPIN_EXP
        ws.Columns(WS_COL_DIV).ColumnWidth = 0.5
    End If
    
    On Error GoTo 0
End Sub
'================================================================
' BuildMemoShape: Ä¶¸°´õ MEMO ¿µ¿ª¿¡ °Ë»ç ÀÌ½´ µµÇü
'================================================================
Public Sub BuildMemoShape(ws As Worksheet)
    Dim shp As Shape
    Dim memoText As String
    Dim wsProd As Worksheet
    Dim lastR As Long
    Dim r As Long
    Dim memo As String
    Dim cnt As Long
    On Error GoTo ErrH
    
    ' ±âÁ¸ ¸Þ¸ð µµÇü »èÁ¦
    Dim i As Long
    For i = ws.Shapes.count To 1 Step -1
        If Left(ws.Shapes(i).Name, 9) = "SHP_MEMO_" Then ws.Shapes(i).Delete
    Next i
    
    ' ¦¡¦¡ °Ë»ç ¸Þ¸ð ¼öÁý ¦¡¦¡
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    lastR = GetLastRow(wsProd, PROD_COL_SN)
    cnt = 0
    memoText = ""
    
    If lastR >= PROD_DATA_START Then
        For r = PROD_DATA_START To lastR
            memo = SafeStr(wsProd.Cells(r, PROD_COL_INSP_MEMO).Value)
            If Len(memo) > 0 Then
                cnt = cnt + 1
                Dim sn As String: sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
                Dim pName As String: pName = SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value)
                Dim proc As String: proc = SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value)
                Dim inspR As String: inspR = SafeStr(wsProd.Cells(r, PROD_COL_INSP_RESULT).Value)
                Dim inspC As String: inspC = SafeStr(wsProd.Cells(r, PROD_COL_INSP_COUNT).Value)
                
                ' ¸®½ºÆ® ÇÑ ÁÙ
                memoText = memoText & ChrW(&H2022) & " "  ' bullet
                memoText = memoText & sn & "  " & pName & "  "
                memoText = memoText & proc & "  "
                If Len(inspR) > 0 Then memoText = memoText & "[" & inspR & "] "
                If Len(inspC) > 0 Then memoText = memoText & "(" & inspC & "È¸) "
                memoText = memoText & memo
                memoText = memoText & vbLf
                
                If cnt >= 8 Then
                    memoText = memoText & "  ... ¿Ü " & _
                               (GetMemoCount(wsProd, lastR) - 8) & "°Ç"
                    Exit For
                End If
            End If
        Next r
    End If
    
    If cnt = 0 Then Exit Sub  ' ¸Þ¸ð ¾øÀ¸¸é µµÇü ¾È ¸¸µê
    
    ' ¦¡¦¡ µµÇü »ý¼º ¦¡¦¡
    Dim shpLeft As Single
    Dim shpTop As Single
    Dim shpW As Single
    Dim shpH As Single
    
    shpLeft = ws.Cells(CAL_ROW_MEMO, CAL_COL_START).Left
    shpTop = ws.Cells(CAL_ROW_MEMO, CAL_COL_START).Top + 2
    shpW = ws.Cells(CAL_ROW_MEMO, CAL_COL_END).Left + _
           ws.Columns(CAL_COL_END).Width - shpLeft
    shpH = ws.rows(CAL_ROW_MEMO).Height - 4
    
    ' ¸Þ¸ð°¡ ¸¹À¸¸é ³ôÀÌ È®Àå
    If cnt > 3 Then
        shpH = shpH + (cnt - 3) * 12
        ' 5Çà(°£°ÝÇà) ³ôÀÌµµ ´Ã·Á¼­ °ø°£ È®º¸
        ws.rows(5).rowHeight = 6 + (cnt - 3) * 12
    End If
    
    Set shp = ws.Shapes.AddShape(msoShapeRoundedRectangle, _
                  shpLeft, shpTop, shpW, shpH)
    With shp
        .Name = "SHP_MEMO_MAIN"
        .Placement = xlFreeFloating
        
        ' ¹è°æ: ¹ÝÅõ¸í ´ÙÅ©
        .Fill.ForeColor.RGB = RGB(30, 34, 42)
        .Fill.Transparency = 0.15
        
        ' Å×µÎ¸®: ½Ã¾È ÁÂÃø ¶óÀÎ ´À³¦
        .line.ForeColor.RGB = CLR_CYAN
        .line.Weight = 1.5
        .line.Visible = msoTrue
        
        With .TextFrame2
            .VerticalAnchor = msoAnchorTop
            .MarginLeft = 10
            .MarginRight = 6
            .MarginTop = 4
            .MarginBottom = 4
            .WordWrap = msoTrue
            
            With .TextRange
                ' Á¦¸ñ
                .text = ChrW(&H26A0) & " °Ë»ç ÀÌ½´ (" & cnt & "°Ç)" & vbLf & memoText
                
                ' Á¦¸ñ ½ºÅ¸ÀÏ
                .Characters(1, InStr(.text, vbLf)).Font.Size = 8
                .Characters(1, InStr(.text, vbLf)).Font.Bold = msoTrue
                .Characters(1, InStr(.text, vbLf)).Font.Fill.ForeColor.RGB = CLR_ORANGE
                
                ' º»¹® ½ºÅ¸ÀÏ
                If Len(.text) > InStr(.text, vbLf) Then
                    Dim bodyStart As Long: bodyStart = InStr(.text, vbLf) + 1
                    .Characters(bodyStart, Len(.text) - bodyStart + 1).Font.Size = 7
                    .Characters(bodyStart, Len(.text) - bodyStart + 1).Font.Fill.ForeColor.RGB = CLR_TEXT_LIGHT
                End If
                
                .Font.Name = TITLE_FONT_NAME
                .ParagraphFormat.Alignment = msoAlignLeft
                .ParagraphFormat.SpaceAfter = 2
            End With
        End With
        
        .Shadow.Visible = msoFalse
        .Locked = True
    End With
    
    Exit Sub
ErrH:
    Debug.Print "BuildMemoShape ¿À·ù: " & Err.Description
End Sub

'================================================================
' GetMemoCount: ¸Þ¸ð°¡ ÀÖ´Â Çà ¼ö Ä«¿îÆ®
'================================================================
Private Function GetMemoCount(wsProd As Worksheet, lastR As Long) As Long
    Dim r As Long, cnt As Long
    For r = PROD_DATA_START To lastR
        If Len(SafeStr(wsProd.Cells(r, PROD_COL_INSP_MEMO).Value)) > 0 Then
            cnt = cnt + 1
        End If
    Next r
    GetMemoCount = cnt
End Function

'================================================================
' ClearMemoByRow: Æ¯Á¤ ÇàÀÇ °Ë»ç ¸Þ¸ð »èÁ¦
'================================================================
Public Sub ClearInspMemo(sn As String)
    Dim wsProd As Worksheet
    Dim lastR As Long
    Dim r As Long
    On Error GoTo ErrH
    
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    lastR = GetLastRow(wsProd, PROD_COL_SN)
    
    For r = PROD_DATA_START To lastR
        If SafeStr(wsProd.Cells(r, PROD_COL_SN).Value) = sn Then
            wsProd.Cells(r, PROD_COL_INSP_MEMO).Value = ""
            Exit For
        End If
    Next r
    
    ' µµÇü °»½Å
    BuildMemoShape ThisWorkbook.sheets(SHT_CALENDAR)
    Exit Sub
ErrH:
    MsgBox "ClearInspMemo ¿À·ù: " & Err.Description, vbExclamation
End Sub

Public Sub RefreshCurrentSheet()
    Select Case ActiveSheet.Name
        Case SHT_WORKSPACE: RefreshWorkSpace
        Case SHT_CALENDAR:  RefreshCalendar
        Case SHT_REPORT:    GenerateDailyReport
        Case Else
            MsgBox "ÀÌ ½ÃÆ®´Â »õ·Î°íÄ§ ´ë»óÀÌ ¾Æ´Õ´Ï´Ù.", vbInformation
    End Select
End Sub
Public Function GetRawMaxSeq(ByVal prodType As String, _
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

    GetRawMaxSeq = maxSeq
End Function

