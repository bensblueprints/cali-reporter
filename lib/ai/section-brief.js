import { JSDOM } from 'jsdom';
// Rebuild a minimal HTML fragment. Model/source content must not supply executable markup.
export function cleanSectionHtml(html, sourceUrl) {
  const document = new JSDOM(`<body>${html}</body>`).window.document;
  const allowed = new Set(['P','A']);
  for(const element of [...document.body.querySelectorAll('*')]) {
    if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(element.tagName)) {element.remove();continue;}
    if(!allowed.has(element.tagName)) {element.replaceWith(...element.childNodes);continue;}
    const href=element.getAttribute('href');
    for(const attr of [...element.attributes]) element.removeAttribute(attr.name);
    if(element.tagName==='A') {
      if(href===sourceUrl) {element.setAttribute('href',sourceUrl);element.setAttribute('rel','noopener');}
      else element.replaceWith(...element.childNodes);
    }
  }
  return document.body.innerHTML;
}
