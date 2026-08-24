import { useState } from "react";
import { useCharacters } from "./useCharacters";

const PLACEHOLDER =
  '[{"name": "キャラ名", "server": "鯖名", "job": "職業", "level": 99, "jobLevel": 50}]';

function readLevel(x: Record<string, unknown>): number | undefined {
  const raw = x.level ?? x.lv;
  const n = Number(raw);
  return typeof raw !== "undefined" && !Number.isNaN(n) ? n : undefined;
}

function readJobLevel(x: Record<string, unknown>): number | undefined {
  const raw = x.jobLevel ?? x.jlv;
  const n = Number(raw);
  return typeof raw !== "undefined" && !Number.isNaN(n) ? n : undefined;
}

export function CharacterBulkImport() {
  const { bulkUpsertCharacters } = useCharacters();
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleImport() {
    setError("");
    setMessage("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("JSON形式が正しくありません。");
      return;
    }
    if (!Array.isArray(parsed)) {
      setError("JSON配列の形式で入力してください。");
      return;
    }
    const inputs = parsed
      .filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null,
      )
      .map((x) => ({
        name: typeof x.name === "string" ? x.name : "",
        server: typeof x.server === "string" ? x.server : undefined,
        account: typeof x.account === "string" ? x.account : undefined,
        job: typeof x.job === "string" ? x.job : undefined,
        level: readLevel(x),
        jobLevel: readJobLevel(x),
        memo: typeof x.memo === "string" ? x.memo : undefined,
      }));
    const count = await bulkUpsertCharacters(inputs);
    setMessage(`${count}件を登録しました。`);
    setText("");
  }

  return (
    <details className="panel">
      <summary>JSON一括登録</summary>
      <p className="hint">
        配列形式のJSONを貼り付けると複数キャラをまとめて登録できます。対応
        フィールドは <code>name</code>（必須）・<code>server</code>・
        <code>account</code>・<code>job</code>・<code>level</code>（
        <code>lv</code>という名前でも可）・<code>jobLevel</code>（
        <code>jlv</code>という名前でも可）・<code>memo</code>（すべて省略可）。
        すでに同じ名前・サーバーのキャラがいる場合は新規追加ではなく上書き
        更新されます（並び順は保持されたまま）。
      </p>
      <p className="hint">
        手打ちする必要はありません。ゲーム内でキャラクター情報が見える画面
        （キャラクター選択画面や所属キャラ一覧など）のスクリーンショットを
        撮り、Claude等のAIチャットに画像を渡して「この画像のキャラクター
        情報を読み取って、下記フォーマットのJSON配列にして」と依頼すると、
        AIが画像から名前・サーバー・職業・Lvなどを読み取ってJSONを生成して
        くれます。それをそのまま下の欄に貼り付ければ完了です。
        <br />
        フォーマット例:{" "}
        <code>
          {
            '[{"name":"キャラ名","server":"鯖名","account":"アカウント名","job":"職業","level":99,"jobLevel":50,"memo":"メモ"}]'
          }
        </code>
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-message">{message}</p>}
      <textarea
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", height: "6rem" }}
      />
      <div className="form-actions" style={{ marginTop: "0.5rem" }}>
        <button type="button" onClick={handleImport}>
          一括登録実行
        </button>
      </div>
    </details>
  );
}
