VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmSerialGen 
   Caption         =   "S/N 생성"
   ClientHeight    =   5232
   ClientLeft      =   108
   ClientTop       =   456
   ClientWidth     =   6984
   OleObjectBlob   =   "frmSerialGen.frx":0000
   StartUpPosition =   1  '소유자 가운데
End
Attribute VB_Name = "frmSerialGen"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================
'  frmSerialGen - S/N 일괄 생성 UserForm
'  ESC Production Management System v12.2
'
'  배치코드: 기존 목록 선택 또는 직접 입력 (비우면 자동)
'  시퀀스: 제품 기준 (시트번호 무관 이어감)
'  시작번호: 기존 SN 있으면 maxSeq+1, 없으면 1 (사용자 수정 가능)
' ============================================================

Private m_CtrlIdx     As Long
Private m_Initialized As Boolean

Private WithEvents btnGenerate As MSForms.CommandButton
Attribute btnGenerate.VB_VarHelpID = -1
Private WithEvents btnCancel   As MSForms.CommandButton
Attribute btnCancel.VB_VarHelpID = -1
Private WithEvents cboProduct  As MSForms.ComboBox
Attribute cboProduct.VB_VarHelpID = -1
Private WithEvents cboBatch    As MSForms.ComboBox
Attribute cboBatch.VB_VarHelpID = -1
Private WithEvents txtQty      As MSForms.TextBox
Attribute txtQty.VB_VarHelpID = -1
Private WithEvents txtSheetNo  As MSForms.TextBox
Attribute txtSheetNo.VB_VarHelpID = -1
Private WithEvents txtStartSeq As MSForms.TextBox
Attribute txtStartSeq.VB_VarHelpID = -1

Private lblPreview  As MSForms.Label
Private lblSeqInfo  As MSForms.Label

