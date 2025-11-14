import Icon from "@components/Icon";
import { FaFileExport} from "react-icons/fa";


export const ExportSamplesIcon = () => {
    return <Icon
                icon={FaFileExport}
                tooltip="Export Project"
                // onClicked={() => {
                //   createDialog((p) => (
                //     <DialogBox
                //       onCloseRequest={() => {
                //         closeDialog(p.id);
                //       }}
                //     >
                //       <PluginSelectionList
                //         plugins={exporters}
                //         onPluginSelected={(plugin,opts) => {
                //           console.log("Exporting using", plugin);
                //           dispatch(
                //             exportSamples({
                //               id: plugin.id,
                //               options: opts,
                //             })
                //           );
                //           closeDialog(p.id);
                //         }}
                //       />
                //     </DialogBox>
                //   ));
                // }}
              />
}