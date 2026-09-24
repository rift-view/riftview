import { describe, expect, it } from 'vitest'
import { isAppNavigation } from '../../../src/main/security/navigation'

const FILE_APP =
  'file:///Applications/RiftView.app/Contents/Resources/app.asar/out/renderer/index.html'
const DEV_APP = 'http://localhost:5173'

describe('isAppNavigation (RIFT-146)', () => {
  describe('packaged app (file:// renderer)', () => {
    it.each([FILE_APP, `${FILE_APP}#/route`, `${FILE_APP}?reload=1`])('allows %s', (target) => {
      expect(isAppNavigation(target, FILE_APP)).toBe(true)
    })

    it.each([
      'file:///Applications/RiftView.app/Contents/Resources/app.asar/out/renderer/other.html',
      'file:///etc/passwd',
      'file:///Users/me/Downloads/dropped.html',
      'https://console.aws.amazon.com/',
      'http://localhost:5173/',
      'javascript:alert(1)',
      'about:blank',
      'not a url',
      ''
    ])('refuses %s', (target) => {
      expect(isAppNavigation(target, FILE_APP)).toBe(false)
    })
  })

  describe('electron-vite dev server (http renderer)', () => {
    it.each([DEV_APP, `${DEV_APP}/`, `${DEV_APP}/?t=123`, `${DEV_APP}/#hash`])(
      'allows %s',
      (target) => {
        expect(isAppNavigation(target, DEV_APP)).toBe(true)
      }
    )

    it.each([
      `${DEV_APP}/other`,
      'http://localhost:5174/',
      'https://localhost:5173/',
      'http://evil.example/',
      'http://localhost.evil.example:5173/',
      FILE_APP
    ])('refuses %s', (target) => {
      expect(isAppNavigation(target, DEV_APP)).toBe(false)
    })
  })

  it('refuses when the app URL itself is malformed', () => {
    expect(isAppNavigation(FILE_APP, 'not a url')).toBe(false)
  })
})
