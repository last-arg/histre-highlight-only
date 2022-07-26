import fs from 'fs'
import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import { isDev, port, r } from '../scripts/utils'

export async function getManifest() {
  const raw_json = await fs.promises.readFile(r('package.json'));
  let buf = raw_json; 
  // Make it work with 'bun run'
  if (!Buffer.isBuffer(raw_json)) {
    buf = Buffer.from(raw_json);
  }
  const pkg = JSON.parse(buf.toString('utf-8')) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 2,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    browser_action: {
      // TODO: icon-512
      default_icon: './assets/icon-48.png',
      default_popup: './dist/popup.html',
    },
    options_ui: {
      page: './dist/options.html',
      open_in_tab: true,
      chrome_style: false,
    },
    background: {
      page: './dist/background.html',
      persistent: false,
    },
    icons: {
      // TODO: add more icons size?
      48: './assets/icon-48.png',
    },
    permissions: [
      'tabs',
      'storage',
      'activeTab',
      'http://*/',
      'https://*/',
    ],
    content_scripts: [{
      matches: ['http://*/*', 'https://*/*'],
      js: ['./dist/assets/content_script.js'],
    }],
    web_accessible_resources: [
      './dist/assets/content_script.js'
    ],
    browser_specific_settings: {
      gecko: {
        id: "addon@histre-highlight-only.com"
      }
    },
  }

  if (isDev) {
    // for content script, as browsers will cache them for each reload,
    // we use a background script to always inject the latest version
    // see src/background/contentScriptHMR.ts
    delete manifest.content_scripts
    manifest.permissions?.push('webNavigation')

    // this is required on dev for Vite script to load
    manifest.content_security_policy = `script-src \'self\' http://localhost:${port}; object-src \'self\'`
  }

  return manifest
}