VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmIssueBoard 
   Caption         =   "UserForm1"
   ClientHeight    =   3036
   ClientLeft      =   108
   ClientTop       =   456
   ClientWidth     =   4584
   OleObjectBlob   =   "frmIssueBoard.frx":0000
   StartUpPosition =   1  '소유자 가운데
End
Attribute VB_Name = "frmIssueBoard"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Private WithEvents mBtnAdd   As MSForms.CommandButton
Attribute mBtnAdd.VB_VarHelpID = -1
Private WithEvents mBtnDel   As MSForms.CommandButton
Attribute mBtnDel.VB_VarHelpID = -1
Private WithEvents mBtnClose As MSForms.CommandButton
Attribute mBtnClose.VB_VarHelpID = -1
Private mList As MSForms.ListBox

Private Sub UserForm_Initialize()
    Me.Caption = "ISSUE BOARD"
    Me.Width = 560
    Me.Height = 480
    Me.BackColor = RGB(30, 30, 30)
    Me.StartUpPosition = 0
    Me.Left = Application.Left + (Application.Width - Me.Width) / 2
    Me.Top = Application.Top + 60
    
    ' ── 타이틀 ──
    Dim lbl As MSForms.Label
    Set lbl = Me.Controls.Add("Forms.Label.1", "lblTitle")
    With lbl
        .Caption = ChrW(&H26A0) & " ISSUE BOARD"
        .Left = 14: .Top = 8: .Width = 300: .Height = 24
        .Font.Size = 14: .Font.Bold = True
        .ForeColor = RGB(255, 200, 80)
        .BackColor = Me.BackColor
    End With
    
    ' ── 컬럼 헤더 ──
    Dim headers As Variant
    headers = Array("제품", "S/N", "이슈 내용", "유형", "날짜")
    Dim hLeft As Variant
    hLeft = Array(14, 100, 210, 390, 470)
    Dim hWidth As Variant
    hWidth = Array(82, 106, 176, 76, 60)
    
    Dim hi As Long
    For hi = 0 To 4
        Dim hLbl As MSForms.Label
        Set hLbl = Me.Controls.Add("Forms.Label.1", "hdr" & hi)
        With hLbl
            .Caption = headers(hi)
            .Left = hLeft(hi): .Top = 38: .Width = hWidth(hi): .Height = 14
            .Font.Size = 8: .Font.Bold = True
            .ForeColor = RGB(140, 145, 155)
            .BackColor = RGB(32, 36, 44)
        End With
    Next hi
    
    ' ── 리스트박스 (스크롤 가능) ──
    Set mList = Me.Controls.Add("Forms.ListBox.1", "lstIssues")
    With mList
        .Left = 14: .Top = 56: .Width = 520: .Height = 330
        .Font.Name = TITLE_FONT_NAME
        .Font.Size = 9
        .BackColor = RGB(24, 28, 36)
        .ForeColor = RGB(210, 215, 225)
        .BorderStyle = fmBorderStyleSingle
        .borderColor = RGB(55, 60, 70)
        .ColumnCount = 5
        .ColumnWidths = "82;106;176;76;60"
        .ListStyle = fmListStylePlain
    End With
    
    ' ── 버튼들 ──
    Set mBtnAdd = Me.Controls.Add("Forms.CommandButton.1", "btnAdd")
    With mBtnAdd
        .Caption = "+ 메모 추가"
        .Left = 14: .Top = 396: .Width = 100: .Height = 30
        .Font.Size = 10: .Font.Bold = True
        .BackColor = RGB(50, 50, 50): .ForeColor = RGB(255, 200, 80)
    End With
    
    Set mBtnDel = Me.Controls.Add("Forms.CommandButton.1", "btnDel")
    With mBtnDel
        .Caption = "선택 삭제"
        .Left = 122: .Top = 396: .Width = 90: .Height = 30
        .Font.Size = 10
        .BackColor = RGB(50, 50, 50): .ForeColor = RGB(255, 80, 80)
    End With
    
    Set mBtnClose = Me.Controls.Add("Forms.CommandButton.1", "btnClose")
    With mBtnClose
        .Caption = "닫기"
        .Left = 444: .Top = 396: .Width = 90: .Height = 30
        .Font.Size = 10
        .BackColor = RGB(50, 50, 50): .ForeColor = CLR_TEXT_LIGHT
    End With
    
    ' ── 데이터 로드 ──
    LoadIssues
