import assert from 'node:assert/strict'
import {cropGeometry,cropRect,resizeCrop,validCrop,defaultCrop} from '../src/lib/image-crop.ts'
assert.ok(validCrop(defaultCrop));assert.ok(!validCrop({...defaultCrop,zoom:0}));assert.ok(!validCrop({...defaultCrop,ratio:0}));assert.ok(!validCrop({...defaultCrop,rotation:37}))
for(const [iw,ih] of [[400,1200],[1200,400],[800,800],[1600,900]])for(const ratio of [3,16/9,1,2.43])for(const zoom of [1,1.5,3])for(const x of [-1,0,1])for(const y of [-1,0,1]){
 const settings={zoom,x,y,ratio},width=1200,height=width/ratio,g=cropGeometry(iw,ih,width,height,settings),r=cropRect(iw,ih,settings)
 assert.ok(r.left>=-1e-8&&r.top>=-1e-8&&r.left+r.width<=iw+1e-8&&r.top+r.height<=ih+1e-8)
 assert.ok(Math.abs(r.width/r.height-ratio)<1e-8)
 assert.ok(Math.abs(r.left-((iw-width/g.scale)/2-x*g.maxX/g.scale))<1e-8)
 for(const delta of [-1e6,-50,0,50,1e6]){
  const next=resizeCrop(iw,ih,settings,r.width+delta),nr=cropRect(iw,ih,next)
  assert.ok(next.zoom>=1-1e-8&&next.zoom<=3+1e-8)
  assert.ok(Math.abs(nr.left-r.left)<1e-8&&Math.abs(nr.top-r.top)<1e-8,'Resize anchors the opposite corner')
  assert.ok(nr.left+nr.width<=iw+1e-8&&nr.top+nr.height<=ih+1e-8)
 }
}
console.log('PASS: fixed-ratio crop, source bounds, anchored resizing and legacy rotation rejection.')
