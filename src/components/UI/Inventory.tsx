import { api } from '@/utils/api'
import React from 'react'
import LoadingSpinner from '../LoadingSpinner'
import MaterialIcon from '../MaterialIcon'


const Inventory = () => {
  const {data:inventoryData, isLoading} = api.user.getInventory.useQuery()

 
  if(isLoading) return <LoadingSpinner />
  return (
    <div className="grid w-full max-w-3xl grid-cols-3 gap-3 sm:grid-cols-5">
      {inventoryData?.cargo?.map((cargo) => <MaterialIcon 
      key={cargo.material.id}
      id={cargo.material.name}
      amount={cargo.amount}
      image={cargo.material.image ?? undefined}
      label={cargo.material.name}
  
   
    />)}
    </div>
  )
}

export default Inventory
