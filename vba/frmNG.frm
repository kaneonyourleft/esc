VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmNG 
   Caption         =   "UserForm1"
   ClientHeight    =   3036
   ClientLeft      =   108
   ClientTop       =   456
   ClientWidth     =   4584
   OleObjectBlob   =   "frmNG.frx":0000
   StartUpPosition =   1  '소유자 가운데
End
Attribute VB_Name = "frmNG"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
'================================================================
' frmNG - NG 처리 UserForm
'================================================================
Option Explicit

Private Const ROW_H     As Long = 28
Private Const TOP_START As Long = 50

Private mRows()  As Long
Private mCount   As Long
Private mCbos()  As MSForms.ComboBox
Private mTxts()  As MSForms.TextBox

Private WithEvents mBtnExec  As MSForms.CommandButton
Attribute mBtnExec.VB_VarHelpID = -1
Private WithEvents mBtnClose As MSForms.CommandButton
Attribute mBtnClose.VB_VarHelpID = -1

'────────────────────────────────────────────────────────────────
Private Sub UserForm_Initialize()
    Me.Caption = "NG 처리"
    Me.Width = 640
    Me.BackColor = RGB(30, 30, 30)
    
    AddLabel "lblTitle", 14, 6, 200, 22, "NG 처리", 14, True, RGB(255, 80, 80)
    AddLabel "lblDesc", 14, 28, 500, 14, _
             "각 S/N별 NG분류 선택 + 메모 입력 후 [확인]", 8, False, CLR_TEXT_MID
    
    AddLabel "hd0", 14, TOP_START - 16, 110, 14, "S/N", 8, True, CLR_TEXT_LIGHT
    AddLabel "hd1", 128, TOP_START - 16, 110, 14, "제품", 8, True, CLR_TEXT_LIGHT
    AddLabel "hd2", 242, TOP_START - 16, 70, 14, "공정", 8, True, CLR_TEXT_LIGHT
    AddLabel "hd3", 316, TOP_START - 16, 100, 14, "NG 분류", 8, True, CLR_TEXT_LIGHT
    AddLabel "hd4", 440, TOP_START - 16, 100, 14, "메모", 8, True, CLR_TEXT_LIGHT
End Sub

'────────────────────────────────────────────────────────────────
Public Sub BuildUI()
    LoadFromTag
    
    Dim btnY As Long
    btnY = TOP_START + (mCount * ROW_H) + 14
    If btnY < 160 Then btnY = 160
    
    Set mBtnExec = Me.Controls.Add("Forms.CommandButton.1", "btnExecute")
    With mBtnExec
        .Caption = "확인"
        .Left = 14: .Top = btnY: .Width = 90: .Height = 30
        .Font.Size = 11: .Font.Bold = True
        .BackColor = RGB(50, 50, 50): .ForeColor = RGB(255, 80, 80)
    End With
    
    Set mBtnClose = Me.Controls.Add("Forms.CommandButton.1", "btnClose")
    With mBtnClose
        .Caption = "닫기"
        .Left = 530: .Top = btnY: .Width = 80: .Height = 30
        .Font.Size = 10
        .BackColor = RGB(50, 50, 50): .ForeColor = CLR_TEXT_LIGHT
    End With
    
    Me.Height = btnY + 72
End Sub

