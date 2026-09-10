import { unzipSync, strFromU8 } from 'fflate'

/**
 * kintone プラグインの zip を読んで、中の情報を取り出します。
 *
 * kintone のプラグイン zip は二重構造になっています。
 *   プラグイン.zip
 *     ├── contents.zip   ← manifest.json やアイコンはこの中
 *     ├── PUBKEY
 *     └── SIGNATURE
 */
export async function readPluginZip(file) {
  const outer = unzipSync(new Uint8Array(await file.arrayBuffer()))

  const contents = outer['contents.zip']
  if (!contents) {
    throw new Error('kintone プラグインの zip ではないようです（contents.zip が見つかりません）。')
  }

  const inner = unzipSync(contents)
  const manifestRaw = inner['manifest.json']
  if (!manifestRaw) {
    throw new Error('contents.zip の中に manifest.json が見つかりません。')
  }

  let manifest
  try {
    manifest = JSON.parse(strFromU8(manifestRaw))
  } catch {
    throw new Error('manifest.json を読み取れませんでした。')
  }

  // アイコン画像（manifest の icon に書かれたパス）を取り出す
  let iconBlob = null
  let iconName = null
  if (manifest.icon && inner[manifest.icon]) {
    iconName = manifest.icon.split('/').pop()
    iconBlob = new File([inner[manifest.icon]], iconName, { type: guessImageType(iconName) })
  }

  const nameJa = manifest.name?.ja || manifest.name?.en || file.name.replace(/\.zip$/i, '')
  const descJa = manifest.description?.ja || manifest.description?.en || ''

  return {
    name: nameJa,
    nameEn: manifest.name?.en || '',
    summary: firstSentence(descJa),
    description: descJa,
    version: String(manifest.version ?? '1'),
    slug: toSlug(manifest.name?.en || nameJa),
    iconFile: iconBlob,
  }
}

/** 説明文の1文目を「1行説明」として使う */
function firstSentence(text) {
  if (!text) return ''
  const cut = text.split(/(?<=。)/)[0] ?? text
  return cut.length > 120 ? `${cut.slice(0, 117)}…` : cut
}

/**
 * 英語名から URL 用の slug を作ります。
 * 日本語しか無い場合は空を返すので、画面で手入力してもらいます。
 */
function toSlug(source) {
  const slug = String(source)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || ''
}

function guessImageType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'gif') return 'image/gif'
  return 'application/octet-stream'
}
