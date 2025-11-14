import React, { useId } from "react";
import { IconType } from "react-icons";
import { Tooltip } from "react-tooltip";

export type IconProps = {
  icon: IconType;
  iconSize?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
  isActive?: boolean;
  onClicked?: () => void;
  tooltip?: string
};
export default function Icon({
  icon,
  onClicked,
  iconSize,
  disabled,
  style,
  isActive,
  tooltip
}: IconProps) {
  const Icon = icon;
  const size = iconSize ?? 20;
  const iconId = useId()
  return (
    <>
    <button
      data-tooltip-id={iconId}
      onClick={onClicked}
      className={isActive ? "active-icon" : ""}
      style={style}
      disabled={disabled}
      data-tooltip-content={tooltip ?? "Someone forgot to add this tooltip"}
    >
      <Icon size={size} />
    </button>
    <Tooltip id={iconId} />
    </>
  );
}