' ============================================================
'  UserForm_Initialize
' ============================================================
Private Sub UserForm_Initialize()
    Dim lbl        As MSForms.Label
    Dim lblHint    As MSForms.Label
    Dim topPos     As Single
    Dim labelWidth As Single
    Dim inputWidth As Single
    Dim leftLabel  As Single
    Dim leftInput  As Single
    Dim rowHeight  As Single
    Dim rowGap     As Single
    Dim prodList   As String
    Dim products() As String
    Dim batchList  As String
    Dim batches()  As String
    Dim i          As Long

    m_Initialized = False
    m_CtrlIdx = 0

    Me.Caption = "S/N 생성"
    Me.Width = 420
    Me.Height = 470
    Me.BackColor = CLR_BG_DARK

    labelWidth = 80
    inputWidth = 220
    leftLabel = 16
    leftInput = 104
    rowHeight = 22
    rowGap = 32
    topPos = 16

    ' -- 타이틀 --
    Set lbl = CreateLabel(Me, "lblTitle", "S/N 일괄 생성", leftLabel, topPos, 280)
    lbl.Font.Size = 12
    lbl.Font.Bold = True
    lbl.ForeColor = CLR_CYAN
    topPos = topPos + 36

    ' -- 배치코드 (콤보: 기존 목록 + 직접입력) --
    Set lbl = CreateLabel(Me, "lblBatch", "배치코드", leftLabel, topPos, labelWidth)
    Set cboBatch = Me.Controls.Add("Forms.ComboBox.1", "cboBatch")
    FormatComboEditable cboBatch, leftInput, topPos, inputWidth, rowHeight

    batchList = GetBatchCodeList()
    If Trim(batchList) <> "" Then
        batches = Split(batchList, ",")
        For i = 0 To UBound(batches)
            If Trim(batches(i)) <> "" Then cboBatch.AddItem Trim(batches(i))
        Next i
    End If

    Set lblHint = Me.Controls.Add("Forms.Label.1", "lblHintBatch")
    With lblHint
        .Caption = "선택/입력 (비우면 자동)"
        .Left = leftInput + inputWidth + 6
        .Top = topPos + 3
        .Width = 100
        .Height = 16
        .Font.Size = 7
        .ForeColor = CLR_TEXT_DIM
        .BackStyle = fmBackStyleTransparent
    End With
    topPos = topPos + rowGap

    ' -- 시트No (필수, 6자리) --
    Set lbl = CreateLabel(Me, "lblSheet", "시트No *", leftLabel, topPos, labelWidth)
    Set txtSheetNo = Me.Controls.Add("Forms.TextBox.1", "txtSheetNo")
    FormatTextBox txtSheetNo, leftInput, topPos, inputWidth, rowHeight
    txtSheetNo.MaxLength = 6
    topPos = topPos + rowGap

    ' -- 제품 선택 (필수) --
    Set lbl = CreateLabel(Me, "lblProduct", "제품 *", leftLabel, topPos, labelWidth)
    Set cboProduct = Me.Controls.Add("Forms.ComboBox.1", "cboProduct")
    FormatCombo cboProduct, leftInput, topPos, inputWidth, rowHeight

    prodList = GetProductNameList()
    If Trim(prodList) <> "" Then
        products = Split(prodList, ",")
        For i = 0 To UBound(products)
            If Trim(products(i)) <> "" Then cboProduct.AddItem Trim(products(i))
        Next i
    End If
    topPos = topPos + rowGap

    ' -- 수량 (필수) --
    Set lbl = CreateLabel(Me, "lblQty", "수량 *", leftLabel, topPos, labelWidth)
    Set txtQty = Me.Controls.Add("Forms.TextBox.1", "txtQty")
    FormatTextBox txtQty, leftInput, topPos, inputWidth, rowHeight
    topPos = topPos + rowGap

    ' -- 시작번호 (자동계산 + 사용자 수정 가능) --
    Set lbl = CreateLabel(Me, "lblStartSeq", "시작번호 *", leftLabel, topPos, labelWidth)
    Set txtStartSeq = Me.Controls.Add("Forms.TextBox.1", "txtStartSeq")
    FormatTextBox txtStartSeq, leftInput, topPos, 80, rowHeight
    txtStartSeq.text = "1"
    txtStartSeq.MaxLength = 6

    Set lblSeqInfo = Me.Controls.Add("Forms.Label.1", "lblSeqInfo")
    With lblSeqInfo
        .Caption = "제품 선택 시 자동 계산"
        .Left = leftInput + 86
        .Top = topPos + 3
        .Width = 180
        .Height = 16
        .Font.Size = 7
        .ForeColor = CLR_TEXT_DIM
        .BackStyle = fmBackStyleTransparent
    End With
    topPos = topPos + rowGap + 8

    ' -- 미리보기 --
    Set lbl = CreateLabel(Me, "lblPrevTitle", "미리보기", leftLabel, topPos, labelWidth)
    lbl.Font.Bold = True
    lbl.ForeColor = CLR_CYAN
    topPos = topPos + 20

    Set lblPreview = Me.Controls.Add("Forms.Label.1", "lblPreview")
    With lblPreview
        .Caption = "제품과 시트No를 입력하면 미리보기가 표시됩니다."
        .Left = leftLabel
        .Top = topPos
        .Width = 370
        .Height = 60
        .Font.Size = 8
        .Font.Name = "Consolas"
        .ForeColor = CLR_TEXT_DIM
        .BackColor = CLR_BG_DARK
        .BackStyle = fmBackStyleOpaque
        .BorderStyle = fmBorderStyleSingle
        .borderColor = CLR_BG_LIGHT
        .WordWrap = True
    End With
    topPos = topPos + 68

    ' -- 생성 버튼 --
    Set btnGenerate = Me.Controls.Add("Forms.CommandButton.1", "btnGenerate")
    With btnGenerate
        .Caption = "생성"
        .Left = leftInput
        .Top = topPos
        .Width = 80
        .Height = 28
        .BackColor = CLR_CYAN
        .ForeColor = CLR_BG_DARK
        .Font.Bold = True
        .Font.Size = 10
    End With

    ' -- 취소 버튼 --
    Set btnCancel = Me.Controls.Add("Forms.CommandButton.1", "btnCancel")
    With btnCancel
        .Caption = "취소"
        .Left = leftInput + 90
        .Top = topPos
        .Width = 80
        .Height = 28
        .BackColor = CLR_BG_LIGHT
        .ForeColor = CLR_TEXT_LIGHT
        .Font.Size = 10
    End With

    m_Initialized = True
End Sub

