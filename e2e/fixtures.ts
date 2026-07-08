import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProjectsPage } from './pages/ProjectsPage'
import { TasksPage } from './pages/TasksPage'
import { SamplesPage } from './pages/SamplesPage'
import { LabelPage } from './pages/LabelPage'

const e2eDir = dirname(fileURLToPath(import.meta.url))
const rootDir = join(e2eDir, '..')
const mainEntry = join(rootDir, 'out', 'main', 'index.js')

type Fixtures = {
  electronApp: ElectronApplication
  window: Page
  projectsPage: ProjectsPage
  tasksPage: TasksPage
  samplesPage: SamplesPage
  labelPage: LabelPage
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, runTest) => {
    const dataDir = mkdtempSync(join(tmpdir(), 'cv-label-e2e-'))

    const app = await electron.launch({
      args: [mainEntry],
      env: {
        ...process.env,
        CV_LABEL_APP_PATH: dataDir
      }
    })

    await runTest(app)

    await app.close()
    rmSync(dataDir, { recursive: true, force: true })
  },

  window: async ({ electronApp }, runTest) => {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await runTest(window)
  },

  projectsPage: async ({ window }, runTest) => {
    await runTest(new ProjectsPage(window))
  },

  tasksPage: async ({ window }, runTest) => {
    await runTest(new TasksPage(window))
  },

  samplesPage: async ({ window }, runTest) => {
    await runTest(new SamplesPage(window))
  },

  labelPage: async ({ window }, runTest) => {
    await runTest(new LabelPage(window))
  }
})

export { expect }
