<details open>
<summary><b>🇨🇳 简体中文</b></summary>

### Coffee CLI v3.6.2 · OpenCode 灵动岛与提示音修复

- **OpenCode v2 接入灵动岛。** 标签显示运行中、等待授权或回答、空闲三种状态；支持子任务状态，断线时隐藏失效状态，无需修改 OpenCode 全局配置。
- **恢复 Windows 提示音。** 完成、等待提示和设置中的试听改用系统原生播放，保留原有音色及开关，解决 WebView2 音频渲染失败时没有声音的问题。
- **修正标签文字与工具图标。** 调整中英文标题的垂直对齐，更新 Claude Code、MiMo、Kimi Code 图标，并修正 Kiro 图标显示大小。
- **避免断线后的错误提示音。** 状态失效时取消排队中的完成音，重新连接不会把旧任务误报为刚刚完成。

</details>

<details>
<summary><b>🇬🇧 English</b></summary>

### Coffee CLI v3.6.2 · OpenCode Dynamic Island and Notification Sound Fixes

- **Dynamic Island for OpenCode v2.** Tabs show working, waiting for permission or an answer, and idle states, including subtask activity. Disconnected sessions hide stale status. No changes to OpenCode's global configuration are required.
- **Restore Windows notification sounds.** Completion, waiting, and Settings previews use native Windows playback, retaining the existing tones and switches when WebView2 audio rendering fails.
- **Align tab titles and refresh tool icons.** Improve vertical alignment for Chinese and Latin titles, update Claude Code, MiMo, and Kimi Code icons, and correct Kiro icon sizing.
- **Prevent stale completion chimes.** Losing status cancels pending completion sounds, and reconnecting does not announce an old task as newly finished.

</details>

<details>
<summary><b>🇹🇼 繁體中文</b></summary>

### Coffee CLI v3.6.2 · OpenCode 靈動島與提示音修復

- **OpenCode v2 接入靈動島。** 分頁顯示執行中、等待授權或回答、閒置三種狀態；支援子任務狀態，斷線時隱藏失效狀態，無需修改 OpenCode 全域設定。
- **恢復 Windows 提示音。** 完成、等待提示及設定中的試聽改用系統原生播放，保留原有音色與開關，解決 WebView2 音訊算繪失敗時沒有聲音的問題。
- **修正分頁文字與工具圖示。** 調整中英文標題的垂直對齊，更新 Claude Code、MiMo、Kimi Code 圖示，並修正 Kiro 圖示大小。
- **避免斷線後的錯誤提示音。** 狀態失效時取消排隊中的完成音，重新連線不會將舊任務誤報為剛剛完成。

</details>

<details>
<summary><b>🇯🇵 日本語</b></summary>

### Coffee CLI v3.6.2 · OpenCode の Dynamic Island と通知音の修正

- **OpenCode v2 の状態表示に対応。** タブに実行中、承認・回答待ち、待機中を表示し、サブタスクの状態も反映します。切断時は古い状態を非表示にし、OpenCode のグローバル設定の変更は不要です。
- **Windows の通知音を復旧。** 完了、入力待ち、設定画面の試聴を Windows のネイティブ再生に変更し、WebView2 の音声処理が失敗する環境でも従来の音色と設定を維持します。
- **タブの文字とアイコンを調整。** 中国語・英字タイトルの縦位置を揃え、Claude Code、MiMo、Kimi Code のアイコンと Kiro の表示サイズを修正しました。
- **切断後の誤った完了音を防止。** 状態が不明になった時点で保留中の通知音を取り消し、再接続時に古いタスクを完了として通知しません。

</details>

<details>
<summary><b>🇰🇷 한국어</b></summary>

### Coffee CLI v3.6.2 · OpenCode Dynamic Island 및 알림음 수정

- **OpenCode v2 상태 표시 지원.** 탭에 작업 중, 권한 승인 또는 답변 대기, 유휴 상태를 표시하며 하위 작업도 반영합니다. 연결이 끊어지면 오래된 상태를 숨기고 OpenCode 전역 설정은 변경하지 않습니다.
- **Windows 알림음 복구.** 완료, 입력 대기, 설정의 미리 듣기에 Windows 기본 재생을 사용하여 WebView2 오디오 처리 실패를 우회하고 기존 음색과 설정을 유지합니다.
- **탭 제목 정렬 및 도구 아이콘 개선.** 중국어와 영문 제목의 세로 정렬을 조정하고 Claude Code, MiMo, Kimi Code 아이콘과 Kiro 표시 크기를 수정했습니다.
- **연결 복구 시 잘못된 완료음 방지.** 상태를 확인할 수 없으면 대기 중인 완료음을 취소하며, 재연결 시 이전 작업을 방금 완료한 것으로 알리지 않습니다.

</details>
