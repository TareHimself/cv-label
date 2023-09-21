import { IconType } from "react-icons";

export type ActionPanelIconProps = {
  icon: IconType;
  onClicked?: () => void;
};
export default function ActionPanelIcon({
  icon,
  onClicked,
}: ActionPanelIconProps) {
  const Icon = icon;
  const size = 30;
  return (
    <div
      style={{
        maxWidth: size,
        maxHeight: size,
        minWidth: size,
        minHeight: size,
        margin: (50 - size) / 2,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <Icon onClick={onClicked} color="white" size={20} />
    </div>
  );
}
