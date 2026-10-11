<details open>
<summary><b>🇨🇳 简体中文</b></summary>

### Coffee CLI v3.6.0 · AI + 移动消息网关

Coffee CLI 继续推进 AI + 移动消息网关：通过熟悉的微信或 Telegram 与内置 Coffee Agent 对话，让它读取受管理 CLI 终端的实际文字，在你指定的工具和目录中打开桌面真实可见的标签，派发任务并汇报进度，在手机上继续接管工作。v3.6.0 新增哨兵模式、项目经理与专家配置，让 Coffee Agent 能主动通知、理解项目，并协助配置工具。

- **四种工作方式，按需开启。** 英文派发、哨兵模式、项目经理、专家配置集中在消息设置中，采用两行两列开关与说明 Tips，切换后自动保存。
- **英文派发。** 用自己的语言与 Coffee Agent 沟通，它用英文向其他 CLI Agent 派发任务，再用你的语言汇报结果；关闭后也使用你的语言派发。
- **哨兵模式。** 不必先发消息询问：观察到任务结束后，Coffee Agent 会向已连接的消息渠道主动发送结果与完成情况。首版支持 Claude Code、Codex、Kimi Code 与 Oh My Pi。等待权限不视为完成；任务结束也不等于成功，中断和不完整输出会明确说明。
- **项目经理。** 读取项目目录、近期 Git 提交与未提交改动，保存项目理解与记忆，派发前参考，并在需求不清楚时先向你询问。可接入 Graphify 提取代码结构和关系；首次安装依赖需要确认，扫描结果保存在 Coffee CLI 的本地数据目录。开启后会额外消耗模型 token。
- **专家配置。** 读取工具已有的 Skills 与 MCP，按项目需要查找候选并提出建议。目前支持确认后为 Claude Code、Codex 安装项目级 Skill 或受支持的 MCP，在可见终端执行并验证结果；配置变更会再次检查，失败时尝试恢复受影响的配置，并说明仍需处理的状态。已打开的 CLI 可能需要重载或认证。
- **消息设置和 Coffee Agent 标签可拖动。** 与终端标签左右混合排序，关闭、重开和终端重启保持正确顺序，已有工作与输入草稿不受影响。
- **延续手机与电脑共享对话。** 保留本地历史、长对话摘要、工作偏好记忆、泡泡对话、侧边导航和复制按钮；Coffee Agent 界面支持 11 种语言。
- **项目理解与配置识别更可靠。** 修复源码连续变化后的记忆失效检测，减少目录扫描中的 Git 进程调用，并正确识别带行尾注释的 Skill 显式调用策略及缓存符号链接。

消息连接与自动调度仍在持续完善。欢迎通过 [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues) 提交问题、意见和建议，帮助我们改善这套 AI 工作方式。

</details>

<details>
<summary><b>🇬🇧 English</b></summary>

### Coffee CLI v3.6.0 · AI + a Mobile Message Gateway

Coffee CLI continues its AI + mobile message gateway approach. Talk to the built-in Coffee Agent through familiar WeChat or Telegram conversations. It reads the actual text in managed CLI terminals, opens visible desktop tabs in the tools and directories you specify, delegates tasks, and reports progress. Keep managing work from your phone. v3.6.0 adds Sentinel, Project Manager, and Expert Configuration modes for proactive notifications, project understanding, and tool configuration.

- **Four optional work modes.** English Delegation, Sentinel, Project Manager, and Expert Configuration share a two-by-two switch layout in Message Settings, with explanatory tips and automatic saving.
- **English Delegation.** Talk to Coffee Agent in your own language; it sends tasks to other CLI agents in English and reports back in your language. Turn it off to delegate in your language too.
- **Sentinel.** Receive proactive results through connected message channels after an observed task ends. Initial support covers Claude Code, Codex, Kimi Code, and Oh My Pi. Permission waits are excluded from completion notifications. A task ending does not mean it succeeded; interruptions and incomplete output are stated explicitly.
- **Project Manager.** Read project files, recent Git commits, and uncommitted changes; store project understanding and memory, refer to it before delegation, and ask about unclear requirements. Optional Graphify integration extracts code structure and relationships. Dependency installation requires confirmation, and scan data stays in Coffee CLI's local data directory. This mode uses additional model tokens.
- **Expert Configuration.** Inspect existing Skills and MCP settings and suggest candidates for the project. Confirmed project-level Skill and supported MCP installation currently covers Claude Code and Codex, runs in visible terminals, and verifies results. Configuration changes are checked again; failures trigger an attempt to restore affected configuration and report any remaining action needed. Already open CLI tools may need reloading or authentication.
- **Draggable Message Settings and Coffee Agent tabs.** Reorder them alongside terminal tabs. Closing, reopening, and restarting terminals preserves the correct order and existing work and input drafts.
- **Continue conversations across phone and computer.** Retain local history, long-conversation summaries, work preferences, bubble conversations, side navigation, and copy buttons. Coffee Agent's UI supports 11 languages.
- **More reliable project understanding and configuration inspection.** Fix memory invalidation after repeated source changes, reduce Git process calls during directory scans, and correctly recognize Skill invocation policies with inline comments and cache symlinks.

