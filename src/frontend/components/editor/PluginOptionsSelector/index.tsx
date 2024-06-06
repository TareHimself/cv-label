import React, { useRef } from 'react'
import IoDialogOptionSelector from './FolderOptionSelector'
import { PluginFolderOrFileOption, PluginOption, PluginOptionResult, PluginOptionResultMap } from '@types'


export type PluginOptionsSelectorProps = {
    options: PluginOption[]
    onOptionsSelected: (options: PluginOptionResultMap) => void
}

export default function PluginOptionsSelector(props: PluginOptionsSelectorProps) {
    const results = useRef<PluginOptionResultMap>({});

  return (
    <div style={{display: 'flex',
    flexDirection: 'column',
    width: 300,
    height: "inherit"}}>
      {props.options.map((c,idx)=>{
        if(c.type == 'folderSelect' || c.type == 'fileSelect'){
          const asT = c as PluginFolderOrFileOption;

          return <IoDialogOptionSelector key={c.id} defaultValue={[]} option={asT} onSelected={(d)=>{
            results.current[c.id] = d;
          }} />
        }
        return <></>
      })}

      <button onClick={()=>{
        props.onOptionsSelected(results.current)
      }}>Done</button>
      
    </div>
  )
}
