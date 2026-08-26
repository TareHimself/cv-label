import { useState, type FC } from 'react'
import { ActionIcon, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { MdAdd, MdDeleteOutline, MdEdit } from 'react-icons/md'
import type { IProject, ITag } from '@shared/types'
import { AsyncButton } from '@renderer/components/AsyncButton'
import { ConfirmDeleteModal } from '@renderer/components/ConfirmDeleteModal'
import { RenameModal } from '@renderer/components/RenameModal'
import { useTags } from '@renderer/hooks/useTags'
import { ZIndex } from '@renderer/zIndex'

export type ManageTagsModalProps = {
  opened: boolean
  project: IProject
  onClose: () => void
}

/** The one place a project's tag vocabulary is created/renamed/deleted - elsewhere a tag is always picked from this list by id (see EditTaskTagsModal, BatchEditTagsModal). */
export const ManageTagsModal: FC<ManageTagsModalProps> = ({ opened, project, onClose }) => {
  const { items, isLoading, create, rename, remove } = useTags(project)
  const [newName, setNewName] = useState('')
  const [pendingRename, setPendingRename] = useState<ITag | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ITag | null>(null)

  const addTag = async () => {
    const name = newName.trim()
    if (name.length === 0) return
    await create(name)
    setNewName('')
  }

  return (
    <>
      <RenameModal
        key={pendingRename?.id}
        opened={pendingRename !== null}
        entityName="tag"
        initialName={pendingRename?.name ?? ''}
        onCancel={() => setPendingRename(null)}
        onConfirm={async (name) => {
          const result = pendingRename !== null ? rename(pendingRename.id, name) : Promise.resolve()
          setPendingRename(null)
          return result
        }}
      />
      <ConfirmDeleteModal
        opened={pendingDelete !== null}
        entityName="tag"
        itemName={pendingDelete?.name}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => (pendingDelete !== null ? remove(pendingDelete.id) : Promise.resolve())}
      />
      <Modal
        opened={opened}
        onClose={onClose}
        title="Manage Tags"
        centered
        zIndex={ZIndex.actionModal}
      >
        <Stack gap="lg">
          <Stack gap="xs">
            {!isLoading && items.length === 0 && (
              <Text c="dimmed" size="sm">
                No tags yet.
              </Text>
            )}
            {items.map((tag) => (
              <Group key={tag.id} justify="space-between" wrap="nowrap">
                <Text truncate>{tag.name}</Text>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    aria-label={`Rename ${tag.name}`}
                    variant="subtle"
                    onClick={() => setPendingRename(tag)}
                  >
                    <MdEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    aria-label={`Delete ${tag.name}`}
                    variant="subtle"
                    color="red"
                    onClick={() => setPendingDelete(tag)}
                  >
                    <MdDeleteOutline size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
          <Group wrap="nowrap" align="flex-end">
            <TextInput
              label="New tag"
              placeholder="e.g. Needs Review"
              flex={1}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim().length > 0) {
                  addTag()
                }
              }}
              data-autofocus
            />
            <AsyncButton
              leftSection={<MdAdd />}
              disabled={newName.trim().length === 0}
              onClick={addTag}
            >
              Add
            </AsyncButton>
          </Group>
          <Group justify="flex-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
