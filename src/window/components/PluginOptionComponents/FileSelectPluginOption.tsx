import { IPluginOptionProps } from "@types";
import React, { useState, useCallback } from "react";
import { Button } from "@mantine/core";
import { dialog } from "@electron/remote";
export interface FileSelectPluginOptionProps extends IPluginOptionProps {
  multiple?: boolean;
  directory?: boolean;
  fileSelectTitle?: string;
}
export const FileSelectPluginOption: React.FC<FileSelectPluginOptionProps> = ({
  title,
  onSelected,
  multiple = false,
  directory = false,
  fileSelectTitle,
}) => {
  const [value, setValue] = useState<string[]>([]);

  const openDialog = useCallback(() => {
    const dialogTitle = fileSelectTitle ?? title;
    if (directory) {
      if (multiple) {
        return dialog.showOpenDialog({
          title: dialogTitle,
          properties: ["openDirectory", "multiSelections"],
        });
      } else {
        return dialog.showOpenDialog({
          title: dialogTitle,
          properties: ["openDirectory"],
        });
      }
    } else {
      if (multiple) {
        return dialog.showOpenDialog({
          title: dialogTitle,
          properties: ["openFile", "multiSelections"],
        });
      } else {
        return dialog.showOpenDialog({
          title: dialogTitle,
          properties: ["openFile"],
        });
      }
    }
  }, [directory, fileSelectTitle, multiple, title]);

  const selectFiles = useCallback(async () => {
    const result = await openDialog();

    if (result.canceled) {
      return;
    }

    setValue(result.filePaths);
    onSelected(result.filePaths)
  }, [onSelected, openDialog]);

  return (
    <Button fullWidth justify="center" onClick={selectFiles}>
      {value.length > 0 ? `${value.length} Selected` : `Select`}
    </Button>
  );
};