' ============================================================
'  실시간 미리보기 이벤트
' ============================================================
Private Sub cboProduct_Change()
    If Not m_Initialized Then Exit Sub
    AutoCalcStartSeq
    UpdatePreview
End Sub

Private Sub txtQty_Change()
    If Not m_Initialized Then Exit Sub
    UpdatePreview
End Sub

Private Sub txtSheetNo_Change()
    If Not m_Initialized Then Exit Sub
    UpdatePreview
End Sub

Private Sub cboBatch_Change()
    If Not m_Initialized Then Exit Sub
    UpdatePreview
End Sub

Private Sub txtStartSeq_Change()
    If Not m_Initialized Then Exit Sub
    UpdatePreview
End Sub

' ============================================================
'  시작번호 자동 계산 (제품 변경 시)
' ============================================================
Private Sub AutoCalcStartSeq()
    Dim prodName As String
    Dim pInfo    As Variant
    Dim pType    As String
    Dim maxSeq   As Long
    On Error GoTo ErrH

    prodName = SafeStr(cboProduct.Value)
    If Trim(prodName) = "" Then
        txtStartSeq.text = "1"
        If Not lblSeqInfo Is Nothing Then
            lblSeqInfo.Caption = "제품 선택 시 자동 계산"
            lblSeqInfo.ForeColor = CLR_TEXT_DIM
        End If
        Exit Sub
    End If

    pInfo = GetProductInfo(prodName)
    If IsEmpty(pInfo) Then
        txtStartSeq.text = "1"
        If Not lblSeqInfo Is Nothing Then
            lblSeqInfo.Caption = "등록되지 않은 제품"
            lblSeqInfo.ForeColor = RGB(255, 100, 100)
        End If
        Exit Sub
    End If

    pType = CStr(pInfo(0))
    maxSeq = GetMaxSeqForProduct(pType, prodName)

    If maxSeq >= 999 Then
        ' ★ L999 도달 → L001부터 재시작 (시트번호가 다르니 중복 없음)
        txtStartSeq.text = "1"
        If Not lblSeqInfo Is Nothing Then
            lblSeqInfo.Caption = "L999 도달 → 새 시트번호로 L001부터"
            lblSeqInfo.ForeColor = RGB(255, 180, 0)
        End If
    ElseIf maxSeq > 0 Then
        txtStartSeq.text = CStr(maxSeq + 1)
        If Not lblSeqInfo Is Nothing Then
            lblSeqInfo.Caption = "기존 L" & Format(maxSeq, "000") & " → L" & Format(maxSeq + 1, "000") & "부터"
            lblSeqInfo.ForeColor = CLR_CYAN
        End If
    Else
        txtStartSeq.text = "1"
        If Not lblSeqInfo Is Nothing Then
            lblSeqInfo.Caption = "신규 제품 (첫 생성)"
            lblSeqInfo.ForeColor = CLR_TEXT_LIGHT
        End If
    End If
    Exit Sub
ErrH:
    txtStartSeq.text = "1"
    If Not lblSeqInfo Is Nothing Then
        lblSeqInfo.Caption = "계산 오류"
        lblSeqInfo.ForeColor = RGB(255, 100, 100)
    End If
End Sub

