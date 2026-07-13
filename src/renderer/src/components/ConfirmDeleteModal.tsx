import { Button, Group, Modal, Text } from '@mantine/core'
import type { FC } from 'react'
import { ZIndex } from '@renderer/zIndex'
import { AsyncButton } from './AsyncButton'

export type ConfirmDeleteModalProps = {
  opened: boolean
  entityName: string
  itemName?: string
  onCancel: () => void
  onConfirm: () => Promise<unknown>
}

export const ConfirmDeleteModal: FC<ConfirmDeleteModalProps> = ({
  opened,
  entityName,
  itemName,
  onCancel,
  onConfirm
}) => {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={`Delete ${entityName}`}
      centered
      zIndex={ZIndex.confirmationModal}
    >
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
        <AsyncButton
          color="red"
          onClick={() => {
            const result = onConfirm()
            onCancel()
            return result
          }}
        >
          Delete
        </AsyncButton>
      </Group>
    </Modal>
  )
}
