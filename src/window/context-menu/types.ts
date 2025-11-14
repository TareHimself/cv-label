export type Vector2 = { x: number; y: number}
export type Awaitable<T> = T | Promise<T>;

export interface IContextMenuOption {
  name: string;
}

export interface IContextMenuSelectableOption<TData = unknown> extends IContextMenuOption{
  callback: (data: TData) => void
}

export interface IContextMenuSubMenu<TData = unknown> extends IContextMenuOption{
  items: IContextMenuField<TData>[]
}

export type IContextMenuField<TData = unknown> = IContextMenuSelectableOption<TData>

export type ICreateContextMenuEventData<TData = unknown> = {
  event: React.MouseEvent;
  options: IContextMenuField<TData>[];
  data: TData
};

export interface IActiveContextMenu<TData = unknown> {
  position: Vector2;
  options: IContextMenuField<TData>[];
  data: TData
}