' ============================================================
'  UpdatePreview
' ============================================================
Private Sub UpdatePreview()
    Dim prodName   As String
    Dim sheetNo    As String
    Dim qty        As Long
    Dim pInfo      As Variant
    Dim pType      As String
    Dim snPrefix   As String
    Dim startSeq   As Long
    Dim batchDisp  As String
    Dim previewTxt As String
    Dim showCnt    As Long
    Dim i          As Long
    Dim snEx       As String
    On Error GoTo ErrH

    ' 초기화 완료 전이면 무시
    If lblPreview Is Nothing Then Exit Sub

    prodName = SafeStr(cboProduct.Value)
    sheetNo = SafeStr(txtSheetNo.Value)

    If Trim(prodName) = "" Or Trim(sheetNo) = "" Then
        lblPreview.Caption = "제품과 시트No를 입력하면 미리보기가 표시됩니다."
        lblPreview.ForeColor = CLR_TEXT_DIM
        Exit Sub
    End If
    If Len(sheetNo) <> 6 Then
        lblPreview.Caption = "시트No: 6자리 필요 (현재 " & Len(sheetNo) & "자리)"
        lblPreview.ForeColor = CLR_TEXT_DIM
        Exit Sub
    End If

    ' 수량
    If Trim(SafeStr(txtQty.Value)) = "" Or Not IsNumeric(txtQty.Value) Then
        qty = 1
    Else
        qty = CLng(txtQty.Value)
        If qty < 1 Then qty = 1
    End If

    ' 시작번호 (사용자 입력값 우선)
    If Trim(SafeStr(txtStartSeq.Value)) = "" Or Not IsNumeric(txtStartSeq.Value) Then
        startSeq = 1
    Else
        startSeq = CLng(txtStartSeq.Value)
        If startSeq < 1 Then startSeq = 1
    End If

    pInfo = GetProductInfo(prodName)
    If IsEmpty(pInfo) Then
        lblPreview.Caption = "등록되지 않은 제품입니다."
        lblPreview.ForeColor = RGB(255, 100, 100)
        Exit Sub
    End If

    pType = CStr(pInfo(0))
    snPrefix = BuildSNPrefix(pType, prodName, sheetNo)

    ' 배치코드 표시
    batchDisp = Trim(SafeStr(cboBatch.Value))
    If Len(batchDisp) = 0 Then batchDisp = "(자동생성)"

    showCnt = WorksheetFunction.Min(qty, 3)
    previewTxt = ""
    For i = 1 To showCnt
        snEx = snPrefix & Format(startSeq + i - 1, "000")
        previewTxt = previewTxt & snEx
        If i < showCnt Then previewTxt = previewTxt & vbCrLf
    Next i

    If qty > 3 Then
        previewTxt = previewTxt & vbCrLf & "  ... 외 " & (qty - 3) & "건"
    End If

    previewTxt = previewTxt & vbCrLf & _
                 "L" & Format(startSeq, "000") & _
                 " ~ L" & Format(startSeq + qty - 1, "000") & _
                 "  (" & qty & "건)"

    previewTxt = previewTxt & vbCrLf & "배치: " & batchDisp

    lblPreview.Caption = previewTxt
    lblPreview.ForeColor = CLR_TEXT_LIGHT
    Exit Sub
ErrH:
    If Not lblPreview Is Nothing Then
        lblPreview.Caption = "미리보기 오류: " & Err.Description
        lblPreview.ForeColor = RGB(255, 100, 100)
    End If
End Sub

' ============================================================
'  생성 버튼
' ============================================================
Private Sub btnGenerate_Click()
    Dim prodName  As String
    Dim sheetNo   As String
    Dim batch     As String
    Dim qty       As Long
    Dim startSeq  As Long
    Dim snPrefix  As String
    Dim pInfo     As Variant
    Dim pType     As String
    On Error GoTo ErrH

    ' -- 필수값 검증 --
    sheetNo = Trim(SafeStr(txtSheetNo.Value))
    If sheetNo = "" Or Len(sheetNo) <> 6 Then
        MsgBox "시트No는 6자리로 입력해주세요.", vbExclamation
        txtSheetNo.SetFocus
        Exit Sub
    End If

    prodName = SafeStr(cboProduct.Value)
    If Trim(prodName) = "" Then
        MsgBox "제품을 선택해주세요.", vbExclamation
        cboProduct.SetFocus
        Exit Sub
    End If

    If Trim(SafeStr(txtQty.Value)) = "" Or Not IsNumeric(txtQty.Value) Then
        MsgBox "수량을 입력해주세요.", vbExclamation
        txtQty.SetFocus
        Exit Sub
    End If
    qty = CLng(txtQty.Value)
    If qty < 1 Then
        MsgBox "수량은 1 이상이어야 합니다.", vbExclamation
        txtQty.SetFocus
        Exit Sub
    End If

    ' 시작번호 검증
    If Trim(SafeStr(txtStartSeq.Value)) = "" Or Not IsNumeric(txtStartSeq.Value) Then
        MsgBox "시작번호를 입력해주세요.", vbExclamation
        txtStartSeq.SetFocus
        Exit Sub
    End If
    startSeq = CLng(txtStartSeq.Value)
    If startSeq < 1 Then
        MsgBox "시작번호는 1 이상이어야 합니다.", vbExclamation
        txtStartSeq.SetFocus
        Exit Sub
    End If

    pInfo = GetProductInfo(prodName)
    If IsEmpty(pInfo) Then
        MsgBox "제품 정보를 찾을 수 없습니다: " & prodName, vbExclamation
        cboProduct.SetFocus
        Exit Sub
    End If

    pType = CStr(pInfo(0))
    batch = Trim(SafeStr(cboBatch.Value))
    snPrefix = BuildSNPrefix(pType, prodName, sheetNo)

    ' 생성 확인
    If MsgBox(snPrefix & Format(startSeq, "000") & " ~ " & _
              snPrefix & Format(startSeq + qty - 1, "000") & vbCrLf & _
              qty & "건을 생성하시겠습니까?", _
              vbOKCancel + vbQuestion, "S/N 생성 확인") = vbCancel Then
        Exit Sub
    End If

    Unload Me

    GenerateSerialNumbers prodName, qty, batch, startSeq, sheetNo
    Exit Sub
