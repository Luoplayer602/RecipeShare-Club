'use client'

import { useState, type ReactNode } from 'react'
import { StandaloneCommunityFrame, type CommunityFrameProps } from './frame'
import { CommunityShellContext } from './shell-context'

export function PersistentCommunityShell({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Omit<CommunityFrameProps, 'children'>>({ user: null })
  return <CommunityShellContext.Provider value={setSettings}>
    <StandaloneCommunityFrame {...settings}>{children}</StandaloneCommunityFrame>
  </CommunityShellContext.Provider>
}
