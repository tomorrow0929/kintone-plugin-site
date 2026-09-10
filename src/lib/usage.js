/**
 * 使い方データ（Plugin.usage）の形をそろえるための道具。
 *
 * DB には json で入っているので、中身が空だったり古い形だったりしても
 * 画面が落ちないよう、読み込むときに必ずここを通す。
 */

export const EMPTY_USAGE = { intro: '', steps: [], notes: '' }

/** DBから読んだ値を、扱いやすい形にそろえる */
export function normalizeUsage(raw) {
  if (!raw) return { ...EMPTY_USAGE }

  // json フィールドは文字列で返ってくることがある
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return { ...EMPTY_USAGE }
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_USAGE }

  return {
    intro: typeof value.intro === 'string' ? value.intro : '',
    notes: typeof value.notes === 'string' ? value.notes : '',
    steps: Array.isArray(value.steps)
      ? value.steps.map((step, i) => ({
          id: step?.id ?? `step-${i}`,
          title: typeof step?.title === 'string' ? step.title : '',
          body: typeof step?.body === 'string' ? step.body : '',
          imageKey: typeof step?.imageKey === 'string' ? step.imageKey : null,
          imageCaption: typeof step?.imageCaption === 'string' ? step.imageCaption : '',
        }))
      : [],
  }
}

/** 中身が空（＝詳細ページに「使い方」を出さない）かどうか */
export function isUsageEmpty(usage) {
  if (!usage) return true
  const hasStep = usage.steps?.some(
    (s) => s.title.trim() || s.body.trim() || s.imageKey,
  )
  return !usage.intro.trim() && !usage.notes.trim() && !hasStep
}

/** 空の手順を1つ作る */
export function createStep() {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    body: '',
    imageKey: null,
    imageCaption: '',
  }
}

/**
 * DB に保存できる形（JSON文字列）にする。
 *
 * a.json() は AppSync の AWSJSON 型になり、
 * 「JSONとして解釈できる文字列」しか受け付けない。
 * オブジェクトのまま渡すと
 *   Variable 'usage' has an invalid value.
 * で保存に失敗する。
 */
export function toStoredUsage(usage) {
  return JSON.stringify(serializeUsage(usage))
}

/** 保存用に整える（空の手順は落とす） */
export function serializeUsage(usage) {
  return {
    intro: usage.intro.trim(),
    notes: usage.notes.trim(),
    steps: usage.steps
      .filter((s) => s.title.trim() || s.body.trim() || s.imageKey)
      .map((s) => ({
        id: s.id,
        title: s.title.trim(),
        body: s.body.trim(),
        imageKey: s.imageKey ?? null,
        imageCaption: s.imageCaption.trim(),
      })),
  }
}

/** 使い方で使っている画像キーを全部集める */
export function collectImageKeys(usage) {
  return (usage?.steps ?? []).map((s) => s.imageKey).filter(Boolean)
}
