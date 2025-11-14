import { PluginOptionProps } from "@types";
import React, { useState } from "react";
import { FileInput } from "@mantine/core";

export const FileSelectPluginOption: React.FC<PluginOptionProps> = ({
  title,
  onSelected,
}) => {
  const [value, setValue] = useState<File[]>([]);
  return (
    <FileInput
      multiple
      accept="image/*"
      label={title}
      value={value}
      placeholder="Upload Samples"
      onChange={(files) => {
        setValue(files);
        onSelected(files.map((c) => c.path));
      }}
    />
  );
};
