import { confirm, message } from '@tauri-apps/plugin-dialog';
import type { PublishResult } from '../hooks/usePublish';
import './FileHeader.css';

interface FileHeaderProps {
  fileName: string;
  onDelete: () => void;
  // --- 公開（設定の公開コマンドを実行）---
  publishConfigured: boolean;
  publishBusy: boolean;
  onPublish: () => Promise<PublishResult>;
}

/**
 * 右上のファイル名表示 + ホバーで出る属性メニュー。
 *
 * - 通常時はファイル名だけ表示
 * - ホバー時はファイル名を含む同じカード内に属性トグル・公開操作が下に展開する。
 *   ファイル名とメニューを別要素にすると隙間でホバーが切れるので、
 *   ひとつのカードを膨らませる構造にしている。
 */
export default function FileHeader({
  fileName,
  onDelete,
  publishConfigured,
  publishBusy,
  onPublish,
}: FileHeaderProps) {
  const handleDelete = async () => {
    const ok = await confirm(`${fileName.replace(/\.md$/, '')} を削除しますか？`, {
      title: 'ファイルを削除',
      kind: 'warning',
      okLabel: '削除',
      cancelLabel: 'キャンセル',
    });
    if (ok) onDelete();
  };

  const handlePublish = async () => {
    const res = await onPublish();
    // コマンドの実行結果をダイアログで見せる（成功時は出力、失敗時はエラー全文）。
    await message(res.output || (res.ok ? '完了しました。' : '失敗しました。'), {
      title: res.ok ? '公開しました' : '公開に失敗しました',
      kind: res.ok ? 'info' : 'error',
    });
  };

  return (
    <div className="file-header">
      <div className="file-header-card">
        <div className="file-header-card-name">
          <span className="file-header-name">{fileName.replace(/\.md$/, '')}</span>
        </div>

        {publishConfigured && (
          <div className="file-header-publish">
            <button
              type="button"
              className="file-header-publish-btn"
              onClick={handlePublish}
              disabled={publishBusy}
            >
              {publishBusy ? '公開中…' : '公開'}
            </button>
          </div>
        )}

        <button
          type="button"
          className="file-header-card-row file-header-delete"
          onClick={handleDelete}
        >
          <span className="file-header-menu-label">Delete</span>
        </button>
      </div>
    </div>
  );
}
