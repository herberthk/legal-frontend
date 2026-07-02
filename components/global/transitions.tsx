import Link, { LinkProps } from 'next/link'
import { TRANSITION } from '@/constants'
import { ComponentPropsWithoutRef, forwardRef, ReactNode } from 'react'

type Direction = "right" | "left"
type CaseLinkProps = LinkProps &
  Omit<ComponentPropsWithoutRef<'a'>, keyof LinkProps> & {
    children: ReactNode
    direction?:Direction
  }

export const CustomLink = forwardRef<HTMLAnchorElement, CaseLinkProps>(
  function CaseLink({ children, direction='right', ...props }, ref) {
    return (
      <Link ref={ref} transitionTypes={[direction==='right'? TRANSITION.NAV_FORWARD:TRANSITION.NAV_BACK]} {...props}>
        {children}
      </Link>
    )
  }
)

export function BackLink({ href, children, ...props }: LinkProps & { children: React.ReactNode }) {
  return (
    <Link href={href} transitionTypes={[TRANSITION.NAV_BACK]} {...props}>
      {children}
    </Link>
  )
}