Message connections and automatic coordination are still being refined. Please share problems, ideas, and suggestions through [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues).

</details>

<details>
<summary><b>🇹🇼 繁體中文</b></summary>

### Coffee CLI v3.6.0 · AI + 行動訊息閘道

Coffee CLI 持續推進 AI + 行動訊息閘道：透過熟悉的微信或 Telegram 與內建 Coffee Agent 對話，讓它讀取受管理 CLI 終端的實際文字，在你指定的工具和目錄中開啟桌面實際可見的分頁，派發任務並回報進度，在手機上繼續接管工作。v3.6.0 新增哨兵模式、專案經理與專家設定，提供主動通知、專案理解和工具設定協助。

- **四種工作方式，依需求開啟。** 英文派發、哨兵模式、專案經理、專家設定集中在訊息設定中，採兩行兩列開關與說明 Tips，切換後自動儲存。
- **英文派發。** 用自己的語言與 Coffee Agent 溝通，它以英文向其他 CLI Agent 派發任務，再用你的語言回報；關閉後也用你的語言派發。
- **哨兵模式。** 觀察到任務結束後，主動透過已連線的訊息渠道回報結果。首版支援 Claude Code、Codex、Kimi Code 與 Oh My Pi。等待權限不視為完成；任務結束也不等於成功，中斷與不完整輸出會明確說明。
- **專案經理。** 讀取專案目錄、近期 Git 提交及未提交變更，保存專案理解與記憶，派發前參考，需求不明確時先詢問。可接入 Graphify 提取程式碼結構與關係；安裝依賴需要確認，掃描資料保存在 Coffee CLI 本機資料目錄。開啟後會額外消耗模型 token。
- **專家設定。** 讀取工具已有的 Skills 和 MCP，依專案需要查找候選並建議。目前支援確認後為 Claude Code、Codex 安裝專案級 Skill 或受支援的 MCP，在可見終端執行並驗證結果；重新檢查設定變更，失敗時嘗試還原受影響的設定，並說明仍需處理的狀態。已開啟的 CLI 可能需要重新載入或驗證身分。
- **訊息設定和 Coffee Agent 分頁可拖動。** 與終端分頁左右混合排序，關閉、重開及終端重啟保持正確順序，不影響既有工作與輸入草稿。
- **延續手機與電腦共享對話。** 保留本機歷史、長對話摘要、工作偏好記憶、泡泡對話、側邊導覽和複製按鈕；Coffee Agent 介面支援 11 種語言。
- **專案理解與設定識別更可靠。** 修復原始碼連續變更後的記憶失效偵測，減少目錄掃描的 Git 程序呼叫，並正確識別含行尾註解的 Skill 呼叫策略及快取符號連結。

訊息連線與自動調度仍在持續完善。歡迎透過 [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues) 提交問題、意見和建議。

</details>

<details>
<summary><b>🇯🇵 日本語</b></summary>

### Coffee CLI v3.6.0 · AI + モバイルメッセージゲートウェイ

Coffee CLI は AI + モバイルメッセージゲートウェイを引き続き進めています。WeChat や Telegram で内蔵 Coffee Agent と会話すると、管理対象の CLI ターミナルに実際に表示される文字を読み取り、指定したツールとディレクトリでデスクトップのタブを開き、タスクを依頼して進捗を報告します。スマートフォンから仕事を管理できます。v3.6.0 では、完了通知、プロジェクト理解、ツール設定を支援する新しいモードを追加しました。

- **4 つの任意モード。** 英語でのタスク依頼、Sentinel、Project Manager、Expert Configuration をメッセージ設定の 2 行 2 列のスイッチにまとめました。説明 Tips を表示でき、切り替えは自動保存されます。
- **英語でのタスク依頼。** 自分の言語で Coffee Agent と会話し、ほかの CLI Agent への依頼は英語、結果の報告は自分の言語で受け取れます。オフにすると依頼にも自分の言語を使います。
- **Sentinel。** 観測したタスクが終了すると、接続済みメッセージチャネルへ結果を自動通知します。初期対応は Claude Code、Codex、Kimi Code、Oh My Pi です。権限待ちは完了通知の対象外です。終了は成功を意味するとは限らず、中断や不完全な出力は明示します。
- **Project Manager。** プロジェクトファイル、最近の Git コミット、未コミットの変更を読み、理解と記憶を保存して依頼前に参照します。曖昧な要件は先に確認します。Graphify でコード構造と関係を抽出でき、依存ツールのインストールには確認が必要です。解析データは Coffee CLI のローカルデータディレクトリに保存します。追加のモデル token を消費します。
- **Expert Configuration。** 既存の Skills と MCP 設定を読み、プロジェクト向けの候補を提案します。現在は Claude Code と Codex に対するプロジェクト単位の Skill と対応 MCP の確認後インストールを支援します。可視ターミナルで実行して結果を検証し、設定変更を再確認します。失敗時は設定の復元を試み、残っている対応事項を報告します。起動中の CLI は再読み込みや認証が必要な場合があります。
- **設定と Coffee Agent のタブをドラッグ。** ターミナルタブと混在させて左右に並べ替えられます。閉じる、再び開く、ターミナルを再起動する操作でも順序と作業、入力中の下書きを保持します。
- **スマートフォンとパソコンで会話を継続。** ローカル履歴、長い会話の要約、作業上の好み、吹き出し表示、サイドナビゲーション、コピーボタンを引き続き利用できます。Coffee Agent の UI は 11 言語に対応します。
- **プロジェクト理解と設定確認の信頼性を改善。** ソースの連続変更による記憶の更新漏れ、ディレクトリ走査時の過剰な Git 呼び出し、行末コメント付き Skill ポリシーとキャッシュのシンボリックリンク判定を修正しました。

