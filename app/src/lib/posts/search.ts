/** A prefix consumes its phrase up to the next whitespace-separated #, @ or %. */
export function parseSearch(raw: string) {
  const value = raw.normalize('NFKC').trim()
  const markers = [...value.matchAll(/(^|\s)([#@%])/g)].map(match => ({index:match.index + match[1].length, kind:match[2]}))
  const text = markers.length ? value.slice(0,markers[0].index).trim() : value
  const tags:string[]=[],authors:string[]=[],ingredients:string[]=[]
  let incomplete=false
  for(let index=0;index<markers.length;index++){
    const marker=markers[index]
    const term=value.slice(marker.index+1,markers[index+1]?.index??value.length).trim()
    if(!term){incomplete=true;continue}
    const target=marker.kind==='#'?tags:marker.kind==='@'?authors:ingredients
    if(!target.includes(term))target.push(term)
  }
  const peopleOnly=markers.length>0 && markers.every(marker=>marker.kind==='@') && !text
  return {text,tags,authors,ingredients,incomplete,peopleOnly,valid:raw.length<=300 && markers.length<=10}
}
