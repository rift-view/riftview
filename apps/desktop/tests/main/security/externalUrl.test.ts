import { describe, expect, it } from 'vitest'
import { NODE_TYPES, type CloudNode } from '@riftview/shared'
import { isAllowedExternalUrl } from '../../../src/main/security/externalUrl'
import { buildConsoleUrl } from '../../../src/renderer/utils/buildConsoleUrl'

describe('isAllowedExternalUrl (RIFT-146)', () => {
  describe('allows AWS console hosts', () => {
    it.each([
      'https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#Instances:instanceId=i-0abc',
      'https://console.aws.amazon.com/',
      'https://console.aws.amazon.com',
      'https://s3.console.aws.amazon.com/s3/buckets/my-bucket',
      'https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1',
      'https://eu-central-1.console.aws.amazon.com/lambda/home?region=eu-central-1#/functions/fn',
      'https://ap-southeast-2.console.aws.amazon.com/vpc/home',
      'HTTPS://CONSOLE.AWS.AMAZON.COM/ec2/v2/home',
      'https://console.aws.amazon.com:443/rds/home'
    ])('%s', (url) => {
      expect(isAllowedExternalUrl(url)).toBe(true)
    })
  })

  it('allows every URL buildConsoleUrl can generate, and those use only the documented hosts', () => {
    const generated = NODE_TYPES.map((type) =>
      buildConsoleUrl({
        id: 'arn:aws:svc:us-east-1:123456789012:thing/abc-123',
        type,
        label: 'my label/with spaces & symbols',
        status: 'running',
        region: 'us-east-1',
        metadata: { clusterName: 'cluster one' }
      } as CloudNode)
    ).filter((url): url is string => url !== null)

    expect(generated.length).toBeGreaterThan(0)
    for (const url of generated) {
      expect(isAllowedExternalUrl(url), url).toBe(true)
    }
    // Keep the allow-list's comment honest: if buildConsoleUrl grows a new
    // host, this pins it so the list in externalUrl.ts gets revisited.
    const hosts = [...new Set(generated.map((url) => new URL(url).hostname))].sort()
    expect(hosts).toEqual(['console.aws.amazon.com', 's3.console.aws.amazon.com'])
  })

  describe('rejects', () => {
    it.each([
      ['http instead of https', 'http://console.aws.amazon.com/ec2/v2/home'],
      ['javascript: scheme', 'javascript:alert(1)'],
      ['file: scheme', 'file:///etc/passwd'],
      ['data: scheme', 'data:text/html,<script>alert(1)</script>'],
      ['about:blank', 'about:blank'],
      ['userinfo trick (console host as username)', 'https://console.aws.amazon.com@evil.example/'],
      ['userinfo trick with password', 'https://console.aws.amazon.com:x@evil.example/'],
      ['credentials on the real host', 'https://user:pw@console.aws.amazon.com/'],
      [
        'console host as a subdomain of another domain',
        'https://console.aws.amazon.com.evil.example/'
      ],
      ['console host as a path', 'https://evil.example/console.aws.amazon.com/'],
      ['console host in the query', 'https://evil.example/?next=https://console.aws.amazon.com/'],
      ['console host in the fragment', 'https://evil.example/#https://console.aws.amazon.com/'],
      ['host that merely ends with the console host', 'https://evilconsole.aws.amazon.com/'],
      ['parent domain', 'https://aws.amazon.com/console/'],
      ['sibling AWS domain', 'https://signin.aws.amazon.com/'],
      ['non-default port', 'https://console.aws.amazon.com:8443/'],
      ['trailing-dot FQDN', 'https://console.aws.amazon.com./'],
      ['empty string', ''],
      ['bare host, no scheme', 'console.aws.amazon.com/ec2'],
      ['scheme-relative', '//console.aws.amazon.com/ec2']
    ])('%s: %s', (_label, url) => {
      expect(isAllowedExternalUrl(url)).toBe(false)
    })

    it('non-string input', () => {
      for (const bad of [undefined, null, 42, {}, ['https://console.aws.amazon.com/']]) {
        expect(isAllowedExternalUrl(bad as unknown as string)).toBe(false)
      }
    })
  })
})
