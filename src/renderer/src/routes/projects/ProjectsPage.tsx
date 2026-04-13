import { BasicListPage } from '@renderer/components/BasicListPage'
import { styled } from '@linaria/react'
import { Button, Group, Stack, TextInput } from '@mantine/core'
import { CiSearch } from 'react-icons/ci'
import { CreateProjectButton } from './CreateProjectButton'
import { useProjects } from '@renderer/hooks/useProjects'

const TopContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: space-between;
`

export const ProjectsPage = () => {
  const { items, create, open } = useProjects()

  return (
    <>
      <BasicListPage
        top={
          <TopContainer>
            <Group>
              <CreateProjectButton create={create} />
            </Group>
            <Group>
              <TextInput placeholder="Search" rightSection={<CiSearch />} />
            </Group>
          </TopContainer>
        }
      >
        <Stack>
          {items.map((p) => (
            <Button
              key={p.id}
              onClick={() => {
                open(p)
              }}
            >
              {p.name}
            </Button>
          ))}
        </Stack>
      </BasicListPage>
    </>
  )
}
