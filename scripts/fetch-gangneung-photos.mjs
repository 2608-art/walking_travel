import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = fs.realpathSync('.');
const photosDir = path.join(root,'public','assets','photos');
const context = {window:{}};
vm.createContext(context);
for (const file of ['public/place-media.js','public/gangneung-media.js','public/gangneung-media-expansion.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const media = {...context.window.HANGEORUM_PLACE_MEDIA,...context.window.HANGEORUM_PLACE_EXAMPLE_MEDIA};
const assets = new Map();
for (const [id,item] of Object.entries(media)) {
  if (!/^g\d+$/.test(id) || !item.src.startsWith('./assets/photos/gangneung-')) continue;
  const filename = path.basename(item.src);
  if (assets.has(filename) && assets.get(filename).source !== item.source) throw Error(`Source conflict: ${filename}`);
  assets.set(filename,item);
}

const headers = {'User-Agent':'HangeoreumPhotoAudit/1.0 (local travel app photo attribution)'};
const errors = [];
for (const [filename,item] of assets) {
  const output = path.join(photosDir,filename);
  if (fs.existsSync(output)) { console.log(`Exists ${filename}`); continue; }
  try {
    if (!item.source.startsWith('https://commons.wikimedia.org/wiki/File:')) throw Error('Not a Commons file page');
    const pageResponse = await fetch(item.source,{headers});
    if (!pageResponse.ok) throw Error(`File page HTTP ${pageResponse.status}`);
    const html = await pageResponse.text();
    if (!html.includes(item.licenseUrl.replace(/\/$/,''))) throw Error('Declared license link missing on file page');
    const match = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (!match) throw Error('No Commons thumbnail found');
    const imageUrl = match[1].replaceAll('&amp;','&');
    if (!new URL(imageUrl).hostname.endsWith('wikimedia.org')) throw Error('Unexpected image host');
    const imageResponse = await fetch(imageUrl,{headers});
    if (!imageResponse.ok) throw Error(`Image HTTP ${imageResponse.status}`);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (imageResponse.headers.get('content-type')?.split(';')[0] !== 'image/jpeg' || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length < 10000) throw Error('Not a valid JPEG thumbnail');
    fs.writeFileSync(output,bytes,{flag:'wx'});
    console.log(`Saved ${filename} (${bytes.length} bytes)`);
    await new Promise(resolve=>setTimeout(resolve,180));
  } catch (error) {
    errors.push(`${filename}: ${error.message}`);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
}
