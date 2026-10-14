import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import iconFont from '@fontsource-variable/material-symbols-outlined/files/material-symbols-outlined-latin-fill-normal.woff2?url'

// Workaround: bref-ui 2.0.1's Theme points its icon @font-face at a bare package
// path that Vite only resolves in `build`, so icons render as text under `dev`.
if (import.meta.env.DEV) {
  const face = new FontFace('Material Symbols Outlined', `url(${iconFont})`, { weight: '100 700' })
  document.fonts.add(face)
  face.load()
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
