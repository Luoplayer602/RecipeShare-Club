'use client'
import { Suspense, type ComponentProps } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { postOrigin } from '@/lib/post-origin'

type PostLinkProps=Omit<ComponentProps<typeof Link>,'href'> & {postId:string}
export function PostLink(props:PostLinkProps){
  const {postId,...link}=props
  return <Suspense fallback={<Link {...link} href={`/posts/${postId}`}/>}><OriginPostLink {...props}/></Suspense>
}
function OriginPostLink({postId,...props}:PostLinkProps){
  const pathname=usePathname(),query=useSearchParams()
  const from=postOrigin(pathname.startsWith('/posts/')?query.get('from'):pathname+(query.toString()?'?'+query.toString():''))
  return <Link {...props} href={{pathname:`/posts/${postId}`,query:{from}}}/>
}
export function ReaderBack({className}:{className:string}){
  const content=<><ArrowLeft size={14}/>Trở về căn bếp</>
  return <Suspense fallback={<Link href="/home" className={className}>{content}</Link>}><OriginBack className={className}>{content}</OriginBack></Suspense>
}
function OriginBack({className,children}:{className:string;children:React.ReactNode}){
  const query=useSearchParams()
  return <Link href={postOrigin(query.get('from'))} scroll={false} className={className}>{children}</Link>
}
