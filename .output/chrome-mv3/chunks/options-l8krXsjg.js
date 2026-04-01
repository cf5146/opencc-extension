import{d as u,A as d,y as h,w as a,q as f,u as e,J as w}from"./storage-5FDq238w.js";const g=500;function v(){const[c,i]=u(""),t=d(void 0);h(()=>{a.getValue().then(n=>{i(n.map(l=>l.replaceAll("[^ ]*","*")).join(`
`))})},[]);const s=f(n=>{const o=n.currentTarget.value.split(`
`).map(r=>r.trim()).join(`
`);i(o),t.current&&clearTimeout(t.current),t.current=globalThis.setTimeout(()=>{const m=o.trim().split(`
`).filter(Boolean).map(p=>p.replaceAll("*","[^ ]*"));a.setValue(m)},g)},[]);return e("main",{children:[e("label",{for:"whitelist",children:"Whitelist"}),e("p",{children:"Specify the URL patterns of sites that you want to be excluded from converting in auto mode."}),e("textarea",{id:"whitelist",placeholder:"https://*.example.com/*",spellcheck:!1,value:c,onInput:s})]})}w(e(v,{}),document.getElementById("app"));
