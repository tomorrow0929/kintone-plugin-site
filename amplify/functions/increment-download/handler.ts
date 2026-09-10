import type { Schema } from '../../data/resource'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))

/**
 * Plugin テーブルの downloadCount を 1 増やして、増えた後の値を返します。
 * テーブル名は Amplify が環境変数として渡してくれます。
 */
export const handler: Schema['incrementDownloadCount']['functionHandler'] = async (event) => {
  const tableName = process.env.PLUGIN_TABLE_NAME
  if (!tableName) throw new Error('PLUGIN_TABLE_NAME is not set')

  const result = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id: event.arguments.pluginId },
      UpdateExpression: 'SET downloadCount = if_not_exists(downloadCount, :zero) + :one',
      ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
      ReturnValues: 'UPDATED_NEW',
      // 存在しないIDで新規レコードが作られてしまわないようにする
      ConditionExpression: 'attribute_exists(id)',
    }),
  )

  return Number(result.Attributes?.downloadCount ?? 0)
}
