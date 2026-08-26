import { Button, Group, Modal, Stack } from '@mantine/core'
import { useState, type FC } from 'react'
import { ZIndex } from '@renderer/zIndex'
import type { IProject, ITask } from '@shared/types'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { useTags } from '@renderer/hooks/useTags'
import { TagPicker } from './TagPicker'

export type EditTaskTagsModalProps = {
  opened: boolean
  project: IProject
  task: ITask | null
  onCancel: () => void
  onConfirm: (addedIds: string[], removedIds: string[]) => Promise<unknown>
}

/** Edits one task's tags via TagPicker, pre-filled as pills, diffed against the original set on Save. Controlled by mounting with a `key={task?.id}`, same convention as RenameModal. */
export const EditTaskTagsModal: FC<EditTaskTagsModalProps> = ({
  opened,
  project,
  task,
  onCancel,
  onConfirm
}) => {
  const { items: allTags, create } = useTags(project)
  const originalIds = new Set((task?.tags ?? []).map((t) => t.id))
  const [selectedIds, setSelectedIds] = useState<string[]>([...originalIds])

  const save = async () => {
    const selectedSet = new Set(selectedIds)
    const added = selectedIds.filter((id) => !originalIds.has(id))
    const removed = [...originalIds].filter((id) => !selectedSet.has(id))
    await onConfirm(added, removed)
  }

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Edit Tags"
      centered
      zIndex={ZIndex.actionModal}
    >
      <Stack gap="lg">
        <TagPicker
          label="Tags"
          placeholder={allTags.length === 0 ? 'Type to create a tag' : 'Select or create a tag'}
          allTags={allTags}
          value={selectedIds}
          onChange={setSelectedIds}
          onCreate={create}
        />
        <Group justify="flex-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <AsyncButton onClick={save}>Save</AsyncButton>
        </Group>
      </Stack>
    </Modal>
  )
}
