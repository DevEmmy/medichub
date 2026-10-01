import{c as d}from"./index-ndODmPgh.js";/**
 * @license lucide-react v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i={name:"navigation",size:24,node:[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]]};i.node;const g=d(i);function u(t,a){const n=c=>c*Math.PI/180,s=n(a.lat-t.lat),e=n(a.lng-t.lng),r=Math.sin(s/2)**2+Math.cos(n(t.lat))*Math.cos(n(a.lat))*Math.sin(e/2)**2;return 2*6371*Math.asin(Math.sqrt(r))}function h(t){return t<1?`${Math.round(t*1e3)} m`:t<20?`${t.toFixed(1)} km`:`${Math.round(t)} km`}function M(t,a,o){const n=o?`&origin=${o.lat},${o.lng}`:"";return`https://www.google.com/maps/dir/?api=1&destination=${t},${a}${n}&travelmode=driving`}export{g as N,M as a,u as d,h as f};
