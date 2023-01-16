import fs from 'fs'
import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import { isDev, port, r } from '../scripts/utils'
import { ext_id } from './config';

// Base on 'https://github.com/antfu/vitesse-webext/'
export function getManifest() {
  const raw_json = fs.readFileSync(r('package.json'));
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
      default_icon: './dist/assets/icon.svg',
      default_popup: './dist/popup.html',
    },
    options_ui: {
      page: './dist/options.html',
      // open_in_tab: true,
      browser_style: true,
    },
    background: {
      page: './dist/background.html',
      persistent: false,
    },
    icons: {
      512: './dist/assets/icon.svg',
    },
    permissions: [
      'tabs',
      'storage',
      'activeTab',
      "contentscripts",
      "<all_urls>",
      "scripting"
    ],
    content_scripts: [{
      // matches: ['http://*/*', 'https://*/*'],
      matches: ["<all_urls>"],
      js: ['dist/assets/content_script.js'],
      css: ['dist/assets/hho.style.css'],
    }],
    web_accessible_resources: [
      '/dist/assets/content_script.js',
      '/dist/assets/hho.style.css'
    ],
    browser_specific_settings: {
      gecko: {
        id: ext_id
      }
    },
  }

  if (isDev) {
    // for content script, as browsers will cache them for each reload,
    // we use a background script to always inject the latest version
    // see src/background/contentScriptHMR.ts
    // delete manifest.content_scripts
    // manifest.permissions?.push('webNavigation')

    // this is required on dev for Vite script to load
    manifest.content_security_policy = `script-src \'self\' http://localhost:${port}; object-src \'self\'`
  }

  return manifest
}
