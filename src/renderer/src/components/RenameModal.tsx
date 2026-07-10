import { Button, Group, Modal, TextInput } from '@mantine/core'
import { useState, type FC } from 'react'

export type RenameModalProps = {
  opened: boolean
  entityName: string
  initialName: string
  onCancel: () => void
  onConfirm: (name: string) => void
}

/** Controlled by mounting with a `key` tied to the item being renamed (e.g. `key={item?.id}`)
 *  so its internal input state resets whenever the target changes, instead of carrying over
 *  the previous item's in-progress edit. */
export const RenameModal: FC<RenameModalProps> = ({
  opened,
  entityName,
  initialName,
  onCancel,
  onConfirm
}) => {
  const [name, setName] = useState(initialName)

  return (
    <Modal opened={opened} onClose={onCancel} title={`Rename ${entityName}`} centered>
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
        <Button disabled={name.trim().length === 0} onClick={() => onConfirm(name.trim())}>
          Save
        </Button>
      </Group>
    </Modal>
  )
}
