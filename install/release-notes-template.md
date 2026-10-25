<details open>
<summary><b>🇨🇳 简体中文</b></summary>

### Coffee CLI v3.7.0 · 桌面会话、动态分屏与使用统计

- **Claude Code 与 Codex 桌面式。** 支持对话、工具执行、权限请求与历史导航；新增欢迎动画，完善链接、右键和输入操作。首次使用默认以 Desktop 打开，保留已有偏好。
- **动态分屏。** 从会话列表添加或关闭分屏，保留面板编号与悬停关闭，替代旧的固定二、三、四屏入口。
- **本地使用统计。** 汇总两个工具可读取的本地记录，按日期、工具和项目查看 Token、会话、趋势与模型分布。优先显示缓存，后台静默同步。
- **Coffee Agent 接入桌面会话。** 读取、发送消息与中断均复用原会话，不另开终端；权限请求仍由用户处理。模型设置布局更紧凑，保存按钮移至右侧。
- **工作区体验优化。** 统一目录选择和最近目录入口，支持英文 Terminal / Desktop 切换；完善修改记录、文件预览与 Markdown 展示，调整首次启动的主题、图标与快捷键默认值。

- **更新日志随版本展示。** 首次安装或升级后自动展示一次，右上角可随时查看；按界面语言显示，支持本地缓存和离线阅读。发布流程自动同步远程版本文件中的日志。
- **任务与拖拽细节修复。** Tasks 标签显示任务总数，便签式与分类式拖拽线居中贴合底边；分屏分隔条恢复左右、上下调节指针。新安装用户的 Gambit 默认高度降至最小的 120px，已有设置保持不变。

- **工具设置与启动预设。** 工具卡片右侧齿轮直达原有配置，点击卡片继续选择目录；Claude Code 与 Codex 提供可编辑的启动命令预设，统一主题下拉组件，选择后点击保存才生效。提高保存按钮的可辨识度，修复拖选文字到弹窗外松开时误关闭的问题。
- **会话与目录更稳定。** 打开前检查目录是否存在，移除已确认失效的最近目录，避免桌面会话反复重连。删除历史记录时同步关闭对应标签与分屏，目录分类中的分支等状态图标不再撑高列表；桌面式反问的自定义回答支持 Enter 提交，并避免输入法误提交。
- **统一窗口交互。** 目录列表从卡片下方偏右展开，避开 Terminal / Desktop 文字；设置弹窗只淡入，不再缩放或位移。统一关闭按钮的红色悬停反馈，修复更新日志首次打开时关闭按钮出现焦点边框的问题。
- **Windows 控制台兼容处理。** Windows x64 安装包内置新版微软 ConPTY 控制台组件，减少对系统旧版组件的依赖。Windows 10 鼠标点击与滚轮的兼容效果仍待实机回测。

- **会话列表更清晰。** 每条会话左侧显示与文字等高的工具图标，统一标题对齐；分支、PR 与 CI 状态采用一致的语义配色，适配深浅主题，保持原有行高和交互。
- **桌面模型信息与图标更新。** Codex 欢迎区显示当前模型 ID，并跟随模型切换更新；Claude Code 模型名称充分利用可用宽度，窄分屏仍可安全省略。Codex 工具图标更新为随主题变色的单色标识。

</details>

<details>
<summary><b>🇬🇧 English</b></summary>

### Coffee CLI v3.7.0 · Desktop Sessions, Dynamic Splits and Usage Statistics

- **Claude Code and Codex desktop conversations.** Chat, tool execution, permission requests and history navigation, with welcome animations and improved links, context menus and input. Desktop is the default for new users; saved preferences stay intact.
- **Dynamic split views.** Add or close panes from the session list, with pane numbers and hover close controls, replacing the fixed two-, three- and four-pane launchers.
- **Local usage statistics.** View available local records by date, tool and project, including tokens, sessions, trends and model distribution. Cached results appear first while updates run quietly in the background.
- **Coffee Agent desktop support.** Read, send messages and interrupt within the original session without opening another terminal. Permission requests remain under user control. Model settings use a compact layout with Save on the right.
- **Workspace refinements.** Consistent folder selection and recent directories, English Terminal / Desktop tabs, improved changes and file previews with Markdown rendering, and updated first-launch theme, icon and shortcut defaults.

