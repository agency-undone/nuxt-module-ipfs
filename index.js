/*
 *
 * 📦 [Module] NuxtModuleIpfs
 *
 */

// ///////////////////////////////////////////////////////////////////// Imports
// -----------------------------------------------------------------------------
// ///////////////////////////////////////////////////////////////////// General
import Path from 'path'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import Klaw from 'klaw'

// ///////////////////////////////////////////////////////////////////// Plugins
const MethodsPlugin = Path.resolve(__dirname, 'plugin.js')

// /////////////////////////////////////////////////////////////////// Functions
// -----------------------------------------------------------------------------
// ------------------------------------------------------------- registerPlugins
const registerPlugins = (instance, next) => {
  const plugins = {
    Methods: { src: MethodsPlugin, fileName: 'nuxt-module-ipfs/methods.js' }
  }
  Object.keys(plugins).map((key) => {
    const plugin = plugins[key]
    const dst = instance.addTemplate(plugin).dst
    instance.options.plugins.push({
      src: Path.join(instance.options.buildDir, dst),
      ssr: undefined,
      mode: plugin.mode
    })
  })
  if (next) { return next() }
}

// ------------------------------------------------------------------------ seds
const seds = (re, filepath, modifier) => {
  const original = readFileSync(filepath, 'utf8')
  const modified = original.replace(re, modifier)
  writeFileSync(filepath, modified)
  return modified
}

// ------------------------------------------------------------------ relativize
const relativize = (filepath) => {
  ([,filepath] = filepath.split('/dist/'))
  let prefix = []
  let length = filepath.split('/').length - 1
  for (let i = 0; i < length; i++) {
    prefix.push('..')
  }
  prefix = prefix.join('/') + '/'
  return (prefix === '/' || prefix === '') ? './' : prefix
}

// ------------------------------------------------------------------------ walk
const walk = (dir, ext) => {
  return new Promise((next) => {
    const matches = []
    Klaw(dir)
      .on('data', ({ path }) => {
        if (path && !path.includes('node_modules') && path.endsWith(ext)) {
          matches.push(path)
        }
      })
      .on('end', () => {
        next(matches)
      })
  })
}

// ------------------------------------------------------------ processHtmlFiles
const processHtmlFiles = async (generateRoot) => {
  const htmlFiles = await walk(generateRoot, '.html')
  for (const htmlFile of htmlFiles) {
    const prefix = relativize(htmlFile)
    seds(/basePath:"\/ipfs\/hash\/"/gm, htmlFile, (
      'basePath:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]:\'/\')'
    ))
    seds(/assetsPath:"\/_nuxt\/"/gm, htmlFile, (
      'assetsPath:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]:\'.\') + \'/_nuxt/\''
    ))
    seds(/staticAssetsBase:"(\/_nuxt\/static\/)([^"]+)/gm, htmlFile, (_, start, end) => {
     return `staticAssetsBase:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+/),(ipfsMatch?ipfsMatch[0]:'.'))+"\u002F_nuxt\u002Fstatic\u002F${end}`
    })
    seds(/<base href="\/ipfs\/hash\/">/, htmlFile, true ? '' : (
      '<script>\n' +
      'base = document.createElement(\'base\')\n' +
      'base.href = (ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+/),(ipfsMatch?ipfsMatch[0]+\'/\':\'/\'))\n' +
      'document.getElementsByTagName(\'head\')[0].appendChild(base)\n' +
      '</script>'
    ))
    seds(/"\/ipfs\/hash\//gms, htmlFile, `"${prefix}`)
    seds(/".\/images\//gms, htmlFile, `"${prefix}images/`)
    seds(/"\/favicon\//gms, htmlFile, `"${prefix}favicon/`)
    seds(/url\(\/ipfs\/hash\//gms, htmlFile, `url(${prefix}`)
  }
}

// -------------------------------------------------------------- processJsFiles
const processJsFiles = async (generateRoot) => {
  const nuxtRoot = Path.join(generateRoot, '_nuxt')
  const jsFiles = await walk(nuxtRoot, '.js')
  for (const jsFile of jsFiles) {
    seds(/"\/ipfs\/hash\/_nuxt\/\"/, jsFile, (
      '(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]+\'\/_nuxt\/\':\'\/_nuxt\/\')'
    ))
    seds(/base: '\/ipfs\/hash\/'/gm, jsFile, (
      'base:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]:\'/\')'
    ))
    seds(/(staticAssetsBase:"\\u002Fipfs\\u002Fhash\\u002F_nuxt\\u002Fstatic\\u002F)([^"]+)/gm, jsFile, (_, start, end) => {
     return `staticAssetsBase:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+/),(ipfsMatch?ipfsMatch[0]:''))+"/_nuxt\u002Fstatic\u002F${end}`
    })
    seds(/basePath:"\\u002Fipfs\\u002Fhash\\u002F"/gm, jsFile, (
      'basePath:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]:\'/\')'
    ))
    seds(/assetsPath:"\\u002Fipfs\\u002Fhash\\u002F_nuxt\\u002F"/gm, jsFile, (
      'assetsPath:(ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]:\'.\') + \'/_nuxt/\''
    ))
    seds(/return __webpack_require__\.p/gm, jsFile, (
      'return __webpack_require__.p.replace(\'./\', (ipfsMatch=window.location.pathname.match(/\\/ip[fn]s\\/[^/]+\\//), ipfsMatch?ipfsMatch[0]+\'/\':\'/\'))'
    ))
  }
}

// -------------------------------------------------------------------- addHooks
const addHooks = async (instance) => {
  instance.nuxt.hook('generate:done', async () => {
    const { dir: generateRoot } = instance.options.generate
    await processHtmlFiles(generateRoot)
    await processJsFiles(generateRoot)
  })
}

// ////////////////////////////////////////////////////////////////// Initialize
// -----------------------------------------------------------------------------
function NuxtModuleIpfs () {
  if (process.server) {
    console.log(`📦 [Module] NuxtModuleIpfs`)
  }
  registerPlugins(this, () => {
    if (process.env.NODE_ENV !== 'development') {
      addHooks(this)
    }
  })
}

// ////////////////////////////////////////////////////////////////////// Export
// -----------------------------------------------------------------------------
export default NuxtModuleIpfs
