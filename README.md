# 自律型エージェントによる継続的な脆弱性検知

このリポジトリは、自社の脆弱性をAIエージェントを使う攻撃者より早く検知するためのPoCと、その後の継続運用を計画する文書をまとめています。最初は対象を限定して実際にagentを動かし、探索した範囲、確認済みの問題、未確認箇所、所要時間と費用を記録します。

最初の目標は、代表的な構成でAIエージェントを動かし、脆弱性の探索結果を得ることです。Aを最初の診断PoCに選び、Dは並行してWebUIだけを試しました。B・Cはその結果を踏まえて試す候補です。選択理由と実測は[構成判断記録](docs/assessment-architecture-decisions.md)に残します。

| 案 | エージェントの役割 | 現在地 |
|---|---|---|
| [A：Strix](docs/strix/plan.md) | 自律探索と再現候補の作成 | 初回診断PoCに選択。計画・実行設計を作成、診断は未実施 |
| [B：Cairn](docs/cairn/plan.md) | 状態を持つ業務フローや多段階の探索 | 実行計画を作成、未試行 |
| [C：Hermes＋Strix](docs/hermes/plan.md) | 次の探索の選択と知識の引継ぎ | 実行計画を作成、未試行 |
| [D：ARTEX](docs/artex/plan.md) | 統合UIで探索状態と証拠を管理 | モデルなしWebUIの起動・ログイン・停止再開を確認。診断は未実施 |

モデル接続、脆弱性診断、日次実行の実績はまだありません。DのWebUI確認を検出能力の実績とは扱いません。

## 最初の診断PoCで確認すること

初回対象は自前のJuice Shopとし、次の候補にcrAPI、切り分け用にDVWAを置きます。対象・許可操作・モデル・入力資料・予算を確定し、固定したツールを限定環境で起動します。agentの探索結果と原証拠を保存し、脆弱性領域ごとに「確認した内容」「該当しない根拠」「未確認の理由と次の検査」を残します。候補は人が独立して再現し、起動成功、検査範囲、検出の有効性を別々に判定します。

日次の自動化、反復比較、修正後の再検証は手動PoCの結果を見て進めます。モデルや資料の組合せを網羅的に比べることより、まず代表的な構成が対象に対してどのような結果を出すかを確認します。実際の対象、資格情報、版、予算、保存先は各案のP0〜P2で確定します。

手順・実測を更新するときは、該当案の文書と[構成判断記録](docs/assessment-architecture-decisions.md)へ反映します。

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

最初に導入提案で目的と範囲を確認し、試す案の計画から詳細へ進みます。AとDには実行設計があり、BとCは実行計画までです。選択理由と未確認事項は構成判断記録にあります。各案の検出性能や継続運用への採用は、まだ実測していません。

## 現在動かせるもの：D案のWebUI

D案だけはモデルなしの画面確認用コードがあります。Linux／WSL2、Docker Engine＋Compose v2、Bash、curl、tar、sha256sum、OpenSSL、makeを使います。初期設定と統合テストにはNode.js 18以上、Chromium、jqが必要です。

```sh
make setup   # 固定ソース取得・照合、ローカルDBパスワード生成
make build   # upstream Dockerfileからビルド。ネット接続が必要
make up      # DBとWebUIを起動
make init    # 初回の管理者設定とブラウザ確認
make test    # ブラウザログイン・API・モデル未接続を確認
make status  # 稼働状態を確認
make lint    # Bash・Node構文とdiffの空白を確認
make stop    # 停止。データと鍵は保持
```

画面は `http://127.0.0.1:8787`、ユーザー名は `ARTEX` です。管理者パスワードは `var/artex/admin-password` に保存されます。今回のWSL2環境で必要だったビルド時の通信設定、パスワードの確認方法、公開範囲と実測結果は[D案の実行設計](docs/artex/spec.md#2-最初のチェックポイント画面を開く)を参照してください。この構成はWebUI確認用であり、診断対象・モデル・予算・通信境界は診断前に確定します。
