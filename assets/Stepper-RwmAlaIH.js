import{c as l,j as e}from"./index-BcjHzdz8.js";import{P as c}from"./plus-CC44pjMo.js";/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r={name:"minus",size:24,node:[["path",{d:"M5 12h14",key:"1ays0h"}]]};r.node;const d=l(r);function p({value:t,onChange:s,min:a=0,max:o=999,label:i,disabled:n}){return e.jsxs("div",{className:"inline-flex items-center rounded-xl bg-white ring-1 ring-line",role:"group","aria-label":i,children:[e.jsx("button",{type:"button",disabled:n||t<=a,onClick:()=>s(t-1),className:"grid h-10 w-10 place-items-center rounded-l-xl text-slate-600 hover:bg-mist disabled:opacity-30","aria-label":`Decrease ${i}`,children:e.jsx(d,{size:16})}),e.jsx("span",{className:"min-w-[2.5rem] text-center font-display text-[16px] font-semibold text-ink tabular","aria-live":"polite",children:t}),e.jsx("button",{type:"button",disabled:n||t>=o,onClick:()=>s(t+1),className:"grid h-10 w-10 place-items-center rounded-r-xl text-slate-600 hover:bg-mist disabled:opacity-30","aria-label":`Increase ${i}`,children:e.jsx(c,{size:16})})]})}export{p as S};