- **Release notes inside the app.** Shown once after a fresh installation or upgrade and available from the top-right corner. Notes follow the interface language, support local caching and offline reading, and sync automatically to the remote version manifest during publishing.
- **Task and resize refinements.** Tasks shows the total count, note and category resize grips sit on the bottom border, and split dividers use the correct horizontal or vertical resize cursor. New installations start Gambit at its minimum 120px height; saved preferences stay intact.

- **Tool settings and launch presets.** Gears on tool cards open their existing settings while card clicks still select a folder. Claude Code and Codex offer editable launch presets using shared themed menus; changes apply only after Save. Save is easier to distinguish, and dragging a text selection outside the dialog no longer dismisses it.
- **Session and folder reliability.** Check directories before opening, remove confirmed invalid recent folders and prevent repeated desktop reconnects. Deleting history closes its matching tabs and split panes. Branch and other status icons no longer change project-row height. Custom answers to desktop questions support Enter with input-method protection.
- **Consistent window interactions.** Folder menus open below and slightly right of the card, clear of Terminal / Desktop labels. Settings fade in without scaling or moving. Close controls share red hover feedback, and release notes no longer initially focus the close button with an outline.
- **Windows console compatibility work.** Windows x64 packages include a newer Microsoft ConPTY runtime to reduce reliance on older system components. Mouse click and wheel behavior on Windows 10 still requires testing on a Windows 10 machine.

- **Clearer session lists.** Tool icons sit beside session titles at the same size as the text, with consistent alignment. Branch, PR and CI indicators use shared semantic colors adapted to light and dark themes while preserving row heights and interactions.
- **Desktop model details and refreshed icons.** The Codex welcome area shows the current model ID and follows model changes. Claude Code model names use the available width and truncate only when needed in narrow panes. Codex tool icons use a theme-aware monochrome mark.

</details>

<details>
<summary><b>🇹🇼 繁體中文</b></summary>

### Coffee CLI v3.7.0 · 桌面對話、動態分割與使用統計

- **Claude Code 與 Codex 桌面式。** 支援對話、工具執行、權限請求及歷史導覽，新增歡迎動畫並改善連結、右鍵及輸入操作。首次使用預設以 Desktop 開啟，保留既有偏好。
- **動態分割畫面。** 從對話清單新增或關閉面板，保留編號與懸停關閉，取代固定二、三、四屏入口。
- **本機使用統計。** 依日期、工具與專案檢視可讀取的本機 Token、對話、趨勢及模型分布。優先顯示快取，背景靜默同步。
- **Coffee Agent 桌面支援。** 讀取、傳送訊息及中斷均沿用原對話，不另開終端；權限請求仍由使用者處理。模型設定更緊湊，儲存按鈕移至右側。
- **工作區改善。** 統一目錄選擇與最近目錄入口，使用英文 Terminal / Desktop 切換，改善修改記錄、檔案與 Markdown 預覽，調整首次啟動預設值。

- **更新日誌隨版本顯示。** 首次安裝或升級後自動顯示一次，右上角可隨時檢視；依介面語言顯示，支援本機快取與離線閱讀。發布流程自動同步遠端版本檔中的日誌。
- **任務與拖曳細節修正。** Tasks 顯示任務總數，便箋式與分類式的拖曳線置中貼合底邊；分割面板恢復左右、上下調整游標。新安裝的 Gambit 預設為最低 120px，保留既有設定。

- **工具設定與啟動預設。** 工具卡片右側齒輪直接開啟既有設定，點擊卡片繼續選擇目錄；Claude Code 與 Codex 提供可編輯的啟動命令預設，使用統一主題下拉元件，點擊儲存後才生效。提高儲存按鈕的辨識度，修正拖曳文字選取至彈窗外放開時誤關閉的問題。
- **對話與目錄更穩定。** 開啟前檢查目錄，移除確認失效的最近目錄，避免桌面對話反覆重新連線。刪除歷史記錄時同步關閉對應分頁與分割面板；分支等狀態圖示不再撐高專案清單。桌面式提問的自訂回答支援 Enter，並避免輸入法誤送。
- **統一視窗互動。** 目錄選單從卡片下方偏右展開，避開 Terminal / Desktop 文字；設定彈窗只淡入，不再縮放或位移。關閉按鈕統一使用紅色懸停回饋，修正更新日誌首次開啟時關閉按鈕出現焦點框的問題。
- **Windows 主控台相容處理。** Windows x64 安裝包內建新版微軟 ConPTY 元件，減少對系統舊版元件的依賴。Windows 10 滑鼠點擊與滾輪的相容效果仍待實機回測。

