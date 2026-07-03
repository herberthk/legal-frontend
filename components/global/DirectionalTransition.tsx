import { ViewTransition } from 'react';
import { TRANSITION } from '@/constants';

export default function DirectionalTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ 
        [TRANSITION.NAV_FORWARD]: TRANSITION.NAV_FORWARD, 
        [TRANSITION.NAV_BACK]: TRANSITION.NAV_BACK, 
        default: 'none' 
      }}
      exit={{ 
        [TRANSITION.NAV_FORWARD]: TRANSITION.NAV_FORWARD, 
        [TRANSITION.NAV_BACK]: TRANSITION.NAV_BACK, 
        default: 'none' 
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
