import { Button, Group, Modal, TextInput } from '@mantine/core'
import { useState, type FC } from 'react'
import { ZIndex } from '@renderer/zIndex'
import { AsyncButton } from './AsyncButton'

export type RenameModalProps = {
  opened: boolean
  entityName: string
  initialName: string
  onCancel: () => void
  onConfirm: (name: string) => Promise<unknown>
}

/** Controlled by mounting with `key={item?.id}` so input state resets on target change, instead of carrying over the previous edit. */
export const RenameModal: FC<RenameModalProps> = ({
  opened,
  entityName,
  initialName,
  onCancel,
  onConfirm
}) => {
  const [name, setName] = useState(initialName)

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={`Rename ${entityName}`}
      centered
      zIndex={ZIndex.actionModal}
    >
      <TextInput
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim().length > 0) {
            onConfirm(name.trim())
          }
        }}
        data-autofocus
      />
      <Group justify="flex-end" mt="lg">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <AsyncButton disabled={name.trim().length === 0} onClick={() => onConfirm(name.trim())}>
          Save
        </AsyncButton>
      </Group>
    </Modal>
  )
}
