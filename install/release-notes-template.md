<details open>
<summary><b>🇨🇳 简体中文</b></summary>

### Coffee CLI v3.6.1 · AI + 移动消息网关，记忆更持久

通过微信或 Telegram 与 Coffee Agent 对话，让它在电脑上打开你指定的 CLI 工具和目录、派发任务并汇报进度，在手机上继续接管工作。延续 v3.6.0 的英文派发、哨兵模式、项目经理和专家配置，本次升级让 Coffee Agent 更好地记住工作，并减少长输出占用的上下文。

- **强化长期记忆。** 回复后在后台整理长期偏好与用户确认的项目决策，按身份和已核实的项目召回，支持去重、更新与容量整理；后续手动修改或忘记优先于旧的后台任务。自动提炼会额外消耗配置模型的 token，记忆有容量限制。
- **RTK 式长输出压缩与原文回读。** 长历史和项目结果先提供精简摘要，保留准确的路径与标识；需要细节时按页读取已保存的原文，重启或新建对话后仍可回读。实时终端画面、输入结果、文件读取和安装计划保持完整。
- **长对话更稳。** 前文摘要失败时使用近期上下文继续对话，完整历史仍保留，不会误推进摘要进度。
- **标签样式更精致。** 各主题采用矩形标签，按样式调整圆角和边距；Panel 保持连贯线条，标签与页面的层次更清楚。
- **新增 Kiro 与 MiniMax Code。** 支持启动已安装的工具，提供品牌图标和分屏选择；本次仅支持启动，不包含会话记录、热力图和状态集成。
- **改善 Windows 滚轮交互。** 修复 Pi、Oh My Pi 和 Claude Code 的部分全屏终端界面无法收到滚轮事件的问题，其他终端保持原有滚动方式。感谢 @keros68 提供线索。

消息连接与自动调度仍在持续完善。欢迎通过 [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues) 提交问题、意见和建议。

</details>

<details>
<summary><b>🇬🇧 English</b></summary>

### Coffee CLI v3.6.1 · AI + a Mobile Message Gateway, with Stronger Memory

Talk to Coffee Agent through WeChat or Telegram. It opens visible desktop CLI tabs in your chosen tools and directories, delegates tasks, and reports progress so you can keep managing work from your phone. Building on v3.6.0's English Delegation, Sentinel, Project Manager, and Expert Configuration modes, this release strengthens memory and reduces context used by long output.

- **Stronger durable memory.** Background extraction captures lasting preferences and user-confirmed project decisions, with identity-scoped recall, verified project scope, deduplication, updates, and capacity management. Later manual corrections and forgetting take priority over stale background work. Extraction uses additional configured-model tokens; memory has capacity limits.
- **Recoverable RTK-style output compression.** Long history and project results use compact summaries with exact paths and identifiers. Read saved originals in pages, including after a restart or a new conversation. Live terminal screens, input results, file reads, and installation plans remain intact.
- **More resilient long conversations.** If summarization fails, continue using recent context while retaining the full archive and the previous summary checkpoint.
- **Refined tabs across themes.** Rectangular tabs use theme-specific corners and balanced spacing; Panel retains connected borders.
- **Kiro and MiniMax Code launch support.** Add brand icons and split-pane selection for installed tools. This is launch-only support, without history, heatmap, or status integration.
- **Improved Windows wheel interaction.** Restore wheel reports in affected Pi, Oh My Pi, and Claude Code alternate-screen TUIs while preserving other terminals' scrolling. Thanks to @keros68 for the investigation.

Message connections and automatic coordination continue to improve. Please share feedback through [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues).

</details>

<details>
<summary><b>🇹🇼 繁體中文</b></summary>

### Coffee CLI v3.6.1 · AI + 行動訊息閘道，記憶更持久

透過微信或 Telegram 與 Coffee Agent 對話，讓它在電腦上開啟你指定的 CLI 工具和目錄、派發任務並回報進度，在手機上繼續接管工作。延續 v3.6.0 的英文派發、哨兵模式、專案經理和專家設定，本次強化記憶，並減少長輸出佔用的上下文。

- **強化長期記憶。** 回覆後在背景整理長期偏好及使用者確認的專案決策，依身分及已核實的專案召回，支援去重、更新與容量整理。後續手動修改或忘記優先於舊的背景任務。自動提煉會額外消耗設定模型的 token，記憶有容量限制。
- **RTK 式長輸出壓縮與原文回讀。** 長歷史及專案結果提供精簡摘要，保留準確路徑與識別碼；可分頁讀取原文，重新啟動或建立新對話後仍可讀取。即時終端畫面、輸入結果、檔案讀取及安裝計畫保持完整。
- **長對話更穩。** 前文摘要失敗時使用近期上下文繼續對話，保留完整歷史及原有摘要進度。
- **分頁樣式更精緻。** 各主題採用矩形分頁，依樣式調整圓角和邊距；Panel 保持連貫線條。
- **新增 Kiro 與 MiniMax Code。** 支援啟動已安裝的工具，提供品牌圖示及分割畫面選擇；本次僅支援啟動，不含歷史、熱力圖和狀態整合。
- **改善 Windows 滾輪互動。** 修復 Pi、Oh My Pi 和 Claude Code 部分全螢幕终端介面的滾輪事件，其他終端保持原有滾動方式。感謝 @keros68 提供線索。

