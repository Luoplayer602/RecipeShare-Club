'use client'

import { createContext } from 'react'
import type { CommunityFrameProps } from './frame'

export const CommunityShellContext = createContext<((props: Omit<CommunityFrameProps, 'children'>) => void) | null>(null)
