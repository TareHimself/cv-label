import Icon from "@components/Icon";
import { useDisclosure } from "@mantine/hooks";
import { FaFileImport } from "react-icons/fa";
import { Modal } from "@mantine/core";
import { Importers } from "@window/native/importers";
import { PluginList } from "@components/PluginList";
import { useEditorState } from "@hooks/useEditorState";

export const ImportSamplesIcon = () => {
  const [opened, { open, close }] = useDisclosure(false);
  const importSamples = useEditorState((s) => s.importSamples);
  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title="Select an importer"
        centered
      >
        <PluginList
          plugins={Importers}
          onPluginConfirmed={async (plugin, options) => {
            close();
            await importSamples(plugin, options);
          }}
        />
      </Modal>
      <Icon icon={FaFileImport} onClicked={open} tooltip="Import Samples" />
    </>
  );
};