ErrH:
    MsgBox "btnGenerate_Click 오류: " & Err.Description, vbCritical
End Sub

Private Sub btnCancel_Click()
    Unload Me
End Sub

' ============================================================
'  내부 헬퍼 - 제품명 목록 조회
' ============================================================
Private Function GetProductNameList() As String
    Dim wsPrd  As Worksheet
    Dim lastR  As Long
    Dim r      As Long
    Dim result As String
    Dim pName  As String
    On Error GoTo ErrH

    Set wsPrd = ThisWorkbook.sheets(SHT_PRODUCT)
    lastR = GetLastRow(wsPrd, PRD_COL_NAME)
    result = ""

    If lastR >= PRD_DATA_START Then
        For r = PRD_DATA_START To lastR
            pName = SafeStr(wsPrd.Cells(r, PRD_COL_NAME).Value)
            If Trim(pName) <> "" Then
                If result <> "" Then result = result & ","
                result = result & pName
            End If
        Next r
    End If

    GetProductNameList = result
    Exit Function
ErrH:
    GetProductNameList = ""
End Function

' ============================================================
'  공통 헬퍼
' ============================================================
Private Function CreateLabel(frm As Object, ctrlName As String, _
                             captionText As String, l As Single, _
                             t As Single, w As Single) As MSForms.Label
    Dim lbl As MSForms.Label
    Set lbl = frm.Controls.Add("Forms.Label.1", ctrlName)
    With lbl
        .Caption = captionText
        .Left = l
        .Top = t + 3
        .Width = w
        .Height = 18
        .Font.Size = 9
        .ForeColor = CLR_TEXT_LIGHT
        .BackStyle = fmBackStyleTransparent
    End With
    Set CreateLabel = lbl
End Function

Private Sub FormatTextBox(txt As MSForms.TextBox, l As Single, _
                          t As Single, w As Single, h As Single)
    With txt
        .Left = l
        .Top = t
        .Width = w
        .Height = h
        .BackColor = CLR_BG_MID
        .ForeColor = CLR_TEXT_WHITE
        .BorderStyle = fmBorderStyleSingle
        .borderColor = CLR_BG_LIGHT
        .Font.Size = 9
        .Font.Name = "맑은 고딕"
    End With
End Sub

Private Sub FormatCombo(cbo As MSForms.ComboBox, l As Single, _
                        t As Single, w As Single, h As Single)
    With cbo
        .Left = l
        .Top = t
        .Width = w
        .Height = h
        .BackColor = CLR_BG_MID
        .ForeColor = CLR_TEXT_WHITE
        .borderColor = CLR_BG_LIGHT
        .Font.Size = 9
        .Font.Name = "맑은 고딕"
        .Style = fmStyleDropDownList
    End With
End Sub

Private Sub FormatComboEditable(cbo As MSForms.ComboBox, l As Single, _
                                t As Single, w As Single, h As Single)
    With cbo
        .Left = l
        .Top = t
        .Width = w
        .Height = h
        .BackColor = CLR_BG_MID
        .ForeColor = CLR_TEXT_WHITE
        .borderColor = CLR_BG_LIGHT
        .Font.Size = 9
        .Font.Name = "맑은 고딕"
        .Style = fmStyleDropDownCombo
    End With
End Sub

