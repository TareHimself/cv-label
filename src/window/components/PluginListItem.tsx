import { Button, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IPluginInfo, PluginOptionResultMap } from "@types";
import React, { useMemo, useState } from "react";

export type PluginListItemProps<TPlugin extends IPluginInfo> = {
  plugin: TPlugin;
  onPluginConfirmed: (plugin: TPlugin, options: PluginOptionResultMap) => void;
};

export function PluginListItem<TPlugin extends IPluginInfo>({
  plugin,
  onPluginConfirmed,
}: PluginListItemProps<TPlugin>) {
  const [opened, { open, close }] = useDisclosure(false);

  const [optionData, setOptionData] = useState<PluginOptionResultMap>(() => {
    const result: PluginOptionResultMap = {};
    for (const option of plugin.getOptions()) {
      result[option.id] = option.defaultValue;
    }
    return result;
  });

  const optionSelectors = useMemo(
    () =>
      plugin.getOptions().map((option) => {
        const Component = option.component;
        return (
          <Component
            key={option.id}
            id={option.id}
            title={option.title}
            onSelected={(data) => {
              setOptionData((c) => ({ ...c, [option.id]: data }));
            }}
          />
        );
      }),
    [plugin]
  );

  return (
    <>
      <Modal opened={opened} onClose={close} title={plugin.getName()} centered>
        {optionSelectors}
        <Button
          justify="center"
          fullWidth
          onClick={() => {
            close();
            onPluginConfirmed(plugin, optionData);
          }}
        >
          Confirm
        </Button>
      </Modal>
      <Button justify="center" fullWidth onClick={open}>
        {plugin.getName()}
      </Button>
    </>
  );
}
