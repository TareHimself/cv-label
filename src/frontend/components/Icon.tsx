import React from "react";
import { IconType } from "react-icons";

export type IconProps = {
  icon: IconType;
  iconSize?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
  isActive?: boolean;
  onClicked?: () => void;
};
export default function Icon({
  icon,
  onClicked,
  iconSize,
  disabled,
  style,
  isActive,
}: IconProps) {
  const Icon = icon;
  const size = iconSize ?? 20;
  return (
    <button
      onClick={onClicked}
      className={isActive ? "active-icon" : ""}
      style={style}
      disabled={disabled}
    >
      <Icon size={size} />
    </button>
  );
}
