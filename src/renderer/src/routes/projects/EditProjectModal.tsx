import { Button, Flex, Group, Modal, ScrollArea, Stack, TextInput } from '@mantine/core'
import type { ILabel, IProject } from '@shared/types'
import { useState, type FC } from 'react'
import { ZIndex } from '@renderer/zIndex'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { useArray } from '@renderer/hooks/useArray'
import { randomHexColor } from '@shared/color'
import { makeUUID } from '@shared/utils'
import { MdDeleteOutline } from 'react-icons/md'

export type EditProjectModalProps = {
  opened: boolean
  project: IProject | null
  onCancel: () => void
  onConfirm: (
    name: string,
    labels: { id: string; name: string; color: string }[]
  ) => Promise<unknown>
}

/** Renames the project and edits/adds labels - can't remove an existing one (used by an annotation), but a not-yet-saved new one can be removed freely. Mount with `key={project?.id}` to reset state per project. */
export const EditProjectModal: FC<EditProjectModalProps> = ({
  opened,
  project,
  onCancel,
  onConfirm
}) => {
  const [name, setName] = useState(project?.name ?? '')
  // Only ids the project had when this modal opened count as "existing" - anything added afterward stays removable.
  const [existingLabelIds] = useState(() => new Set((project?.labels ?? []).map((l) => l.id)))
  // useArray mutates its initial array in place - a shallow copy keeps that from reaching back into project.labels, which react-query still owns.
  const labels = useArray<ILabel>((project?.labels ?? []).map((l) => ({ ...l })))

  const canSave = name.trim().length > 0 && labels.every((l) => l.name.trim().length > 0)

  const confirm = () => {
    if (!canSave) return Promise.resolve()
    return onConfirm(name.trim(), labels.resolve())
  }

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Edit Project"
      centered
      zIndex={ZIndex.actionModal}
    >
      <Stack gap="lg">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-autofocus
        />
        <Flex justify="flex-end">
          <Button
            variant="outline"
            onClick={() => {
              labels.push({ id: makeUUID(), name: '', color: randomHexColor() })
            }}
          >
            Add Label
          </Button>
        </Flex>
        {labels.length > 0 && (
          <ScrollArea style={{ maxHeight: 240 }} type="always" scrollbars="y">
            <Stack gap="xs">
              {labels.map((label) => (
                <Flex key={label.id} align="center" gap="xs">
                  <TextInput
                    flex={1}
                    placeholder="Label Name"
                    required
                    value={label.name}
                    leftSection={
                      <ColorPicker
                        initial={label.color}
                        style={{ width: 18, height: 18, borderRadius: '50%' }}
                        onChange={(color) => {
                          labels.mutate((arr) => {
                            const item = arr.find((l) => l.id === label.id)
                            if (item !== undefined) item.color = color
                          })
                        }}
                      />
                    }
                    onChange={(e) => {
                      labels.mutate((arr) => {
                        const item = arr.find((l) => l.id === label.id)
                        if (item !== undefined) item.name = e.target.value
                      })
                    }}
                  />
                  {!existingLabelIds.has(label.id) && (
                    <Button
                      aria-label={`Remove ${label.name.trim() || 'label'}`}
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        const idx = labels.findIndex((l) => l.id === label.id)
                        if (idx !== -1) labels.splice(idx, 1)
                      }}
                    >
                      <MdDeleteOutline />
                    </Button>
                  )}
                </Flex>
              ))}
            </Stack>
          </ScrollArea>
        )}
        <Group justify="flex-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <AsyncButton disabled={!canSave} onClick={confirm}>
            Save
          </AsyncButton>
        </Group>
      </Stack>
    </Modal>
  )
}