End Sub

' ============================================================
'  이슈 데이터 로드
' ============================================================
Private Sub LoadIssues()
    mList.Clear
    
    Dim wsProd As Worksheet
    Set wsProd = ThisWorkbook.sheets(SHT_PRODUCTION)
    Dim lastR As Long: lastR = GetLastRow(wsProd, PROD_COL_SN)
    
    ' ── 1) 자동 수집 ──
    If lastR >= PROD_DATA_START Then
        Dim r As Long
        For r = PROD_DATA_START To lastR
            Dim st As String: st = SafeStr(wsProd.Cells(r, PROD_COL_STATUS).Value)
            Dim sn As String: sn = SafeStr(wsProd.Cells(r, PROD_COL_SN).Value)
            Dim pName As String: pName = SafeStr(wsProd.Cells(r, PROD_COL_PRODUCT).Value)
            Dim proc As String: proc = SafeStr(wsProd.Cells(r, PROD_COL_PROCESS).Value)
            Dim memo As String: memo = SafeStr(wsProd.Cells(r, PROD_COL_INSP_MEMO).Value)
            
            If Len(pName) = 0 Or Len(sn) = 0 Then GoTo nxtAuto
            
            Dim issueText As String: issueText = ""
            Dim issueType As String: issueType = ""
            
            Dim shortSN As String
            If Len(sn) > 12 Then shortSN = ".." & Right(sn, 10) Else shortSN = sn
            
            If st = ST_SCRAP Then
                issueText = "폐기 처리됨"
                issueType = "폐기"
            ElseIf st = ST_DELAY Then
                issueText = "지연 - " & proc
                issueType = "지연"
            ElseIf proc = NG_SUB Then
                issueText = "선가공 전환"
                issueType = "선가공"
            ElseIf proc = PROC_FLATTENING And _
                   SafeLng(wsProd.Cells(r, PROD_COL_INSP_COUNT).Value) > 0 Then
                Dim cnt As Long: cnt = SafeLng(wsProd.Cells(r, PROD_COL_INSP_COUNT).Value)
                issueText = "재평탄화 #" & cnt
                issueType = "평탄도NG"
            ElseIf Len(memo) > 0 Then
                If Len(memo) > 24 Then
                    issueText = Left(memo, 22) & ".."
                Else
                    issueText = memo
                End If
                issueType = "메모"
            End If
            
            If Len(issueText) > 0 Then
                mList.AddItem pName
                mList.List(mList.ListCount - 1, 1) = shortSN
                mList.List(mList.ListCount - 1, 2) = issueText
                mList.List(mList.ListCount - 1, 3) = issueType
                mList.List(mList.ListCount - 1, 4) = "자동"
            End If
nxtAuto:
        Next r
    End If
    
    ' ── 2) 수동 메모 ──
    Dim wsCal As Worksheet
    Set wsCal = ThisWorkbook.sheets(SHT_CALENDAR)
    Dim mLastR As Long
    mLastR = GetLastRow(wsCal, CAL_MEMO_STORE_COL)
    
    If mLastR >= CAL_MEMO_STORE_START Then
        Dim mr As Long
        For mr = CAL_MEMO_STORE_START To mLastR
            Dim mProd As String: mProd = SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL).Value)
            Dim mSN As String: mSN = SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL2).Value)
            Dim mText As String: mText = SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL3).Value)
            Dim mDate As String: mDate = SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL4).Value)
            
            If Len(mProd) > 0 And Len(mText) > 0 Then
                mList.AddItem mProd
                mList.List(mList.ListCount - 1, 1) = mSN
                mList.List(mList.ListCount - 1, 2) = mText
                mList.List(mList.ListCount - 1, 3) = "수동"
                mList.List(mList.ListCount - 1, 4) = mDate
            End If
        Next mr
    End If
