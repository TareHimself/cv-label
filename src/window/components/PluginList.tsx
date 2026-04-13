import { IPluginInfo, PluginOptionResultMap } from "@types";
import React from "react";
import { PluginListItem } from "./PluginListItem";
import { Stack } from "@mantine/core";

export type PluginListProps<TPlugin extends IPluginInfo> = {
  plugins: TPlugin[];
  onPluginConfirmed: (plugin: TPlugin, options: PluginOptionResultMap) => void;
};

export function PluginList<TPlugin extends IPluginInfo>({
  plugins,
  onPluginConfirmed,
}: PluginListProps<TPlugin>) {
  return (
    <Stack gap={"md"}>
      {plugins.map((plugin) => (
        <PluginListItem
          key={plugin.getId()}
          plugin={plugin}
          onPluginConfirmed={onPluginConfirmed}
        />
      ))}
    </Stack>
  );
}
