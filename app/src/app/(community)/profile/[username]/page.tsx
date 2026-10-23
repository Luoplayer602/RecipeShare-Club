import { ChefLoader } from '@/components/chef-loader'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { profileUsername } from '@/lib/profiles/validation'
import { ProfilePage } from '@/components/community/profile'
async function PublicProfile({params}:{params:Promise<{username:string}>}){const {username}=await params;if(!profileUsername.safeParse(username).success)notFound();const viewer=await getSessionUser();return <ProfilePage key={`${username}:${viewer?.id ?? 'guest'}`} username={username} viewer={viewer}/>}
export default function Page({params}:{params:Promise<{username:string}>}){return <Suspense fallback={<ChefLoader />}><PublicProfile params={params}/></Suspense>}
