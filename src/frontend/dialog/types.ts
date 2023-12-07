import { PropsWithChildren } from 'react'

export type DialogManagerProps = PropsWithChildren<{
    defaultStyle?: React.CSSProperties
}>;

export type OpenDialogProps = {
  id: string;
  style?: React.CSSProperties;
};

export interface IActiveDialog {
  data: OpenDialogProps;
  render: (props: OpenDialogProps) => React.JSX.Element;
}