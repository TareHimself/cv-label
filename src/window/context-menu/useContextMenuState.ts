import { create } from 'zustand'
import { IActiveContextMenu } from './types';

export type ContextMenuState = {
  contextMenu: IActiveContextMenu | null;
};

export type ContextMenuActions = {
  setContextMenu: (menu: IActiveContextMenu | null) => void
};

export const useContextMenuState = create<ContextMenuState & ContextMenuActions>((set) => ({
  contextMenu: null,
  setContextMenu: (menu) => set((s) => ({ contextMenu: menu}))
}))