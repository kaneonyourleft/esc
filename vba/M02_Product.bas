Attribute VB_Name = "M02_Product"
Option Explicit

' ============================================================
'  M02_Product ? 제품 마스터 등록, 서식, 갱신
' ============================================================

Public Sub ShowProductForm()
    On Error GoTo ErrH
    Load frmProductReg
    frmProductReg.Show
    Exit Sub
ErrH:
    MsgBox "ShowProductForm 오류: " & Err.Description, vbExclamation
End Sub

Public Sub RegisterProduct(prodType As String, prodName As String, _
                            drawing As String, shrink As String, _
                            stackQty As Long, dcJoint As String, _
                            heat As String)
    Dim wsPrd  As Worksheet
    Dim lastR  As Long
    Dim newR   As Long
    Dim r      As Long
    On Error GoTo ErrH

    If Trim(prodName) = "" Then
        MsgBox "제품명을 입력하세요.", vbExclamation: Exit Sub
    End If
    If stackQty < 1 Then
        MsgBox "적층수량은 1 이상이어야 합니다.", vbExclamation: Exit Sub
    End If
    If UCase(Trim(heat)) <> "Y" And UCase(Trim(heat)) <> "N" Then
        MsgBox "열처리는 Y 또는 N 이어야 합니다.", vbExclamation: Exit Sub
    End If

    Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    lastR = GetLastRow(wsPrd, PRD_COL_NAME)
    If lastR >= PRD_DATA_START Then
        For r = PRD_DATA_START To lastR
            If SafeStr(wsPrd.Cells(r, PRD_COL_NAME).Value) = Trim(prodName) Then
                If MsgBox("'" & prodName & "' 제품이 이미 존재합니다. 계속하시겠습니까?", _
                          vbYesNo) = vbNo Then Exit Sub
                Exit For
            End If
        Next r
    End If

    newR = lastR + 1
    If newR < PRD_DATA_START Then newR = PRD_DATA_START

    wsPrd.Cells(newR, PRD_COL_TYPE).Value = UCase(Trim(prodType))
    wsPrd.Cells(newR, PRD_COL_NAME).Value = Trim(prodName)
    wsPrd.Cells(newR, PRD_COL_DRAWING).Value = Trim(drawing)
    wsPrd.Cells(newR, PRD_COL_SHRINK).Value = Trim(shrink)
    wsPrd.Cells(newR, PRD_COL_STACK).Value = stackQty
    wsPrd.Cells(newR, PRD_COL_DC).Value = UCase(Trim(dcJoint))
    wsPrd.Cells(newR, PRD_COL_HEAT).Value = UCase(Trim(heat))
    wsPrd.Cells(newR, PRD_COL_REGDATE).Value = TodayStr()

    CalcAndWriteDays wsPrd, newR
    FormatProductRow wsPrd, newR

    MsgBox "제품 '" & prodName & "' 등록 완료.", vbInformation
    Exit Sub
ErrH:
    MsgBox "RegisterProduct 오류: " & Err.Description, vbCritical
End Sub

Public Sub FormatProductRow(wsPrd As Worksheet, r As Long)
    Dim c      As Long
    Dim pType  As String
    Dim i      As Long
    Dim dimCols As Variant
    On Error GoTo ErrH

    For c = PRD_COL_TYPE To PRD_COL_REGDATE
        With wsPrd.Cells(r, c)
            .Font.Name = "맑은 고딕"
            .Font.Size = 9
            .Font.Color = CLR_TEXT_LIGHT
            .Interior.Color = CLR_BG_MID
        End With
        ApplyCellBorder wsPrd.Cells(r, c), CLR_BG_LIGHT, xlHairline
    Next c

    pType = SafeStr(wsPrd.Cells(r, PRD_COL_TYPE).Value)
    wsPrd.Cells(r, PRD_COL_TYPE).Font.Color = GetTypeColor(pType)
    wsPrd.Cells(r, PRD_COL_TYPE).Font.Bold = True

    dimCols = Array(PRD_COL_D1, PRD_COL_D2, PRD_COL_D3, PRD_COL_D4, _
                    PRD_COL_D5, PRD_COL_D6, PRD_COL_LT, PRD_COL_ROUTE)
    For i = 0 To UBound(dimCols)
        wsPrd.Cells(r, dimCols(i)).Font.Color = CLR_TEXT_DIM
        wsPrd.Cells(r, dimCols(i)).Font.Size = 8
    Next i

    wsPrd.rows(r).rowHeight = 18
    Exit Sub
ErrH:
    MsgBox "FormatProductRow 오류: " & Err.Description, vbExclamation
End Sub

Public Sub RefreshProductSheet()
    Dim wsPrd  As Worksheet
    Dim lastR  As Long
    Dim r      As Long
    On Error GoTo ErrH

    Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    lastR = GetLastRow(wsPrd, PRD_COL_NAME)
    If lastR < PRD_DATA_START Then Exit Sub

    For r = PRD_DATA_START To lastR
        If SafeStr(wsPrd.Cells(r, PRD_COL_NAME).Value) <> "" Then
            CalcAndWriteDays wsPrd, r
            FormatProductRow wsPrd, r
        End If
    Next r
    Exit Sub
ErrH:
    MsgBox "RefreshProductSheet 오류: " & Err.Description, vbExclamation
End Sub


