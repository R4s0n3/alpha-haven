import { SparklesIcon } from '@heroicons/react/24/solid'
import React from 'react'

const LoadingSpinner = () => {
  return (
    <div className="absolute flex justify-center items-center top-0 left-0 h-screen w-screen z-80 bg-slate-900"><SparklesIcon className='w-6 t-6 text-rose-500 animate-rotate' /></div>
  )
}

export default LoadingSpinner
