import { IPluginInfo, PluginOptionResultMap } from "@types";
import React from "react";
import { PluginListItem } from "./PluginListItem";

export type PluginListProps<TPlugin extends IPluginInfo> = {
  plugins: TPlugin[];
  onPluginConfirmed: (
    plugin: TPlugin,
    options: PluginOptionResultMap
  ) => void;
};

export function PluginList<TPlugin extends IPluginInfo>({
  plugins,
  onPluginConfirmed,
}: PluginListProps<TPlugin>) {
  return (
    <>
      {plugins.map((plugin) => (
        <PluginListItem
          key={plugin.getId()}
          plugin={plugin}
          onPluginConfirmed={onPluginConfirmed}
        />
      ))}
    </>
  );
}
