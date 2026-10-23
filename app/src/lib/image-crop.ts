export type CropSettings = { zoom:number; x:number; y:number; ratio:number }
export const defaultCrop: CropSettings = {zoom:1,x:0,y:0,ratio:3}
export function cropGeometry(imageWidth:number,imageHeight:number,width:number,height:number,settings:CropSettings) {
  const scale=Math.max(width/imageWidth,height/imageHeight)*settings.zoom
  return {scale,maxX:Math.max(0,(imageWidth*scale-width)/2),maxY:Math.max(0,(imageHeight*scale-height)/2)}
}
/** Selection coordinates in source-image pixels. The saved crop uses the same rectangle. */
export function cropRect(iw:number,ih:number,settings:CropSettings) {
  const width=Math.min(iw,ih*settings.ratio)/settings.zoom,height=width/settings.ratio
  return {left:(iw-width)/2*(1-settings.x),top:(ih-height)/2*(1-settings.y),width,height}
}
export function resizeCrop(iw:number,ih:number,settings:CropSettings,width:number):CropSettings {
  const rect=cropRect(iw,ih,settings),base=Math.min(iw,ih*settings.ratio)
  const nextWidth=Math.max(base/3,Math.min(width,iw-rect.left,(ih-rect.top)*settings.ratio))
  const height=nextWidth/settings.ratio
  return {...settings,zoom:base/nextWidth,x:iw>nextWidth?1-2*rect.left/(iw-nextWidth):0,y:ih>height?1-2*rect.top/(ih-height):0}
}
export function validCrop(value:unknown):value is CropSettings {
  if(!value||typeof value!=='object')return false
  const p=value as CropSettings & {rotation?:number}
  return [p.zoom,p.x,p.y,p.ratio].every(Number.isFinite)&&p.zoom>=1&&p.zoom<=3&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.ratio>=.2&&p.ratio<=10&&(!p.rotation||p.rotation===0)
}

export type ProfileImageEdits = {cover?:{originalId:string;settings:CropSettings};avatar?:{originalId:string;settings:CropSettings}}
