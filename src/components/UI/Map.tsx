import { useRouter } from 'next/router'
import React, { useEffect } from 'react'
import LoadingSpinner from '../LoadingSpinner'


const Map = () => {
  const router = useRouter()
  useEffect(() => {
    async function pushToMap(){
      await router.push('/game/map')
    }
    void pushToMap()
  },[router])

  return <LoadingSpinner />
}

export default Map