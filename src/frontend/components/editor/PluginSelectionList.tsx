import { IPluginInfo } from '@types'
import React from 'react'

export type PluginSelectionListProps = {
    plugins: IPluginInfo[]
    onPluginSelected: (plugin: IPluginInfo) => void
}
export default function PluginSelectionList(props: PluginSelectionListProps) {

  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: 300,
        height: "inherit"
    }}>
    {props.plugins.map((plugin) => {

        return <button onClick={() => {
            props.onPluginSelected(plugin)
        }}>{plugin.displayName}</button>
    })}
    </div>
  )
}
