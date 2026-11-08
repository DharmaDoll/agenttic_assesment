# 自律型エージェントによる継続的な脆弱性検知

このリポジトリは、自社の脆弱性をAIエージェントを使う攻撃者より早く検知するためのPoCと、その後の継続運用を計画する文書をまとめています。最初は対象を限定して実際にagentを動かし、探索した範囲、確認済みの問題、未確認箇所、所要時間と費用を記録します。

各案の計画に加え、D案のARTEX WebUIをローカルで起動するCompose・セットアップ・ブラウザ確認を実装しました。2026-11-08に初期管理者設定、実ブラウザログイン、停止・再開後の保持を確認済みです。今回の範囲はユーザー指定によりモデルなしのWebUIまでです。モデル接続・脆弱性診断・日次実行はまだ行っていません。A案は試行計画と実行設計の2本で管理します。

## D案のWebUIを起動する

Linux／WSL2、Docker Engine＋Compose v2、Bash、curl、tar、sha256sum、OpenSSL、makeを使います。初期設定と統合テストにはNode.js 18以上、Chromium、jqが必要です。実際の版と検証結果は[D案の実行設計](docs/artex/spec.md#2-最初のチェックポイント画面を開く)に記録します。

```sh
make setup   # 固定ソース取得・照合、ローカルDBパスワード生成（再実行で上書きしない）
make build   # upstream Dockerfileからビルド。依存取得にネット接続が必要
make up      # 既存imageで起動し、DBとUIのhealthcheckを待つ
make init    # 初回のみ管理者設定。実ブラウザでログインも確認
make test    # 既存パスワードでブラウザログイン・API・モデル未接続を確認
make status
make stop    # Web入口・ARTEX・DBを停止。データ・鍵・DB volumeを保持
```

今回のWSL2ではDocker bridge経由の大容量downloadが途中停止したため、ビルドには `ARTEX_BUILD_NETWORK=host make build` を使います。この指定はビルド時の通信だけに作用し、runtimeの隔離設定は変えません。通常の環境では `make build` から開始できます。

画面は `http://127.0.0.1:8787`。ユーザー名は `ARTEX`。`make init` が生成したパスワードは、端末で `cat var/artex/admin-password` を実行して手元だけで確認します。値をGitやチャットへ貼らないでください。停止後は `make up` で再開できます。

このComposeはWebUI確認専用です。Nginxがloopbackの入口を担当し、DB・ARTEXの通信記録proxyをhostへ公開しません。ARTEX／DBは`internal`ネットワークだけに置き、モデル資格情報は投入しません。診断へ進む際に対象・モデル・予算と通信境界を確定します。ARTEXの外部通信を開けるだけで診断へ移行しません。

`make lint` はBash／Node構文とdiffの空白を確認します。`make test` は起動済みサービスに対する統合確認で、モックを使いません。既存サービスへ診断taskを作成する処理もありません。

## ディレクトリ構成

```text
README.md                         # 文書の入口
AGENTS.md                         # リポジトリの作業指針
TARGET_TECH_STACK.md               # 共通の対象技術台帳
Makefile                          # D：セットアップ・起動・確認・停止
src/artex/                        # D：Compose、固定ソース指定、操作スクリプト
tests/artex/                      # D：実ブラウザ・APIの統合確認
var/artex/                        # Git対象外：upstreamソース、秘密値、データ、証拠
docs/
  agentic-security-plan.md         # 共通方針・A〜Dの位置付け
  assessment-architecture-decisions.md # 選択理由と試行結果
  strix/
    plan.md                       # A：試行順と完了条件
    spec.md                       # A：構成・導入・実行設計
  cairn/plan.md                    # B：候補計画
  hermes/plan.md                   # C：候補計画
  artex/
    plan.md                       # D：試行順と後段候補
    spec.md                       # D：WebUI起動から初回探索まで
```

各案の設計・手順が増えたら同じディレクトリへ置きます。複数案に共通する方針・判断は `docs/` 直下で管理し、同じ説明を各案へ複製しません。案別の入口はこのREADMEの文書一覧です。

実装コードは `src/`、テストは `tests/` に配置します。非秘密fixtureが必要になれば `assets/` を使います。raw結果・認証情報・取得したupstreamはGit対象外の `var/` に保存し、確認済みの要約と判断だけを文書から参照します。`AGENTS.md`と対象技術台帳は既存の配置を維持します。

## 文書の読み方

| 文書 | 役割 |
|---|---|
| [導入提案](docs/agentic-security-plan.md) | 目的、対象範囲、開始権限、A〜D案の位置付け、評価・採用基準を定める。共通方針の正本 |
| [A案：Strix PoC実行計画](docs/strix/plan.md) | 手動PoCの試行順、完了条件、結果から次の改善を選ぶ方法 |
| [A案：Strix PoC実行設計](docs/strix/spec.md) | モデル・導入・Skill、Juice Shopの起動・reset・評価、入力・出力・停止方法 |
| [B案：Cairn実行計画](docs/cairn/plan.md) | 状態を持つ業務フローや複数段階の探索で追加価値を測る工程 |
| [C案：Hermes＋Strix実行計画](docs/hermes/plan.md) | Hermesによる次の探索の選択・要約・知識の引継ぎが検知と人手に与える効果を測る工程 |
| [D案：ARTEX実行計画](docs/artex/plan.md) | 統合UI・探索状態・証拠管理の利点と、ビルド・DB・運用負荷を測る工程 |
| [D案：ARTEX実行設計](docs/artex/spec.md) | ComposeでUIを開き、モデル接続、Juice Shopへの1 task、証拠確認・停止を試す手順 |
| [構成判断記録](docs/assessment-architecture-decisions.md) | 各案を選択・継続・保留する理由、実際の試行条件と結果を残す正本 |
| [対象技術台帳](TARGET_TECH_STACK.md) | 対象技術の105項目。導入済み依存や検査済み項目の一覧ではない |
| [リポジトリ指針](AGENTS.md) | 将来のコード、テスト、設定、コミットに関する配置・作業上のルール |

最初に導入提案で目的と範囲を確認し、A案の計画で試行順、実行設計で具体的な構成と操作を確認します。D案もWebUIから短く試せるよう実行設計を用意しました。Aの完了をDの前提にせず、結果から次に変える1点を選びます。B・Cは比較候補として保持します。選択理由と未確認事項は構成判断記録にあります。各案の性能や継続運用への採用は、まだ実測していません。

## 最初のPoCで確認すること

初回対象は自前のJuice Shopとし、次の候補にcrAPI、切り分け用にDVWAを置きます。対象・許可操作・モデル・入力資料・予算を確定し、固定したツールを限定環境で起動します。agentの探索結果と原証拠を保存し、脆弱性領域ごとに「確認した内容」「該当しない根拠」「未確認の理由と次の検査」を残します。候補は人が独立して再現し、起動成功、検査範囲、検出の有効性を別々に判定します。

日次の自動化、反復比較、修正後の再検証は手動PoCの結果を見て進めます。モデルや資料の組合せを網羅的に比べることより、まず代表的な構成が対象に対してどのような結果を出すかを確認します。実際の対象、資格情報、版、予算、保存先は各案のP0〜P2で確定します。

手順・実測を更新するときは、該当案の実行設計と[構成判断記録](docs/assessment-architecture-decisions.md)へ反映します。
