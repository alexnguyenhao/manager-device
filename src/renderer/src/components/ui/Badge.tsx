import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { TONE_BADGE, TONE_DOT } from '../../lib/colors'
import type { Tone } from '@shared/constants'

interface BadgeProps {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset',
        TONE_BADGE[tone],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />}
      {children}
    </span>
  )
}
