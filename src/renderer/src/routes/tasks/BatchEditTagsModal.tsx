import { Button, Chip, Group, Modal, Stack, Text } from '@mantine/core'
import { useState, type FC } from 'react'
import { ZIndex } from '@renderer/zIndex'
import type { IProject, ITag } from '@shared/types'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { useTags } from '@renderer/hooks/useTags'
import { TagPicker } from './TagPicker'

export type BatchEditTagsModalProps = {
  opened: boolean
  project: IProject
  taskCount: number
  /** Tags currently on at least one selected task - the only ones removal makes sense
   *  for, since there's no single "current" tag list across a batch of possibly
   *  differently-tagged tasks to diff against (unlike EditTaskTagsModal). */
  removableTags: ITag[]
  onCancel: () => void
  onConfirm: (addedIds: string[], removedIds: string[]) => Promise<unknown>
}

/** Adds/removes tags across a batch of tasks - "Add" is a creatable combobox (TagPicker,
 *  same as the single-task modal) and "Remove" is a row of clickable chips (only tags
 *  already on some selected task, so there's nothing to type there). */
export const BatchEditTagsModal: FC<BatchEditTagsModalProps> = ({
  opened,
  project,
  taskCount,
  removableTags,
  onCancel,
  onConfirm
}) => {
  const { items: allTags, create } = useTags(project)
  const [addIds, setAddIds] = useState<string[]>([])
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set())

  const toggleRemove = (id: string) => {
    setRemoveIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const save = async () => {
    await onConfirm(addIds, [...removeIds])
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
        <Text size="sm" c="dimmed">
          Applies to {taskCount} selected task{taskCount === 1 ? '' : 's'}.
        </Text>
        <TagPicker
          label="Add"
          placeholder="Select or create a tag"
          allTags={allTags}
          value={addIds}
          onChange={setAddIds}
          onCreate={create}
        />
        {removableTags.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Remove
            </Text>
            <Group gap="xs">
              {removableTags.map((tag) => (
                <Chip
                  key={tag.id}
                  checked={removeIds.has(tag.id)}
                  onChange={() => toggleRemove(tag.id)}
                  color="red"
                >
                  {tag.name}
                </Chip>
              ))}
            </Group>
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <AsyncButton disabled={addIds.length === 0 && removeIds.size === 0} onClick={save}>
            Save
          </AsyncButton>
        </Group>
      </Stack>
    </Modal>
  )
}
