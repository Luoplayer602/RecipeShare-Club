import {readFileSync} from 'node:fs'
export function loadSecrets(names){
  for(const name of names){
    const filename=process.env[name+'_FILE']
    if(filename)process.env[name]=readFileSync(filename,'utf8')
    if(!process.env[name])throw Error('Missing required configuration: '+name)
  }
}
