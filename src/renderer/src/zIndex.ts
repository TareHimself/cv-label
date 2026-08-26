// Centralized z-index layers so modals/overlays stack predictably instead of by DOM/mount order (Mantine's default). Always use one of these; derive new layers from ACTION_MODAL.

const ACTION_MODAL = 1000

export const ZIndex = {
  /** A modal driving a primary flow on its own: Create/Edit Project, Rename, Import/Export Samples opened directly from a page. */
  actionModal: ACTION_MODAL,
  /** A modal opened from within another action modal - must clear the modal it was opened from. */
  nestedActionModal: ACTION_MODAL + 100,
  /** Popovers/dropdowns rendered inside an action modal - must clear every action-modal layer above, regardless of nesting depth. */
  actionModalContent: ACTION_MODAL + 200,
  /** Yes/no decision dialogs - always above every action-modal layer, since one can appear while any of them is still open. */
  confirmationModal: ACTION_MODAL + 1000
} as const
