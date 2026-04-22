import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import type { AwsProfile } from '@riftview/shared'

export type ValidateCredentialsResult =
  | { ok: true; account: string; arn: string }
  | { ok: false; error: string }

/** Validates AWS credentials via STS GetCallerIdentity.
 *  Mirrors the createClients credential logic so callers don't need
 *  @aws-sdk/client-sts as a direct dependency. */
export async function validateAwsCredentials(
  profile: AwsProfile
): Promise<ValidateCredentialsResult> {
  try {
    const endpointConfig = profile.endpoint ? { endpoint: profile.endpoint } : {}
    const credentialsConfig = profile.endpoint
      ? { credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }
      : {}
    process.env.AWS_PROFILE = profile.name
    const stsClient = new STSClient({
      region: profile.region ?? 'us-east-1',
      ...endpointConfig,
      ...credentialsConfig
    })
    const res = await stsClient.send(new GetCallerIdentityCommand({}))
    return { ok: true, account: res.Account ?? '', arn: res.Arn ?? '' }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
