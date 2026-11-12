// Node ESM loader: map Next's '@/...' alias to this repo's lib/ so unit
// tests can import server modules (lib/groq.js) directly.
import { pathToFileURL } from 'url'

const ROOT = '/home/z/my-project/kivora/'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let target = specifier.replace('@/', ROOT)
    if (!/\.[cm]?js$/.test(target)) target += '.js'
    return nextResolve(pathToFileURL(target).href, context)
  }
  return nextResolve(specifier, context)
}
