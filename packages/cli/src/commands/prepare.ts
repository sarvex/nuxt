import { promises as fsp } from 'fs'
import { relative, resolve } from 'upath'
import { cyan } from 'colorette'

import { requireModule, getModulePaths, getNearestPackage } from '../utils/cjs'
import { exists } from '../utils/fs'
import { success } from '../utils/log'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'prepare',
    usage: 'nu prepare',
    description: 'Prepare nuxt for development/build'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt } = requireModule('@nuxt/kit', rootDir) as typeof import('@nuxt/kit')
    const nuxt = await loadNuxt({ rootDir })

    const adHocModules = nuxt.options._majorVersion === 3
      ? ['@nuxt/kit', '@nuxt/app', '@nuxt/nitro']
      : ['@nuxt/kit']

    const types = [
      ...adHocModules,
      // Modules
      ...nuxt.options.buildModules,
      ...nuxt.options.modules,
      ...nuxt.options._modules
    ].filter(f => typeof f === 'string')

    const modulePaths = getModulePaths(nuxt.options.modulesDir)
    const _references = await Promise.all(types.map(async (id) => {
      const pkg = getNearestPackage(id, modulePaths)
      return pkg ? `/// <reference types="${pkg.name}" />` : await exists(id) && `/// <reference path="${id}" />`
    })).then(arr => arr.filter(Boolean))

    const references = Array.from(new Set(_references)) as string[]
    await nuxt.callHook('prepare:types', { references })

    const declarationPath = resolve(`${rootDir}/nuxt.d.ts`)

    const declaration = [
      '// Declarations auto generated by `nuxt prepare`. Please do not manually modify this file.',
      '',
      ...references,
      ''
    ].join('\n')

    await fsp.writeFile(declarationPath, declaration)

    success('Generated', cyan(relative(process.cwd(), declarationPath)))
  }
})