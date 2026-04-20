// src/main/plugin/index.ts
import { pluginRegistry } from './registry'
import { awsPlugin } from './awsPlugin'

pluginRegistry.register(awsPlugin)

export { pluginRegistry }