訊息連線與自動調度仍在持續完善。歡迎透過 [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues) 提交問題、意見和建議。

</details>

<details>
<summary><b>🇯🇵 日本語</b></summary>

### Coffee CLI v3.6.1 · AI + モバイルメッセージゲートウェイ、記憶を強化

WeChat や Telegram で Coffee Agent と会話し、指定したツールとディレクトリでデスクトップの CLI タブを開き、タスクの依頼と進捗確認をスマートフォンから行えます。v3.6.0 の英語依頼、Sentinel、Project Manager、Expert Configuration を引き継ぎ、記憶と長い出力の扱いを改善しました。

- **長期記憶を強化。** 返信後に、継続的な好みとユーザーが確認したプロジェクト方針をバックグラウンドで整理します。ユーザーと確認済みプロジェクトごとに関連情報を参照し、重複除去、更新、容量管理に対応します。後からの手動修正や削除を優先します。設定モデルの追加 token を使用し、記憶容量には上限があります。
- **元の出力を読める RTK 方式の圧縮。** 長い履歴とプロジェクト情報を要約し、パスと識別子は正確に保持します。保存した原文はページ単位で読み取れ、再起動や新しい会話でも参照できます。現在のターミナル画面、入力結果、ファイル読み取り、インストール計画は圧縮しません。
- **長い会話の継続性を改善。** 要約が失敗しても最近の文脈で会話を続け、完全な履歴と元の要約位置を保持します。
- **テーマに合わせたタブ。** 長方形タブの角と余白を調整し、Panel は連続した境界線を保持します。
- **Kiro と MiniMax Code を追加。** インストール済みツールの起動、ブランドアイコン、分割画面の選択に対応します。履歴、ヒートマップ、状態連携は含みません。
- **Windows のホイール操作を改善。** Pi、Oh My Pi、Claude Code の一部の全画面 TUI にホイール入力を届け、ほかのターミナルのスクロールは維持します。調査に協力した @keros68 に感謝します。

接続と自動調整は引き続き改善中です。ご意見や不具合を [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues) にお寄せください。

</details>

<details>
<summary><b>🇰🇷 한국어</b></summary>

### Coffee CLI v3.6.1 · AI + 모바일 메시지 게이트웨이, 기억 강화

WeChat이나 Telegram에서 Coffee Agent와 대화하면 지정한 도구와 디렉터리로 데스크톱 CLI 탭을 열고, 작업을 전달하고, 휴대폰에서 진행 상황을 확인할 수 있습니다. v3.6.0의 영어 작업 전달, Sentinel, Project Manager, Expert Configuration을 이어 가며 기억과 긴 출력 처리를 개선했습니다.

- **장기 기억 강화.** 답변 후 지속적인 선호와 사용자가 확인한 프로젝트 결정을 백그라운드에서 정리합니다. 사용자와 확인된 프로젝트에 따라 관련 기억을 불러오고, 중복 제거, 갱신, 용량 관리를 지원합니다. 나중에 수동으로 수정하거나 잊도록 한 내용이 이전 백그라운드 작업보다 우선합니다. 설정 모델의 추가 token을 사용하며 기억 용량에는 제한이 있습니다.
- **원문을 다시 읽을 수 있는 RTK 방식 압축.** 긴 기록과 프로젝트 결과를 요약하면서 경로와 식별자는 정확히 보존합니다. 저장된 원문은 페이지 단위로 읽으며 재시작이나 새 대화에서도 확인할 수 있습니다. 실시간 터미널 화면, 입력 결과, 파일 읽기, 설치 계획은 그대로 유지합니다.
- **긴 대화의 안정성 개선.** 요약에 실패해도 최근 문맥으로 대화를 계속하며 전체 기록과 이전 요약 위치를 보존합니다.
- **테마에 맞춘 탭 개선.** 직사각형 탭의 모서리와 여백을 다듬고 Panel은 이어지는 테두리를 유지합니다.
- **Kiro와 MiniMax Code 추가.** 설치된 도구 실행, 브랜드 아이콘, 분할 화면 선택을 지원합니다. 기록, 히트맵, 상태 연동은 포함하지 않습니다.
- **Windows 휠 입력 개선.** Pi, Oh My Pi, Claude Code의 일부 전체 화면 TUI에 휠 이벤트를 전달하며 다른 터미널의 스크롤은 유지합니다. 조사에 도움을 준 @keros68에게 감사합니다.

연결과 자동 조율은 계속 개선 중입니다. 문제와 의견을 [GitHub Issues](https://github.com/edison7009/Coffee-CLI/issues)에 남겨 주세요.

</details>
