import { Button, Group, Modal, Text } from '@mantine/core'
import type { FC } from 'react'

export type ConfirmDeleteModalProps = {
  opened: boolean
  entityName: string
  itemName?: string
  onCancel: () => void
  onConfirm: () => void
}

export const ConfirmDeleteModal: FC<ConfirmDeleteModalProps> = ({
  opened,
  entityName,
  itemName,
  onCancel,
  onConfirm
}) => {
  return (
    <Modal opened={opened} onClose={onCancel} title={`Delete ${entityName}`} centered>
      <Text size="sm">
        {itemName ? (
          <>
            Are you sure you want to delete <b>{itemName}</b>? This cannot be undone.
          </>
        ) : (
          `Are you sure you want to delete this ${entityName}? This cannot be undone.`
        )}
      </Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          color="red"
          onClick={() => {
            onConfirm()
            onCancel()
          }}
        >
          Delete
        </Button>
      </Group>
    </Modal>
  )
}