メッセージ接続と自動調整は引き続き改善中です。不具合、ご意見、ご提案を [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues) にお寄せください。

</details>

<details>
<summary><b>🇰🇷 한국어</b></summary>

### Coffee CLI v3.6.0 · AI + 모바일 메시지 게이트웨이

Coffee CLI는 AI + 모바일 메시지 게이트웨이 방식을 계속 발전시키고 있습니다. WeChat이나 Telegram에서 내장 Coffee Agent와 대화하면 관리 중인 CLI 터미널의 실제 텍스트를 읽고, 지정한 도구와 디렉터리에서 데스크톱에 보이는 탭을 열어 작업을 전달하고 진행 상황을 알려 줍니다. 휴대폰에서 계속 작업을 관리할 수 있습니다. v3.6.0은 능동 알림, 프로젝트 이해, 도구 설정을 위한 새 모드를 추가합니다.

- **필요에 따라 선택하는 4가지 모드.** 영어 작업 전달, Sentinel, Project Manager, Expert Configuration을 메시지 설정의 2행 2열 스위치에 모았습니다. 설명 Tips를 제공하며 변경은 자동 저장합니다.
- **영어 작업 전달.** 자신의 언어로 Coffee Agent와 대화하고, 다른 CLI Agent에는 영어로 작업을 전달하며 결과는 자신의 언어로 받습니다. 끄면 작업 전달에도 자신의 언어를 사용합니다.
- **Sentinel.** 관찰된 작업이 끝나면 연결된 메시지 채널로 결과를 먼저 알려 줍니다. 초기 지원 도구는 Claude Code, Codex, Kimi Code, Oh My Pi입니다. 권한 대기는 완료 알림 대상이 아닙니다. 종료가 성공을 뜻하지는 않으며, 중단과 불완전한 출력은 명확하게 설명합니다.
- **Project Manager.** 프로젝트 파일, 최근 Git 커밋, 커밋하지 않은 변경을 읽고 프로젝트 이해와 기억을 저장하여 작업 전달 전에 참고합니다. 요구가 불명확하면 먼저 질문합니다. Graphify로 코드 구조와 관계를 추출할 수 있으며 의존 도구 설치는 확인이 필요합니다. 분석 데이터는 Coffee CLI의 로컬 데이터 디렉터리에 저장합니다. 추가 모델 token을 사용합니다.
- **Expert Configuration.** 기존 Skills와 MCP 설정을 읽고 프로젝트에 맞는 후보를 제안합니다. 현재는 확인 후 Claude Code와 Codex에 프로젝트 단위 Skill 또는 지원 MCP를 설치합니다. 보이는 터미널에서 실행하고 결과를 검증하며 설정 변경을 다시 확인합니다. 실패하면 설정 복원을 시도하고 남은 조치 사항을 보고합니다. 이미 열린 CLI는 다시 로드하거나 인증해야 할 수 있습니다.
- **메시지 설정과 Coffee Agent 탭 드래그.** 터미널 탭과 함께 좌우 순서를 바꿀 수 있습니다. 닫기, 다시 열기, 터미널 재시작에도 올바른 순서와 기존 작업, 입력 초안을 유지합니다.
- **휴대폰과 컴퓨터에서 대화 이어가기.** 로컬 기록, 긴 대화 요약, 작업 선호 기억, 말풍선 대화, 측면 탐색, 복사 버튼을 유지합니다. Coffee Agent UI는 11개 언어를 지원합니다.
- **프로젝트 이해와 설정 인식 개선.** 소스가 연속 변경될 때 기억 갱신이 누락되던 문제를 수정하고 디렉터리 검색의 Git 호출을 줄였습니다. 줄 끝 주석이 있는 Skill 호출 정책과 캐시 심볼릭 링크도 올바르게 처리합니다.

메시지 연결과 자동 조율은 계속 개선 중입니다. 문제, 의견, 제안을 [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues)에 남겨 주세요.

</details>