End Sub

' ============================================================
'  메모 추가
' ============================================================
Private Sub mBtnAdd_Click()
    Dim prodName As String
    prodName = InputBox("제품명:", "이슈 메모 추가")
    If Len(prodName) = 0 Then Exit Sub
    
    Dim snVal As String
    snVal = InputBox("S/N (없으면 빈칸):" & vbCrLf & _
                     "제품: " & prodName, "S/N 입력")
    
    Dim memoText As String
    memoText = InputBox("이슈 내용:" & vbCrLf & _
                        "제품: " & prodName & vbCrLf & _
                        "S/N: " & snVal, "메모 입력")
    If Len(memoText) = 0 Then Exit Sub
    
    ' 저장
    Dim wsCal As Worksheet
    Set wsCal = ThisWorkbook.sheets(SHT_CALENDAR)
    Dim storeR As Long
    storeR = GetLastRow(wsCal, CAL_MEMO_STORE_COL) + 1
    If storeR < CAL_MEMO_STORE_START Then storeR = CAL_MEMO_STORE_START
    
    wsCal.Cells(storeR, CAL_MEMO_STORE_COL).Value = prodName
    wsCal.Cells(storeR, CAL_MEMO_STORE_COL2).Value = snVal
    wsCal.Cells(storeR, CAL_MEMO_STORE_COL3).Value = memoText
    wsCal.Cells(storeR, CAL_MEMO_STORE_COL4).Value = Format(Now, "MM/DD")
    
    ' 리스트 갱신
    LoadIssues
End Sub

' ============================================================
'  수동 메모 삭제
' ============================================================
Private Sub mBtnDel_Click()
    If mList.ListIndex < 0 Then
        MsgBox "삭제할 항목을 선택하세요.", vbInformation
        Exit Sub
    End If
    
    Dim selIdx As Long: selIdx = mList.ListIndex
    Dim selType As String: selType = mList.List(selIdx, 3)
    
    If selType <> "수동" Then
        MsgBox "자동 수집된 이슈는 삭제할 수 없습니다." & vbCrLf & _
               "Production 시트에서 상태를 변경하세요.", vbInformation
        Exit Sub
    End If
    
    ' 수동 메모에서 매칭 찾기
    Dim selProd As String: selProd = mList.List(selIdx, 0)
    Dim selSN As String: selSN = mList.List(selIdx, 1)
    Dim selText As String: selText = mList.List(selIdx, 2)
    
    If MsgBox("삭제하시겠습니까?" & vbCrLf & _
              selProd & " | " & selSN & " | " & selText, _
              vbYesNo + vbQuestion) = vbNo Then Exit Sub
    
    Dim wsCal As Worksheet
    Set wsCal = ThisWorkbook.sheets(SHT_CALENDAR)
    Dim mLastR As Long
    mLastR = GetLastRow(wsCal, CAL_MEMO_STORE_COL)
    
    Dim mr As Long
    For mr = CAL_MEMO_STORE_START To mLastR
        If SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL).Value) = selProd And _
           SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL2).Value) = selSN And _
           SafeStr(wsCal.Cells(mr, CAL_MEMO_STORE_COL3).Value) = selText Then
            wsCal.rows(mr).Delete
            Exit For
        End If
    Next mr
    
    LoadIssues
End Sub

' ============================================================
'  닫기
' ============================================================
Private Sub mBtnClose_Click()
    Unload Me
End Sub

