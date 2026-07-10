import { Badge, Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import type { IProject } from '@shared/types'
import { useState, type FC } from 'react'
import tinycolor from 'tinycolor2'

export type EditProjectModalProps = {
  opened: boolean
  project: IProject | null
  onCancel: () => void
  onConfirm: (name: string, labels: { id: string; name: string }[]) => void
}

/** Only renames the project and its existing labels - adding/removing labels isn't
 *  supported here since a label already used by an annotation can't be deleted. Controlled
 *  by mounting with `key={project?.id}` so state resets when the target project changes. */
export const EditProjectModal: FC<EditProjectModalProps> = ({
  opened,
  project,
  onCancel,
  onConfirm
}) => {
  const [name, setName] = useState(project?.name ?? '')
  const [labelNames, setLabelNames] = useState<Record<string, string>>(
    Object.fromEntries((project?.labels ?? []).map((l) => [l.id, l.name]))
  )

  const labels = project?.labels ?? []
  const canSave =
    name.trim().length > 0 && labels.every((l) => (labelNames[l.id] ?? '').trim().length > 0)

  const confirm = () => {
    if (!canSave) return
    onConfirm(
      name.trim(),
      labels.map((l) => ({ id: l.id, name: (labelNames[l.id] ?? l.name).trim() }))
    )
  }

  return (
    <Modal opened={opened} onClose={onCancel} title="Edit Project" centered>
      <Stack gap="lg">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-autofocus
        />
        {labels.length > 0 && (
          <Stack gap="xs">
            {labels.map((label) => (
              <TextInput
                key={label.id}
                value={labelNames[label.id] ?? label.name}
                onChange={(e) =>
                  setLabelNames((current) => ({ ...current, [label.id]: e.target.value }))
                }
                leftSection={
                  <Badge
                    size="xs"
                    circle
                    style={{
                      backgroundColor: label.color,
                      color: tinycolor(label.color).isLight() ? '#000' : '#fff'
                    }}
                  />
                }
              />
            ))}
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={confirm}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
