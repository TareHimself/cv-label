import React, { useRef, useState } from "react";
import { dialog } from "@electron/remote";
import { PluginFolderOrFileOption, PluginOptionResult } from "@types";

export type FolderOptionSelectorProps = {
  defaultValue: string[];
  option: PluginFolderOrFileOption
  onSelected: (data: PluginOptionResult<'fileSelect' | 'folderSelect'>) => void;
};

export default function IoDialogOptionSelector(props: FolderOptionSelectorProps) {
  const [selected, setSelected] = useState(
    props.defaultValue.filter((a) => a.length !== 0)
  );

  const [dialogOptions,_] = useState(()=> {
    const opts: Electron.OpenDialogOptions = {
      title: props.option.displayName,
      properties: [props.option.type.startsWith("file") ?  "openFile" : "openDirectory"],
    }

    if(props.option.multiple){
      opts.properties?.push("multiSelections")
    }

    return opts
  });

  return (
    <button
        className='plugin-list-item'
        onClick={() => {
          dialog
            .showOpenDialog(dialogOptions)
            .then((r) => {
              if (!r.canceled) {
                props.onSelected({
                  id: props.option.id,
                  type: props.option.type,
                  value: r.filePaths
                })
                setSelected(r.filePaths)
              }
            });
        }}
      >
        {`Selected (${selected.length} selected)`}
      </button>
  );
}