- **對話列表更清楚。** 每條對話左側顯示與文字等高的工具圖示，統一標題對齊；分支、PR 與 CI 狀態使用一致的語意配色，適配深淺主題，維持原有行高與操作。
- **桌面模型資訊與圖示更新。** Codex 歡迎區顯示目前模型 ID，並隨模型切換更新；Claude Code 模型名稱充分利用可用寬度，窄分割畫面仍可安全省略。Codex 工具圖示更新為隨主題變色的單色標誌。

</details>

<details>
<summary><b>🇯🇵 日本語</b></summary>

### Coffee CLI v3.7.0 · デスクトップ会話、動的分割と使用統計

- **Claude Code と Codex のデスクトップ会話。** 会話、ツール実行、権限要求、履歴ナビゲーションに対応。歓迎アニメーション、リンク、右クリック、入力操作を改善しました。初回は Desktop で開き、既存の設定は保持します。
- **動的な分割表示。** 会話一覧からペインを追加・閉じることができます。番号とホバー時の閉じる操作を維持し、固定の二・三・四分割の入口を置き換えました。
- **ローカル使用統計。** 読み取れる記録を日付・ツール・プロジェクトで絞り込み、トークン、会話数、推移、モデル分布を表示。キャッシュを先に表示し、バックグラウンドで更新します。
- **Coffee Agent のデスクトップ対応。** 別のターミナルを開かず、同じ会話の読み取り、送信、中断を実行します。権限要求はユーザーが処理します。モデル設定を整理し、保存ボタンを右側へ移しました。
- **ワークスペース改善。** フォルダー選択と最近使った場所を統一。英語の Terminal / Desktop タブ、変更履歴、ファイルと Markdown のプレビュー、初回起動時の既定値を改善しました。

- **アプリ内の更新履歴。** 初回インストールや更新後に一度表示し、右上からいつでも確認できます。表示言語に対応し、キャッシュとオフライン閲覧をサポート。公開時にリモートのバージョン情報へ自動同期します。
- **タスクとサイズ変更の改善。** Tasks に総数を表示し、ノート・カテゴリ表示のハンドルを下端中央へ配置。分割境界の左右・上下リサイズカーソルを修正しました。新規インストール時の Gambit は最小の 120px で開き、保存済み設定は維持します。

- **ツール設定と起動プリセット。** ツールカードの歯車から既存の設定を開き、カード本体からはフォルダーを選択できます。Claude Code と Codex に編集可能な起動コマンドのプリセットを追加。共通テーマのメニューを使い、保存後に適用します。保存ボタンの視認性を高め、文字選択をダイアログ外で離した際の誤終了を修正しました。
- **会話とフォルダーの安定性。** 起動前にフォルダーを確認し、存在しないことが確認できた最近の場所を除外して再接続の繰り返しを防ぎます。履歴の削除に合わせて対応するタブと分割ペインを閉じます。ブランチなどの状態アイコンで一覧の行高が変わらなくなりました。デスクトップの質問への自由回答を Enter で送信でき、IME確定時の誤送信を防ぎます。
- **統一したウィンドウ操作。** フォルダーメニューをカード下のやや右側に表示し、Terminal / Desktop の文字と重ならないようにしました。設定は移動・拡大せずフェードインします。閉じるボタンのホバーを赤色に統一し、更新履歴の初回表示で閉じるボタンにフォーカス枠が出る問題を修正しました。
- **Windows コンソールの互換性対応。** Windows x64 パッケージに新しい Microsoft ConPTY を同梱し、古いシステムコンポーネントへの依存を減らしました。Windows 10 のマウスクリックとホイールの動作は実機での検証が必要です。

- **見やすい会話一覧。** タイトルの左に文字と同じ大きさのツールアイコンを表示し、位置を統一しました。ブランチ、PR、CI は状態に応じた共通色を使い、ライト・ダーク両テーマに対応します。行の高さと操作は維持します。
- **デスクトップのモデル情報とアイコン更新。** Codex の歓迎画面に現在のモデル ID を表示し、モデル変更に追従します。Claude Code のモデル名は利用可能な幅を使い、狭いペインでのみ省略します。Codex のツールアイコンはテーマに追従する単色マークになりました。

</details>

<details>
<summary><b>🇰🇷 한국어</b></summary>

### Coffee CLI v3.7.0 · 데스크톱 대화, 동적 분할 및 사용 통계

