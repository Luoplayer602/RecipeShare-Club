// Keep file-type's ESM package boundary and its exact dependency closure intact.
// Turbopack's standalone trace can leave this ESM package's closure incomplete.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const root=process.cwd(),packages=new Map()
function visit(name,from){
  const lookup=createRequire(path.join(from,'package.json')).resolve.paths(name)||[]
  const manifest=lookup.map(directory=>path.join(directory,name,'package.json')).find(filename=>fs.existsSync(filename))
  if(!manifest)throw Error('Cannot resolve external runtime dependency: '+name)
  const directory=fs.realpathSync(path.dirname(manifest)),metadata=JSON.parse(fs.readFileSync(manifest,'utf8'))
  if(packages.has(name)){
    if(packages.get(name).version!==metadata.version)throw Error('Conflicting external dependency versions: '+name)
    return
  }
  packages.set(name,{directory,version:metadata.version})
  for(const dependency of Object.keys(metadata.dependencies||{}))visit(dependency,directory)
}
visit('file-type',root)
const standalone=path.join(root,'.next','standalone'),external=path.join(standalone,'external','node_modules')
for(const [name,{directory}] of packages){
  const destination=path.join(external,name)
  fs.mkdirSync(path.dirname(destination),{recursive:true})
  fs.cpSync(directory,destination,{recursive:true,filter:source=>!path.relative(directory,source).split(path.sep).includes('node_modules')})
}
// This Next/Turbopack version imports ESM externals under generated hash aliases.
const aliases=new Set(['file-type'])
function scan(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name)
    if(entry.isDirectory())scan(filename)
    else if(entry.name.endsWith('.js'))for(const match of fs.readFileSync(filename,'utf8').matchAll(/["'](file-type-[a-f0-9]{8,64})["']/g))aliases.add(match[1])
  }
}
scan(path.join(root,'.next','server'))
for(const base of [path.join(standalone,'node_modules'),path.join(standalone,'.next','node_modules')]){
  fs.mkdirSync(base,{recursive:true})
  for(const alias of aliases){
    const link=path.join(base,alias)
    let existing
    try{existing=fs.lstatSync(link)}catch(error){if(error.code!=='ENOENT')throw error}
    if(existing){
      if(!existing.isSymbolicLink())throw Error('Expected an external module symlink: '+alias)
      fs.unlinkSync(link)
    }
    fs.symlinkSync(path.relative(base,path.join(external,'file-type')),link,'dir')
  }
}
console.log(`Packaged file-type with ${packages.size} exact external runtime packages.`)
