import { ChefLoader } from '@/components/chef-loader'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { ProfilePage } from '@/components/community/profile'
async function OwnProfile(){const user=await getSessionUser();if(!user)redirect('/');return <ProfilePage key={user.id} username={user.username} viewer={user}/>}
export default function Page(){return <Suspense fallback={<ChefLoader />}><OwnProfile/></Suspense>}