- **Claude Code 및 Codex 데스크톱 대화.** 대화, 도구 실행, 권한 요청과 기록 탐색을 지원합니다. 시작 애니메이션, 링크, 우클릭 및 입력 동작을 개선했습니다. 처음에는 Desktop으로 열리며 기존 설정은 유지됩니다.
- **동적 분할 보기.** 대화 목록에서 패널을 추가하거나 닫습니다. 번호와 마우스를 올렸을 때의 닫기 버튼을 유지하며 기존 고정 2·3·4분할 진입 방식을 대체합니다.
- **로컬 사용 통계.** 읽을 수 있는 기록을 날짜, 도구, 프로젝트별로 확인하고 토큰, 대화 수, 추세와 모델 분포를 표시합니다. 캐시를 먼저 보여 주고 백그라운드에서 조용히 갱신합니다.
- **Coffee Agent 데스크톱 지원.** 별도 터미널 없이 같은 대화를 읽고 메시지를 보내고 중단합니다. 권한 요청은 사용자가 처리합니다. 모델 설정을 간결하게 정리하고 저장 버튼을 오른쪽으로 옮겼습니다.
- **작업 공간 개선.** 폴더 선택과 최근 경로를 통일하고 영어 Terminal / Desktop 탭을 적용했습니다. 변경 기록, 파일 및 Markdown 미리보기와 최초 실행 기본값을 개선했습니다.

- **앱 내 업데이트 내역.** 처음 설치하거나 업데이트한 뒤 한 번 표시하며 오른쪽 위에서 언제든 다시 볼 수 있습니다. 인터페이스 언어, 로컬 캐시 및 오프라인 읽기를 지원하며 배포 시 원격 버전 파일에 자동으로 동기화합니다.
- **작업 및 크기 조절 개선.** Tasks에 전체 작업 수를 표시하고 메모·분류 보기의 조절선을 아래쪽 테두리 중앙에 배치했습니다. 분할 경계의 가로·세로 조절 커서를 수정했습니다. 새 설치의 Gambit 기본 높이는 최소 120px이며 기존 설정은 유지합니다.

- **도구 설정 및 실행 프리셋.** 도구 카드의 톱니바퀴로 기존 설정을 열고 카드 본문에서는 폴더를 선택합니다. Claude Code와 Codex에 편집 가능한 실행 명령 프리셋을 추가했습니다. 공통 테마 메뉴를 사용하며 저장해야 적용됩니다. 저장 버튼을 더 명확하게 표시하고 텍스트를 선택해 대화상자 밖에서 놓을 때 잘못 닫히던 문제를 수정했습니다.
- **대화 및 폴더 안정성.** 실행 전에 폴더를 확인하고 실제로 없어진 최근 경로를 제거해 데스크톱 대화의 반복 재연결을 방지합니다. 기록을 삭제하면 해당 탭과 분할 패널도 닫힙니다. 브랜치 등 상태 아이콘이 프로젝트 목록의 행 높이를 바꾸지 않습니다. 데스크톱 질문의 직접 입력 답변을 Enter로 제출할 수 있으며 입력기 확정 시 잘못 제출되지 않습니다.
- **일관된 창 동작.** 폴더 메뉴를 카드 아래에서 약간 오른쪽으로 열어 Terminal / Desktop 글자를 가리지 않습니다. 설정 창은 확대나 이동 없이 페이드인합니다. 닫기 버튼의 마우스 올림 효과를 빨간색으로 통일하고 업데이트 내역을 처음 열 때 닫기 버튼에 포커스 테두리가 생기던 문제를 수정했습니다.
- **Windows 콘솔 호환 처리.** Windows x64 설치 패키지에 새 Microsoft ConPTY 구성 요소를 포함해 오래된 시스템 구성 요소에 대한 의존도를 줄였습니다. Windows 10의 마우스 클릭과 휠 동작은 실제 Windows 10 기기에서 추가 확인이 필요합니다.

- **더 명확한 대화 목록.** 제목 왼쪽에 글자와 같은 크기의 도구 아이콘을 표시하고 정렬을 통일했습니다. 브랜치, PR, CI 표시에 일관된 상태 색상을 적용하고 밝은 테마와 어두운 테마에 맞춰 조정합니다. 행 높이와 기존 동작은 유지합니다.
- **데스크톱 모델 정보 및 아이콘 개선.** Codex 시작 화면에 현재 모델 ID를 표시하고 모델 변경을 반영합니다. Claude Code 모델 이름은 사용 가능한 너비를 활용하며 좁은 패널에서만 생략합니다. Codex 도구 아이콘은 테마에 따라 색상이 바뀌는 단색 표시로 갱신했습니다.

</details>
