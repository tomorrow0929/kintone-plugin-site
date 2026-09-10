import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/increment-download'
import type { Schema } from '../../data/resource'

// AppSync の接続先は Amplify が環境変数として渡してくれる
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()

export const handler: Schema['incrementDownloadCount']['functionHandler'] = async (event) => {
  const { pluginId } = event.arguments

  const { data: plugin } = await client.models.Plugin.get({ id: pluginId })
  if (!plugin) return 0

  const next = (plugin.downloadCount ?? 0) + 1
  await client.models.Plugin.update({ id: pluginId, downloadCount: next })

  return next
}
