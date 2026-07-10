/** Centralized z-index layers so modals/overlays stack in a predictable order instead of
 *  relying on Mantine's default z-index, which breaks ties by DOM/mount order rather than
 *  "which one was opened on top of the other" - e.g. two modals at the same default
 *  z-index stack by mount order, not by which one opened later. Always use one of these
 *  instead of a bare number; derive new layers from `ActionModal` rather than guessing a
 *  fresh magic number. */

const ACTION_MODAL = 1000

export const ZIndex = {
  /** A modal driving a primary flow on its own: Create/Edit Project, Rename,
   *  Import/Export Samples when opened directly from a page. */
  actionModal: ACTION_MODAL,
  /** A modal opened from within another action modal (e.g. Import Samples opened from
   *  inside Create Task's modal) - must clear the modal it was opened from. */
  nestedActionModal: ACTION_MODAL + 100,
  /** Popovers/dropdowns (Select comboboxes, etc.) rendered inside an action modal - must
   *  clear every action-modal layer above, regardless of nesting depth. */
  actionModalContent: ACTION_MODAL + 200,
  /** Yes/no decision dialogs (Confirm Delete, Stop creating tasks, Multiple folders
   *  detected) - always above every action-modal layer, since one can appear while any
   *  of them is still open. */
  confirmationModal: ACTION_MODAL + 1000
} as const