'────────────────────────────────────────────────────────────────
Private Sub LoadFromTag()
    Dim raw As String
    raw = Me.tag
    
    If Len(raw) = 0 Then
        mCount = 0
        AddLabel "lblNone", 14, TOP_START, 400, 20, _
                 "선택된 항목이 없습니다.", 10, False, CLR_TEXT_MID
        Exit Sub
    End If
    
    Dim parts() As String
    parts = Split(raw, "|")
    mCount = UBound(parts) + 1
    ReDim mRows(1 To mCount)
    ReDim mCbos(1 To mCount)
    ReDim mTxts(1 To mCount)
    
    Dim wsProd As Worksheet
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    
    Dim i As Long
    For i = 1 To mCount
        mRows(i) = CLng(parts(i - 1))
        Dim r As Long: r = mRows(i)
        Dim y As Long: y = TOP_START + ((i - 1) * ROW_H)
        
        AddLabel "sn" & i, 14, y, 110, 18, _
                 SafeStr(wsProd.Cells(r, PROD_COL_SN).Value), _
                 9, True, CLR_TEXT_WHITE
        
        AddLabel "pd" & i, 128, y, 110, 18, _
                 SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value), _
                 9, False, CLR_TEXT_LIGHT
        
        AddLabel "pc" & i, 242, y, 70, 18, _
                 SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value), _
                 9, False, CLR_TEXT_LIGHT
        
        Set mCbos(i) = Me.Controls.Add("Forms.ComboBox.1", "cbo" & i)
        With mCbos(i)
            .Left = 316: .Top = y: .Width = 118: .Height = 20
            .Font.Size = 9
            .BackColor = RGB(45, 45, 45): .ForeColor = CLR_TEXT_WHITE
            .Style = fmStyleDropDownList
            .AddItem NG_FLAT
            .AddItem NG_SUB
            .AddItem NG_SCRAP
        End With
        
        Set mTxts(i) = Me.Controls.Add("Forms.TextBox.1", "txt" & i)
        With mTxts(i)
            .Left = 440: .Top = y: .Width = 170: .Height = 20
            .Font.Size = 9
            .BackColor = RGB(45, 45, 45): .ForeColor = CLR_TEXT_WHITE
        End With
    Next i
End Sub

'────────────────────────────────────────────────────────────────
Private Sub mBtnExec_Click()
    Dim cnt As Long, i As Long
    cnt = 0
    For i = 1 To mCount
        If Len(mCbos(i).Value) > 0 Then cnt = cnt + 1
    Next i
    
    If cnt = 0 Then
        MsgBox "NG 분류를 선택하세요.", vbExclamation
        Exit Sub
    End If
    
    If MsgBox(cnt & "건을 처리합니다. 확인?", vbYesNo + vbQuestion) = vbNo Then
        Exit Sub
    End If
    
    Application.ScreenUpdating = False
    DisableEvents
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.sheets(SHT_PRODUCTION)
    
    Dim fCnt As Long, sCnt As Long, xCnt As Long
    fCnt = 0: sCnt = 0: xCnt = 0
    
    For i = 1 To mCount
        If Len(mCbos(i).Value) > 0 Then
            Dim memo As String
            memo = Trim(mTxts(i).text)
            
            Select Case mCbos(i).Value
                Case NG_FLAT
                    ProcessFlatNG ws, mRows(i), memo
                    fCnt = fCnt + 1
                Case NG_SUB
                    ProcessSubNG ws, mRows(i), memo
                    sCnt = sCnt + 1
                Case NG_SCRAP
                    ProcessScrapNG ws, mRows(i), memo
                    xCnt = xCnt + 1
            End Select
        End If
    Next i
    
    EnableEvents
    Application.ScreenUpdating = True
    
    Dim msg As String
    msg = "처리 완료:" & vbCrLf
    If fCnt > 0 Then msg = msg & "  평탄도NG: " & fCnt & "건" & vbCrLf
    If sCnt > 0 Then msg = msg & "  선가공: " & sCnt & "건" & vbCrLf
    If xCnt > 0 Then msg = msg & "  폐기: " & xCnt & "건" & vbCrLf
    MsgBox msg, vbInformation
    
    Unload Me
End Sub

'────────────────────────────────────────────────────────────────
Private Sub mBtnClose_Click()
    Unload Me
End Sub

'────────────────────────────────────────────────────────────────
Private Sub AddLabel(nm As String, l As Long, t As Long, w As Long, h As Long, _
                     cap As String, fs As Long, bd As Boolean, fc As Long)
    Dim lbl As MSForms.Label
    Set lbl = Me.Controls.Add("Forms.Label.1", nm)
    With lbl
        .Caption = cap
        .Left = l: .Top = t: .Width = w: .Height = h
        .Font.Size = fs: .Font.Bold = bd
        .ForeColor = fc
        .BackStyle = fmBackStyleTransparent
    End With
End Sub

