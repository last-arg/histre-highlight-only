import fs from 'fs'
import { getManifest } from '../src/manifest'
import { r } from './utils'

export async function writeManifest() {
  const content = JSON.stringify(await getManifest(), null, 2);
  await fs.promises.writeFile(r('extension/manifest.json'), content)
  console.log('PRE', 'write manifest.json')
}

writeManifest()
