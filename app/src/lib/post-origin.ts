/** Only community lists and profiles can be reader return destinations. */
export function postOrigin(value:string|null):string {
  if(!value||!value.startsWith('/')||value.startsWith('//'))return '/home'
  try {
    const url=new URL(value,'https://demo.invalid')
    if(url.origin!=='https://demo.invalid'||!/^\/(home|saved|following|profile(?:\/[a-zA-Z0-9_-]+)?)$/.test(url.pathname))return '/home'
    return url.pathname+url.search+url.hash
  } catch {return '/home'}
}
