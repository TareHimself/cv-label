import React from 'react'

export type DialogBoxLabeledItemProps = React.PropsWithChildren<{
    label: string
}>

export default function DialogBoxLabeledItem(props: DialogBoxLabeledItemProps) {
  return (
    <div style={{display: 'flex',flexDirection: 'column', gap: 10}}>
        <h3 style={{textAlign: 'center'}}>{props.label}</h3>
        <div style={{width: "100%", height: "1px", background: "#ffffff73", borderRadius: 1}} />
        {props.children}
    </div>
  )
}
