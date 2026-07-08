import { styled } from '@linaria/react'
import { Modal, Stack, TextInput, Flex, Button, ScrollArea } from '@mantine/core'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { useArray } from '@renderer/hooks/useArray'
import { randomHexColor } from '@shared/color'
import { ILabel } from '@shared/types'
import { makeUUID } from '@shared/utils'
import { FC, useCallback, useState } from 'react'
import { IoMdAdd } from 'react-icons/io'
import { MdDeleteOutline } from 'react-icons/md'

const ColorPickerContainer = styled.div`
  width: 100%;
  height: 100%;
  padding: 5px;
  display: flex;
  box-sizing: border-box;
`

const ShadowContainer = styled.div`
  display: flex;
  flex: 1;
  box-shadow: '0 4px 14px rgba(0,0,0,1)';
`

export type CreateProjectButtonProps = {
  create: (name: string, labels: ILabel[]) => Promise<void>
}
export const CreateProjectButton: FC<CreateProjectButtonProps> = ({ create }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const labels = useArray<ILabel>([
    {
      id: makeUUID(),
      name: '',
      color: randomHexColor()
    }
  ])
  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  return (
    <>
      <Modal
        opened={isModalOpen}
        onClose={closeModal}
        title="Create Project"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap={'lg'}>
          <TextInput
            label="Name"
            //w={500}
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <Flex justify={'flex-end'}>
            <Button
              variant="outline"
              onClick={() => {
                labels.push({
                  id: makeUUID(),
                  name: 'Some Name',
                  color: randomHexColor()
                })
              }}
            >
              Add Label
            </Button>
          </Flex>
          <Flex>
            <ScrollArea
              style={{
                flexGrow: 1,
                maxHeight: '200px'
              }}
              type="always"
              scrollbars="y"
            >
              <Stack>
                {labels.map((label) => (
                  <Flex key={label.id} align={'stretch'} gap="md">
                    <TextInput
                      flex={1}
                      placeholder="Label Name"
                      required
                      rightSection={
                        <ColorPickerContainer>
                          <ShadowContainer>
                            <ColorPicker
                              initial={label.color}
                              style={{ flex: 1, borderRadius: 5 }}
                              onChange={(color) => {
                                // No need for state update here
                                const item = labels.find((a) => a.id === label.id)
                                if (item !== undefined) {
                                  item.color = color
                                }
                              }}
                            />
                          </ShadowContainer>
                        </ColorPickerContainer>
                      }
                      onChange={(e) => {
                        labels.mutate((arr) => {
                          const item = arr.find((a) => a.id === label.id)
                          if (item !== undefined) {
                            item.name = e.target.value
                          }
                        })
                      }}
                    />
                    <Button
                      aria-label="Remove label"
                      onClick={() => {
                        const idx = labels.findIndex((a) => a.id === label.id)
                        if (idx !== -1) {
                          labels.splice(idx, 1)
                        }
                      }}
                    >
                      <MdDeleteOutline />
                    </Button>
                  </Flex>
                ))}
              </Stack>
            </ScrollArea>
          </Flex>

          <Button
            fullWidth
            onClick={() => {
              create(projectName, labels.resolve())
              setIsModalOpen(false)
            }}
            disabled={
              projectName.trim().length === 0 || labels.some((c) => c.name.trim().length === 0)
            }
          >
            Create
          </Button>
        </Stack>
      </Modal>
      <Button
        leftSection={<IoMdAdd />}
        onClick={() => {
          labels.splice(0, labels.length)
          labels.push({
            id: makeUUID(),
            name: '',
            color: randomHexColor()
          })
          setProjectName(``)
          setIsModalOpen(true)
        }}
      >
        Create Project
      </Button>
    </>
  )
}
