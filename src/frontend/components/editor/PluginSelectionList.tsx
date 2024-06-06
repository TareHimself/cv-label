import { closeDialog, createDialog } from '@frontend/dialog'
import { IPluginInfo, PluginOptionResultMap } from '@types'
import React from 'react'
import PluginOptionsSelector from './PluginOptionsSelector'
import DialogBox from '@components/DialogBox'

export type PluginSelectionListProps = {
    plugins: IPluginInfo[]
    onPluginSelected: (plugin: IPluginInfo,opts: PluginOptionResultMap) => void
}
export default function PluginSelectionList(props: PluginSelectionListProps) {

  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: 300,
        height: "inherit",
        gap: 20
    }}>
    {props.plugins.map((plugin) => {

        return <button key={plugin.id} className='plugin-list-item' onClick={() => {
            if(plugin.options.length > 0){
              createDialog((p) => {
                return <DialogBox
                  onCloseRequest={() => {
                    closeDialog(p.id);
                  }}
                >
                  <PluginOptionsSelector options={plugin.options} onOptionsSelected={(opts) => {
                  props.onPluginSelected(plugin,opts)
                  closeDialog(p.id);
                }} />
                </DialogBox>
              })
            }
            else{
              props.onPluginSelected(plugin,{})
            }
            
        }}>{plugin.displayName}</button>
    })}
    </div>
  )
}
