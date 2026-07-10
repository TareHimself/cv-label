import { describe, expect, it } from 'vitest'
import { folderNameFromDroppedFiles, groupFilesByTopFolder } from '../utils'

describe('folderNameFromDroppedFiles', () => {
  it('returns the folder name when every file was dropped from the same folder', () => {
    const files = [{ relativePath: '/MyDataset/img1.jpg' }, { relativePath: '/MyDataset/img2.jpg' }]

    expect(folderNameFromDroppedFiles(files)).toBe('MyDataset')
  })

  it('works without a leading slash too', () => {
    const files = [{ relativePath: 'MyDataset/img1.jpg' }]

    expect(folderNameFromDroppedFiles(files)).toBe('MyDataset')
  })

  it('returns null for a flat file drop (no folder)', () => {
    const files = [{ relativePath: '/img1.jpg' }, { relativePath: '/img2.jpg' }]

    expect(folderNameFromDroppedFiles(files)).toBeNull()
  })

  it('returns null when files come from different top-level folders', () => {
    const files = [{ relativePath: '/FolderA/img1.jpg' }, { relativePath: '/FolderB/img2.jpg' }]

    expect(folderNameFromDroppedFiles(files)).toBeNull()
  })

  it('handles nested subfolders, keying off only the first segment', () => {
    const files = [
      { relativePath: '/MyDataset/images/img1.jpg' },
      { relativePath: '/MyDataset/labels/img1.txt' }
    ]

    expect(folderNameFromDroppedFiles(files)).toBe('MyDataset')
  })

  it('returns null for an empty file list', () => {
    expect(folderNameFromDroppedFiles([])).toBeNull()
  })

  it('returns null for file-selector\'s "./name.ext" fallback path (no real folder)', () => {
    const files = [{ relativePath: './img1.jpg' }]

    expect(folderNameFromDroppedFiles(files)).toBeNull()
  })
})

describe('groupFilesByTopFolder', () => {
  it('groups files by their top-level folder', () => {
    const fileA1 = { relativePath: '/FolderA/img1.jpg' }
    const fileA2 = { relativePath: '/FolderA/img2.jpg' }
    const fileB1 = { relativePath: '/FolderB/img1.jpg' }

    const groups = groupFilesByTopFolder([fileA1, fileA2, fileB1])

    expect(Array.from(groups.keys())).toEqual(['FolderA', 'FolderB'])
    expect(groups.get('FolderA')).toEqual([fileA1, fileA2])
    expect(groups.get('FolderB')).toEqual([fileB1])
  })

  it('keys nested subfolders off only their top-level folder', () => {
    const groups = groupFilesByTopFolder([
      { relativePath: '/MyDataset/images/img1.jpg' },
      { relativePath: '/MyDataset/labels/img1.txt' }
    ])

    expect(groups.size).toBe(1)
    expect(groups.get('MyDataset')).toHaveLength(2)
  })

  it('omits loose files with no folder segment', () => {
    const groups = groupFilesByTopFolder([
      { relativePath: '/FolderA/img1.jpg' },
      { relativePath: '/loose.jpg' }
    ])

    expect(groups.size).toBe(1)
    expect(groups.has('FolderA')).toBe(true)
  })

  it('returns an empty map for an empty file list', () => {
    expect(groupFilesByTopFolder([]).size).toBe(0)
  })
})
