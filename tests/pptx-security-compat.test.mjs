import test from 'node:test'
import assert from 'node:assert/strict'
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'

test('patched image-size dependency preserves text and embedded image presentation export',async()=>{
 const deck=new PptxGenJS(),slide=deck.addSlide()
 slide.addText('CreatorOps verified export',{x:1,y:1,w:5,h:1})
 slide.addImage({data:'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j48sAAAAASUVORK5CYII=',x:1,y:2,w:1,h:1})
 const bytes=await deck.write({outputType:'nodebuffer'}),zip=await JSZip.loadAsync(bytes)
 assert.match(await zip.file('ppt/slides/slide1.xml').async('string'),/CreatorOps verified export/)
 assert.ok(Object.keys(zip.files).some(name=>name.startsWith('ppt/media/')&&name.endsWith('.png')))
})
