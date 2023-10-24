/* eslint-disable @typescript-eslint/no-unused-vars */
import { PluginBase } from '@electron-forge/plugin-base';
import { ForgeMultiHookMap, ResolvedForgeConfig, StartResult, ForgePlatform, ForgeArch } from '@electron-forge/shared-types';
import * as fs from 'fs';
import path from 'path';
export interface CopyExternalsPluginConfig {
    externals: string[]
}

export default class CopyExternalsPlugin extends PluginBase<CopyExternalsPluginConfig> {
    override name = "CopyExternalsPlugin";
    config: CopyExternalsPluginConfig;

    constructor(config: CopyExternalsPluginConfig) {
        super(config);
        this.config = config
    }

    resolvePackage(packageName: string) {
        return path.join(process.cwd(), 'node_modules', ...packageName.split('/'))
    }

    async findPackagePath(packageName: string): Promise<{
        path: string;
        deps: string[];
    } | undefined> {
        // const entryFilePath = require.resolve(packageName)
        // const filePathSplit = entryFilePath.split(path.sep)
        // const nodeModulesIndex = filePathSplit.indexOf('node_modules')
        // const moduleFolder = filePathSplit.slice(nodeModulesIndex + 1)
        // const actualModuleFolder = path.join(filePathSplit.slice(0, nodeModulesIndex + 1).join(path.sep), moduleFolder[0].startsWith('@') ? moduleFolder.slice(0, 2).join(path.sep) : moduleFolder[0])
        const actualModuleFolder = this.resolvePackage(packageName)
        try {
            const packageJson = JSON.parse(await fs.promises.readFile(path.join(actualModuleFolder, "package.json"), 'utf-8'))
            const deps = packageJson['dependencies']

            return {
                path: actualModuleFolder,
                deps: deps !== undefined ? Object.keys(deps) : []
            }
        } catch (error) {
            console.error(error)
            return undefined
        }
    }

    getHooks() {
        return {
            postPackage: async (config: ResolvedForgeConfig, options: {
                platform: ForgePlatform;
                arch: ForgeArch;
                outputPaths: string[];
              }) => {

                // const searched = new Set<string>();
                // const toSearch = [[...this.config.externals]]
                // const toCopy = new Set<string>();

                // while (toSearch.length > 0) {
                //     const modules = toSearch.shift() ?? []
                //     const results = await Promise.all(modules.map(async (c) => {
                //         searched.add(c);
                //         return await this.findPackagePath(c)
                //     }))

                //     const nextSearch = new Set<string>();

                //     results.forEach(x => {
                //         if (x) {
                //             toCopy.add(x.path)
                //             x.deps.forEach((dep) => {
                //                 if (!searched.has(dep)) {
                //                     nextSearch.add(dep)
                //                 }
                //             })
                //         }
                //     })

                //     if (nextSearch.size > 0) {
                //         toSearch.push(Array.from(nextSearch))
                //     }
                // }
                // const modulePaths = Array.from(toCopy)
                // const buildPathNodeModules = path.join(buildPath, 'node_modules')
                // try {
                //     await fs.promises.mkdir(buildPathNodeModules, {
                //         recursive: true
                //     })
                // } catch (error) {
                //     //console.error(error)
                // }
                // const copiedTo = await Promise.all(modulePaths.map(async (mod) => {
                //     const dstPath = mod.replace(/(.*node_modules)/, buildPathNodeModules)
                //     await fs.promises.cp(mod, dstPath, {
                //         recursive: true
                //     })
                //     return dstPath
                // }))
                await fs.promises.writeFile("info", `AFTER COPY SHIT  \n${options.outputPaths.join('\n')}`)
                return
            }
        };
    }
}