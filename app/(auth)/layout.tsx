import { WavyBackground } from '@/components/shared/WavyBackground'
import React from 'react'

const layout = ({children}: {children: React.ReactNode}) => {
  return (
    <main className="auth">
      {children}
      <WavyBackground />  
    </main>
  )
}

export default layout