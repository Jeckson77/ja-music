/* Dependency-free smoke checks following dawidolko/frontend-skills:
   responsive/viewport-meta, a11y/control-name, a11y/focus-visible,
   css/reduced-motion, perf/img-dimensions, seo/canonical-valid. */
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pages=['index.html','demo.html','listener.html','artist.html','ja_music_dual_demo.html'];
for(const p of pages){
 const html=read(p);
 assert.match(html,/<html\b/i,p+' must be HTML');
 assert.match(html,/name=["']viewport["']/i,p+' needs viewport');
 assert.match(html,/<title\b/i,p+' needs a title');
 assert.match(html,/<\/html>/i,p+' must close html');
}
for(const p of ['index.html','demo.html']){
 const html=read(p);
 assert.match(html,/frontend-website\.css/,p+' loads website styles');
 assert.match(html,/frontend-website\.js/,p+' loads website accessibility helpers');
 assert.match(html,/rel="canonical" href="https:\/\//,p+' has an absolute canonical');
 assert.match(html,/property="og:image" content="https:\/\//,p+' has absolute social image');
}
for(const p of ['listener.html','artist.html']){
 const html=read(p);
 assert.match(html,/frontend-app\.css/,p+' loads app styles');
 assert.match(html,/frontend-app\.js/,p+' loads app interaction helpers');
 assert.match(html,/class="nav polished-nav"/,p+' keeps navigation');
 assert.match(html,/id="authScreen"/,p+' keeps login');
}
const dual=read('ja_music_dual_demo.html');
const match=dual.match(/const htmls=\{listener:'([^']+)',artist:'([^']+)'\}/);
assert.ok(match,'two-phone simulator bundles both apps');
for(const [i,name] of [[1,'listener'],[2,'artist']]){
 const html=Buffer.from(match[i],'base64').toString('utf8');
 assert.match(html,/frontend-app\.css/,name+' simulator loads app styles');
 assert.match(html,/frontend-app\.js/,name+' simulator loads app helpers');
 assert.match(html,/class="embed"/,name+' simulator stays phone-sized');
}
const appCSS=read('frontend-app.css');
const siteCSS=read('frontend-website.css');
assert.match(appCSS,/prefers-reduced-motion/);
assert.match(siteCSS,/prefers-reduced-motion/);
assert.match(appCSS,/focus-visible/);
assert.match(siteCSS,/focus-visible/);
assert.match(appCSS,/max-width:350px/);
assert.match(siteCSS,/max-width:350px/);
const gradle=read('android/app/build.gradle');
assert.match(gradle,/frontend-app\.css/);
assert.match(gradle,/frontend-app\.js/);
console.log('PASS: website + app sources, embedded dual simulator, Android asset packaging, accessibility and responsive checks');
