import './style.css'
import { name } from './index'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>${name}</h1>
    <p>Phase 1: Environment Setup & Asset Pipeline complete.</p>
    <p>Assets available at <code>/agents/Clippit/CLIPPIT.acd</code></p>
  </div>
`
